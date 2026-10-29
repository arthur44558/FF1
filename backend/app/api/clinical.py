from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.core.security import current_user, require_permission
from app.db import get_db
from app.models import (
    AuditEvent,
    CommunicationPreference,
    Encounter,
    Facility,
    FollowupOrder,
    FollowupRevision,
    Patient,
    PatientContact,
    PolicyVersion,
    ReminderJob,
    User,
)
from app.schemas import (
    CancelIn,
    CompleteIn,
    ContactResolveIn,
    EncounterCreate,
    EncounterOut,
    FollowupAmendmentIn,
    FollowupOut,
    PatientCreate,
    PatientOut,
    RescheduleIn,
    SupersedeIn,
)
from app.services.scheduling import create_schedule
from app.services.idempotency import replay_response, save_idempotent_response
from app.services.time_utils import to_utc

router = APIRouter(prefix="/api/v1", tags=["patients, encounters and follow-ups"])
PENDING_JOB_STATES = {"scheduled", "claimed", "retry_wait", "call_task_open"}
ACTIVE_FOLLOWUP_STATES = {"active", "contact_resolution_required"}


def _patient_out(patient: Patient) -> PatientOut:
    return PatientOut.model_validate(patient)


def _followup_out(db: Session, order: FollowupOrder) -> FollowupOut:
    patient = db.get(Patient, order.patient_id)
    encounter = db.get(Encounter, order.encounter_id)
    return FollowupOut(
        id=order.id,
        patient_id=order.patient_id,
        patient_identifier=patient.hospital_patient_identifier if patient else "",
        patient_display_name=patient.display_name if patient else None,
        encounter_id=order.encounter_id,
        external_encounter_identifier=encounter.external_encounter_identifier if encounter else "",
        clinician_user_id=order.created_by_clinician_id,
        severity=order.severity,
        followup_required=order.followup_required,
        scheduled_at=order.scheduled_at,
        status=order.status,
        contact_resolution_status=order.contact_resolution_status,
        revision=order.revision,
        policy_version_id=order.policy_version_id,
        overdue=bool(
            order.followup_required
            and order.scheduled_at
            and to_utc(order.scheduled_at) < datetime.now(timezone.utc)
            and order.status in ACTIVE_FOLLOWUP_STATES
        ),
        created_at=order.created_at,
        activated_at=order.activated_at,
    )


def _order_or_404(
    db: Session, order_id: UUID, user: User, *, lock: bool = False
) -> FollowupOrder:
    statement = select(FollowupOrder).where(
            FollowupOrder.id == order_id,
            FollowupOrder.facility_id == user.facility_id,
        )
    if lock:
        statement = statement.with_for_update()
    order = db.scalar(statement)
    if order is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    return order


def _cancel_pending_jobs(db: Session, order: FollowupOrder) -> None:
    jobs = db.scalars(
        select(ReminderJob).where(
            ReminderJob.followup_order_id == order.id,
            ReminderJob.status.in_(PENDING_JOB_STATES),
        )
    ).all()
    for job in jobs:
        job.status = "cancelled"
        job.completed_at = datetime.now(timezone.utc)
        job.claim_token = None
        job.claimed_at = None


def _has_permitted_contact(
    db: Session, patient_id: UUID, channel: str, allow_shared_message: bool
) -> bool:
    now = datetime.now(timezone.utc)
    contacts = db.scalars(
        select(PatientContact)
        .join(
            CommunicationPreference,
            CommunicationPreference.patient_contact_id == PatientContact.id,
        )
        .where(
            PatientContact.patient_id == patient_id,
            PatientContact.is_active.is_(True),
            PatientContact.verified_at.is_not(None),
            PatientContact.channel == channel,
            CommunicationPreference.channel == channel,
            CommunicationPreference.purpose == "appointment_reminder",
            CommunicationPreference.permission_status == "opted_in",
            CommunicationPreference.withdrawn_at.is_(None),
            (CommunicationPreference.expires_at.is_(None))
            | (CommunicationPreference.expires_at > now),
        )
    ).all()
    return any(
        not contact.is_shared or (channel != "voice" and allow_shared_message)
        for contact in contacts
    )


@router.post("/patients", response_model=PatientOut, status_code=201)
def create_patient(
    body: PatientCreate,
    request: Request,
    user: Annotated[User, Depends(require_permission("patient:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> Patient:
    if db.scalar(
        select(Patient.id).where(
            Patient.facility_id == user.facility_id,
            Patient.hospital_patient_identifier == body.hospital_patient_identifier,
        )
    ):
        raise HTTPException(status_code=409, detail={"code": "patient_identifier_exists"})
    patient = Patient(
        facility_id=user.facility_id,
        hospital_patient_identifier=body.hospital_patient_identifier,
        display_name=body.display_name,
        date_of_birth=body.date_of_birth,
        identity_status="verified",
    )
    db.add(patient)
    db.flush()
    record_audit(
        db,
        request,
        user,
        "patient.identity_created",
        "patient",
        patient.id,
        summary={"identifier_added": True, "display_name_present": bool(patient.display_name)},
    )
    return patient


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: UUID,
    user: Annotated[User, Depends(require_permission("patient:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> Patient:
    patient = db.scalar(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.facility_id == user.facility_id,
        )
    )
    if patient is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    return patient


@router.get("/patients", response_model=PatientOut)
def lookup_patient(
    user: Annotated[User, Depends(require_permission("patient:read"))],
    db: Annotated[Session, Depends(get_db)],
    hospital_patient_identifier: str = Query(min_length=1, max_length=120),
) -> Patient:
    patient = db.scalar(
        select(Patient).where(
            Patient.facility_id == user.facility_id,
            Patient.hospital_patient_identifier == hospital_patient_identifier,
            Patient.identity_status == "verified",
        )
    )
    if patient is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    return patient


@router.get("/encounters", response_model=EncounterOut)
def lookup_encounter(
    user: Annotated[User, Depends(require_permission("patient:read"))],
    db: Annotated[Session, Depends(get_db)],
    external_encounter_identifier: str = Query(min_length=1, max_length=120),
) -> Encounter:
    encounter = db.scalar(
        select(Encounter).where(
            Encounter.facility_id == user.facility_id,
            Encounter.external_encounter_identifier == external_encounter_identifier,
        )
    )
    if encounter is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    return encounter


@router.post("/encounters", response_model=EncounterOut, status_code=201)
def create_encounter(
    body: EncounterCreate,
    request: Request,
    user: Annotated[User, Depends(require_permission("patient:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> Encounter:
    patient = db.scalar(
        select(Patient).where(
            Patient.id == body.patient_id,
            Patient.facility_id == user.facility_id,
            Patient.identity_status == "verified",
        )
    )
    clinician = None
    if body.clinician_user_id:
        clinician = db.scalar(
            select(User).where(
                User.id == body.clinician_user_id,
                User.facility_id == user.facility_id,
                User.role == "doctor",
                User.is_active.is_(True),
            )
        )
    if clinician is None:
        clinician = db.scalar(
            select(User).where(
                User.facility_id == user.facility_id,
                User.role == "doctor",
                User.is_active.is_(True),
            )
        )
    if patient is None or clinician is None:
        raise HTTPException(status_code=404, detail={"code": "patient_or_clinician_not_found"})
    encounter_at = to_utc(body.encounter_at)
    if db.scalar(
        select(Encounter.id).where(
            Encounter.facility_id == user.facility_id,
            Encounter.external_encounter_identifier == body.external_encounter_identifier,
        )
    ):
        raise HTTPException(status_code=409, detail={"code": "encounter_identifier_exists"})
    encounter = Encounter(
        facility_id=user.facility_id,
        patient_id=patient.id,
        external_encounter_identifier=body.external_encounter_identifier,
        clinician_user_id=clinician.id,
        encounter_at=encounter_at,
    )
    db.add(encounter)
    db.flush()
    record_audit(
        db,
        request,
        user,
        "encounter.created",
        "encounter",
        encounter.id,
        summary={"patient_id": str(patient.id), "clinician_user_id": str(clinician.id)},
    )
    return encounter


@router.get("/clinicians")
def list_clinicians(
    user: Annotated[User, Depends(require_permission("patient:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict[str, Any]]:
    doctors = db.scalars(
        select(User).where(
            User.facility_id == user.facility_id,
            User.role == "doctor",
            User.is_active.is_(True),
        ).order_by(User.display_name)
    ).all()
    return [
        {
            "id": str(d.id),
            "username": d.username,
            "display_name": d.display_name,
            "department": d.department or "General Medicine",
            "system_identifier": d.system_identifier,
        }
        for d in doctors
    ]


@router.get("/followups", response_model=dict[str, Any])
def list_followups(
    user: Annotated[User, Depends(require_permission("followup:read"))],
    db: Annotated[Session, Depends(get_db)],
    status_filter: Annotated[str | None, Query(alias="status", max_length=40)] = None,
    severity: Annotated[str | None, Query(max_length=16)] = None,
    responsible_doctor: UUID | None = None,
    scheduled_from: datetime | None = None,
    scheduled_to: datetime | None = None,
    overdue: bool | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    statement = select(FollowupOrder).where(FollowupOrder.facility_id == user.facility_id)
    if status_filter:
        allowed = {
            "pending_verification",
            "active",
            "contact_resolution_required",
            "completed",
            "cancelled",
            "superseded",
            "not_required",
        }
        if status_filter not in allowed:
            raise HTTPException(status_code=422, detail={"code": "invalid_status_filter"})
        statement = statement.where(FollowupOrder.status == status_filter)
    if severity:
        if severity not in {"normal", "moderate", "severe"}:
            raise HTTPException(status_code=422, detail={"code": "invalid_severity_filter"})
        statement = statement.where(FollowupOrder.severity == severity)
    if responsible_doctor:
        statement = statement.where(FollowupOrder.created_by_clinician_id == responsible_doctor)
    if scheduled_from:
        statement = statement.where(FollowupOrder.scheduled_at >= to_utc(scheduled_from))
    if scheduled_to:
        statement = statement.where(FollowupOrder.scheduled_at <= to_utc(scheduled_to))
    now = datetime.now(timezone.utc)
    if overdue is True:
        statement = statement.where(
            FollowupOrder.status.in_(ACTIVE_FOLLOWUP_STATES),
            FollowupOrder.scheduled_at < now,
        )
    elif overdue is False:
        statement = statement.where(
            (FollowupOrder.status.not_in(ACTIVE_FOLLOWUP_STATES))
            | (FollowupOrder.scheduled_at >= now)
        )
    orders = db.scalars(
        statement.order_by(FollowupOrder.scheduled_at.asc().nulls_last())
        .limit(limit)
        .offset(offset)
    ).all()
    return {
        "items": [_followup_out(db, order).model_dump(mode="json") for order in orders],
        "limit": limit,
        "offset": offset,
    }


@router.get("/followups/{followup_id}")
def get_followup(
    followup_id: UUID,
    request: Request,
    user: Annotated[User, Depends(require_permission("followup:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    order = _order_or_404(db, followup_id, user)
    record_audit(
        db,
        request,
        user,
        "followup.record_viewed",
        "followup_order",
        order.id,
    )
    jobs = db.scalars(
        select(ReminderJob)
        .where(ReminderJob.followup_order_id == order.id)
        .order_by(ReminderJob.scheduled_at)
    ).all()
    audit_events = db.scalars(
        select(AuditEvent)
        .where(AuditEvent.entity_type == "followup_order", AuditEvent.entity_id == order.id)
        .order_by(AuditEvent.occurred_at.desc())
        .limit(50)
    ).all()
    return {
        "followup": _followup_out(db, order).model_dump(mode="json"),
        "schedule": [
            {
                "id": str(job.id),
                "sequence_no": job.sequence_no,
                "channel": job.channel,
                "action_kind": job.action_kind,
                "scheduled_at": job.scheduled_at.isoformat(),
                "status": job.status,
                "suppression_reason": job.suppression_reason,
            }
            for job in jobs
        ],
        "audit_history": [
            {
                "id": str(event.id),
                "occurred_at": event.occurred_at.isoformat(),
                "actor_user_id": str(event.actor_user_id) if event.actor_user_id else None,
                "action": event.action,
                "reason": event.reason,
                "change_summary": event.change_summary,
            }
            for event in audit_events
        ],
    }


def _rebuild_schedule(
    db: Session,
    order: FollowupOrder,
    request: Request,
    actor: User,
    reason: str,
    old_values: dict[str, Any],
) -> None:
    _cancel_pending_jobs(db, order)
    order.revision += 1
    order.updated_at = datetime.now(timezone.utc)
    db.add(
        FollowupRevision(
            followup_order_id=order.id,
            revision=order.revision,
            severity=order.severity,
            scheduled_at=order.scheduled_at,
            reason=reason,
            changed_by_user_id=actor.id,
        )
    )
    encounter = db.get(Encounter, order.encounter_id)
    policy = db.get(PolicyVersion, order.policy_version_id) if order.policy_version_id else None
    facility = db.get(Facility, actor.facility_id)
    if encounter is None or policy is None or facility is None:
        raise HTTPException(status_code=409, detail={"code": "schedule_dependencies_missing"})
    create_schedule(db, order, encounter, policy, facility.timezone)
    record_audit(
        db,
        request,
        actor,
        "followup.schedule_rebuilt",
        "followup_order",
        order.id,
        reason=reason,
        summary={
            "revision": order.revision,
            "old_severity": old_values.get("severity"),
            "new_severity": order.severity,
            "old_scheduled_at": old_values.get("scheduled_at"),
            "new_scheduled_at": order.scheduled_at.isoformat(),
            "policy_version_id": str(policy.id),
        },
    )


@router.post("/followups/{followup_id}/amendments", response_model=FollowupOut)
def amend_followup(
    followup_id: UUID,
    body: FollowupAmendmentIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("followup:amend"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> FollowupOut | JSONResponse:
    order = _order_or_404(db, followup_id, user, lock=True)
    payload = body.model_dump(mode="json")
    replay = replay_response(db, f"followup-amend:{order.id}", idempotency_key, payload)
    if replay is not None:
        return JSONResponse(status_code=200, content=replay)
    if order.status not in ACTIVE_FOLLOWUP_STATES:
        raise HTTPException(status_code=409, detail={"code": "followup_not_amendable"})
    if order.created_by_clinician_id != user.id:
        raise HTTPException(status_code=403, detail={"code": "only_authoring_clinician_may_amend"})
    if body.expected_revision != order.revision:
        raise HTTPException(status_code=409, detail={"code": "revision_conflict"})
    old = {
        "severity": order.severity,
        "scheduled_at": order.scheduled_at.isoformat() if order.scheduled_at else None,
    }
    order.severity = body.severity.value
    order.scheduled_at = to_utc(body.scheduled_at)
    _rebuild_schedule(db, order, request, user, body.reason, old)
    output = _followup_out(db, order)
    save_idempotent_response(
        db, f"followup-amend:{order.id}", idempotency_key, payload, output.model_dump(mode="json")
    )
    return output


@router.post("/followups/{followup_id}/reschedule", response_model=FollowupOut)
def reschedule_followup(
    followup_id: UUID,
    body: RescheduleIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("followup:amend"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> FollowupOut | JSONResponse:
    order = _order_or_404(db, followup_id, user, lock=True)
    payload = body.model_dump(mode="json")
    replay = replay_response(db, f"followup-reschedule:{order.id}", idempotency_key, payload)
    if replay is not None:
        return JSONResponse(status_code=200, content=replay)
    if order.status not in ACTIVE_FOLLOWUP_STATES:
        raise HTTPException(status_code=409, detail={"code": "followup_not_reschedulable"})
    if order.created_by_clinician_id != user.id:
        raise HTTPException(status_code=403, detail={"code": "only_authoring_clinician_may_reschedule"})
    if body.expected_revision != order.revision:
        raise HTTPException(status_code=409, detail={"code": "revision_conflict"})
    old = {
        "severity": order.severity,
        "scheduled_at": order.scheduled_at.isoformat() if order.scheduled_at else None,
    }
    order.scheduled_at = to_utc(body.scheduled_at)
    _rebuild_schedule(db, order, request, user, body.reason, old)
    output = _followup_out(db, order)
    save_idempotent_response(
        db,
        f"followup-reschedule:{order.id}",
        idempotency_key,
        payload,
        output.model_dump(mode="json"),
    )
    return output


@router.post("/followups/{followup_id}/complete", response_model=FollowupOut)
def complete_followup(
    followup_id: UUID,
    body: CompleteIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("followup:complete"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> FollowupOut | JSONResponse:
    order = _order_or_404(db, followup_id, user, lock=True)
    payload = body.model_dump(mode="json")
    replay = replay_response(db, f"followup-complete:{order.id}", idempotency_key, payload)
    if replay is not None:
        return JSONResponse(status_code=200, content=replay)
    if user.role == "doctor" and order.created_by_clinician_id != user.id:
        raise HTTPException(status_code=403, detail={"code": "only_authoring_clinician_may_complete"})
    if order.status not in ACTIVE_FOLLOWUP_STATES:
        raise HTTPException(status_code=409, detail={"code": "followup_not_completable"})
    completed_at = to_utc(body.completed_at) if body.completed_at else datetime.now(timezone.utc)
    if completed_at < (order.activated_at or order.created_at):
        raise HTTPException(status_code=422, detail={"code": "invalid_completion_time"})
    order.status = "completed"
    order.completed_at = completed_at
    _cancel_pending_jobs(db, order)
    record_audit(
        db,
        request,
        user,
        "followup.completed",
        "followup_order",
        order.id,
        summary={"outcome_category": body.outcome_category},
    )
    output = _followup_out(db, order)
    save_idempotent_response(
        db, f"followup-complete:{order.id}", idempotency_key, payload, output.model_dump(mode="json")
    )
    return output


@router.post("/followups/{followup_id}/cancel", response_model=FollowupOut)
def cancel_followup(
    followup_id: UUID,
    body: CancelIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("followup:cancel"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> FollowupOut | JSONResponse:
    order = _order_or_404(db, followup_id, user, lock=True)
    payload = body.model_dump(mode="json")
    replay = replay_response(db, f"followup-cancel:{order.id}", idempotency_key, payload)
    if replay is not None:
        return JSONResponse(status_code=200, content=replay)
    if user.role == "doctor" and order.created_by_clinician_id != user.id:
        raise HTTPException(status_code=403, detail={"code": "only_authoring_clinician_may_cancel"})
    if order.status not in ACTIVE_FOLLOWUP_STATES:
        raise HTTPException(status_code=409, detail={"code": "followup_not_cancellable"})
    order.status = "cancelled"
    order.cancelled_at = datetime.now(timezone.utc)
    order.cancelled_by_user_id = user.id
    order.cancellation_reason = body.reason
    _cancel_pending_jobs(db, order)
    record_audit(
        db,
        request,
        user,
        "followup.cancelled",
        "followup_order",
        order.id,
        reason=body.reason,
    )
    output = _followup_out(db, order)
    save_idempotent_response(
        db, f"followup-cancel:{order.id}", idempotency_key, payload, output.model_dump(mode="json")
    )
    return output


@router.post("/followups/{followup_id}/resolve-contact", response_model=FollowupOut)
def resolve_followup_contact(
    followup_id: UUID,
    body: ContactResolveIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("contact:resolve"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> FollowupOut | JSONResponse:
    order = _order_or_404(db, followup_id, user, lock=True)
    payload = body.model_dump(mode="json")
    replay = replay_response(db, f"followup-contact-resolution:{order.id}", idempotency_key, payload)
    if replay is not None:
        return JSONResponse(status_code=200, content=replay)
    if order.status != "contact_resolution_required" or not order.followup_required:
        raise HTTPException(status_code=409, detail={"code": "contact_resolution_not_required"})
    policy = db.get(PolicyVersion, order.policy_version_id) if order.policy_version_id else None
    encounter = db.get(Encounter, order.encounter_id)
    facility = db.get(Facility, order.facility_id)
    if policy is None or encounter is None or facility is None or policy.approved_at is None:
        raise HTTPException(status_code=409, detail={"code": "schedule_dependencies_missing"})
    config = policy.config
    actions = config.get("actions", {}).get(order.severity or "", [])
    needs_message = "message" in actions or (
        order.severity == "severe" and config.get("severe_initial_message", True)
    )
    needs_call = "call" in actions
    if needs_message and not _has_permitted_contact(
        db,
        order.patient_id,
        config.get("message_channel", "sms"),
        bool(config.get("allow_shared_neutral_messages", False)),
    ):
        raise HTTPException(
            status_code=409,
            detail={"code": "permitted_message_contact_required"},
        )
    if needs_call and not _has_permitted_contact(db, order.patient_id, "voice", False):
        raise HTTPException(
            status_code=409,
            detail={"code": "private_voice_contact_required"},
        )

    _cancel_pending_jobs(db, order)
    order.revision += 1
    order.contact_resolution_status = "resolved"
    db.add(
        FollowupRevision(
            followup_order_id=order.id,
            revision=order.revision,
            severity=order.severity,
            scheduled_at=order.scheduled_at,
            reason=body.reason,
            changed_by_user_id=user.id,
        )
    )
    unresolved = create_schedule(db, order, encounter, policy, facility.timezone)
    if unresolved:
        raise HTTPException(
            status_code=409,
            detail={"code": "contact_route_still_unresolved"},
        )
    record_audit(
        db,
        request,
        user,
        "followup.contact_resolution_completed",
        "followup_order",
        order.id,
        reason=body.reason,
        summary={"revision": order.revision, "policy_version_id": str(policy.id)},
    )
    output = _followup_out(db, order)
    save_idempotent_response(
        db,
        f"followup-contact-resolution:{order.id}",
        idempotency_key,
        payload,
        output.model_dump(mode="json"),
    )
    return output


@router.post("/followups/{followup_id}/supersede", response_model=FollowupOut)
def supersede_followup(
    followup_id: UUID,
    body: SupersedeIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("followup:amend"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> FollowupOut | JSONResponse:
    order = _order_or_404(db, followup_id, user, lock=True)
    payload = body.model_dump(mode="json")
    replay = replay_response(db, f"followup-supersede:{order.id}", idempotency_key, payload)
    if replay is not None:
        return JSONResponse(status_code=200, content=replay)
    replacement = db.scalar(
        select(FollowupOrder).where(
            FollowupOrder.id == body.replacement_followup_id,
            FollowupOrder.facility_id == user.facility_id,
        )
    )
    if (
        order.status not in ACTIVE_FOLLOWUP_STATES
        or replacement is None
        or replacement.id == order.id
        or replacement.patient_id != order.patient_id
        or replacement.status not in ACTIVE_FOLLOWUP_STATES
        or not replacement.followup_required
    ):
        raise HTTPException(status_code=409, detail={"code": "invalid_supersession"})
    if order.created_by_clinician_id != user.id:
        raise HTTPException(status_code=403, detail={"code": "only_authoring_clinician_may_supersede"})
    order.status = "superseded"
    order.supersedes_followup_id = replacement.id
    _cancel_pending_jobs(db, order)
    record_audit(
        db,
        request,
        user,
        "followup.superseded",
        "followup_order",
        order.id,
        reason=body.reason,
        summary={"replacement_followup_id": str(replacement.id)},
    )
    output = _followup_out(db, order)
    save_idempotent_response(
        db,
        f"followup-supersede:{order.id}",
        idempotency_key,
        payload,
        output.model_dump(mode="json"),
    )
    return output
