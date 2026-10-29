import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.core.config import settings
from app.core.crypto import mask_destination
from app.core.security import require_permission
from app.db import get_db
from app.models import (
    CommunicationAttempt,
    CommunicationPreference,
    FollowupOrder,
    Patient,
    PatientContact,
    PolicyVersion,
    ProviderWebhookEvent,
    ReminderJob,
    User,
)
from app.schemas import CallOutcomeIn, ReminderOut, RetryReviewIn, WebhookEventIn

router = APIRouter(prefix="/api/v1", tags=["reminder queue and communications"])
ACTIONABLE_STATUSES = {"scheduled", "retry_wait", "call_task_open"}


def _job_or_404(db: Session, job_id: UUID, user: User) -> ReminderJob:
    job = db.scalar(
        select(ReminderJob).where(
            ReminderJob.id == job_id,
            ReminderJob.facility_id == user.facility_id,
        )
    )
    if job is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    return job


def _reminder_out(db: Session, job: ReminderJob) -> ReminderOut:
    order = db.get(FollowupOrder, job.followup_order_id)
    patient = db.get(Patient, order.patient_id) if order else None
    contact = db.get(PatientContact, job.patient_contact_id) if job.patient_contact_id else None
    policy = db.get(PolicyVersion, job.policy_version_id)
    overdue_priority = (
        order.severity
        if order
        and job.suppression_reason == "overdue_followup"
        and policy
        and policy.config.get("overdue_priority_by_severity")
        else None
    )
    return ReminderOut(
        id=job.id,
        followup_order_id=job.followup_order_id,
        patient_identifier=patient.hospital_patient_identifier if patient else "",
        patient_display_name=patient.display_name if patient else None,
        severity=order.severity if order else None,
        followup_scheduled_at=order.scheduled_at if order else None,
        clinician_user_id=order.created_by_clinician_id if order else None,
        sequence_no=job.sequence_no,
        channel=job.channel,
        action_kind=job.action_kind,
        scheduled_at=job.scheduled_at,
        status=job.status,
        attempt_count=job.attempt_count,
        suppression_reason=job.suppression_reason,
        provider_message_id=job.provider_message_id,
        overdue_priority=overdue_priority,
        contact_reference=contact.id if contact else None,
        masked_contact=mask_destination(contact.destination_encrypted) if contact else None,
        script_id=policy.config.get("call_script_id") if policy else None,
    )


@router.get("/reminders/queue", response_model=dict[str, Any])
def reminder_queue(
    user: Annotated[User, Depends(require_permission("reminder:read_queue"))],
    db: Annotated[Session, Depends(get_db)],
    status_filter: str | None = Query(default=None, alias="status", max_length=32),
    scheduled_from: datetime | None = None,
    scheduled_to: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    statement = select(ReminderJob).where(ReminderJob.facility_id == user.facility_id)
    if status_filter:
        if status_filter not in ACTIONABLE_STATUSES | {"completed", "suppressed", "cancelled", "send_unknown"}:
            raise HTTPException(status_code=422, detail={"code": "invalid_reminder_status"})
        statement = statement.where(ReminderJob.status == status_filter)
    else:
        statement = statement.where(
            ReminderJob.status.in_(ACTIONABLE_STATUSES),
            ReminderJob.scheduled_at <= datetime.now(timezone.utc),
        )
    if scheduled_from:
        statement = statement.where(ReminderJob.scheduled_at >= scheduled_from)
    if scheduled_to:
        statement = statement.where(ReminderJob.scheduled_at <= scheduled_to)
    jobs = db.scalars(
        statement.order_by(ReminderJob.scheduled_at.asc()).limit(limit).offset(offset)
    ).all()
    return {
        "items": [_reminder_out(db, job).model_dump(mode="json") for job in jobs],
        "limit": limit,
        "offset": offset,
    }


@router.get("/reminders/{job_id}")
def get_reminder(
    job_id: UUID,
    user: Annotated[User, Depends(require_permission("reminder:read_queue"))],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    job = _job_or_404(db, job_id, user)
    attempts = db.scalars(
        select(CommunicationAttempt)
        .where(CommunicationAttempt.reminder_job_id == job.id)
        .order_by(CommunicationAttempt.attempt_no)
    ).all()
    return {
        "reminder": _reminder_out(db, job).model_dump(mode="json"),
        "attempts": [
            {
                "attempt_no": item.attempt_no,
                "channel": item.channel,
                "started_at": item.started_at.isoformat(),
                "finished_at": item.finished_at.isoformat() if item.finished_at else None,
                "result": item.result,
                "provider_reference": item.provider_reference,
                "staff_user_id": str(item.staff_user_id) if item.staff_user_id else None,
                "error_code": item.error_code,
                "safe_result_notes": item.safe_result_notes,
            }
            for item in attempts
        ],
    }


@router.post("/reminders/{job_id}/call-outcomes")
def record_call_outcome(
    job_id: UUID,
    body: CallOutcomeIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("reminder:record_call"))],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    job = _job_or_404(db, job_id, user)
    if job.action_kind != "create_call_task" or job.status != "call_task_open":
        raise HTTPException(status_code=409, detail={"code": "call_task_not_open"})
    contact = db.get(PatientContact, job.patient_contact_id) if job.patient_contact_id else None
    if contact and contact.is_shared and body.result != "shared_contact_blocked":
        raise HTTPException(status_code=409, detail={"code": "shared_contact_call_blocked"})
    if body.result == "shared_contact_blocked" and contact and not contact.is_shared:
        contact.is_shared = True
        contact.sharing_status_source = "staff_reported_shared_contact"

    max_attempt = db.scalar(
        select(CommunicationAttempt.attempt_no)
        .where(CommunicationAttempt.reminder_job_id == job.id)
        .order_by(CommunicationAttempt.attempt_no.desc())
        .limit(1)
    ) or 0
    occurred_at = body.occurred_at or datetime.now(timezone.utc)
    if occurred_at.tzinfo is None:
        raise HTTPException(status_code=422, detail={"code": "timezone_required"})
    db.add(
        CommunicationAttempt(
            reminder_job_id=job.id,
            attempt_no=max_attempt + 1,
            channel="staff_call",
            result=body.result,
            staff_user_id=user.id,
            safe_result_notes=body.safe_result_notes,
            started_at=occurred_at,
            finished_at=datetime.now(timezone.utc),
        )
    )
    job.status = "completed"
    job.completed_at = datetime.now(timezone.utc)
    followup = db.get(FollowupOrder, job.followup_order_id)
    if body.result in {"declined_messages", "contact_details_invalid"} and contact:
        if body.result == "contact_details_invalid":
            contact.is_active = False
            contact.verified_at = None
        affected_channels = (
            [contact.channel]
            if body.result == "contact_details_invalid"
            else ["sms", "whatsapp"]
        )
        patient_contacts = db.scalars(
            select(PatientContact).where(PatientContact.patient_id == contact.patient_id)
        ).all()
        for affected_contact in patient_contacts:
            if affected_contact.channel not in affected_channels:
                continue
            preference = db.scalar(
                select(CommunicationPreference).where(
                    CommunicationPreference.patient_contact_id == affected_contact.id,
                    CommunicationPreference.channel == affected_contact.channel,
                    CommunicationPreference.purpose == "appointment_reminder",
                )
            )
            if preference is None:
                preference = CommunicationPreference(
                    patient_contact_id=affected_contact.id,
                    channel=affected_contact.channel,
                    purpose="appointment_reminder",
                )
                db.add(preference)
            preference.permission_status = (
                "opted_out" if body.result == "declined_messages" else "not_permitted"
            )
            preference.withdrawn_at = datetime.now(timezone.utc)
            preference.captured_at = datetime.now(timezone.utc)
            preference.captured_by_user_id = user.id
            for pending in db.scalars(
                select(ReminderJob).where(
                    ReminderJob.patient_contact_id == affected_contact.id,
                    ReminderJob.channel == affected_contact.channel,
                    ReminderJob.status.in_(["scheduled", "claimed", "retry_wait"]),
                )
            ).all():
                pending.status = "suppressed"
                pending.suppression_reason = (
                    "opt_out" if body.result == "declined_messages" else "contact_invalid"
                )
                pending.completed_at = datetime.now(timezone.utc)
                pending.claim_token = None
                pending.claimed_at = None
    if body.result in {"requested_reschedule", "escalated_to_clinician", "other_review_required"} and followup:
        key = f"staff-review:{followup.id}:{followup.revision}:{job.id}"
        if not db.scalar(select(ReminderJob.id).where(ReminderJob.idempotency_key == key)):
            db.add(
                ReminderJob(
                    facility_id=followup.facility_id,
                    followup_order_id=followup.id,
                    policy_version_id=followup.policy_version_id,
                    sequence_no=12000 + followup.revision,
                    channel="staff_call",
                    action_kind="create_call_task",
                    scheduled_at=datetime.now(timezone.utc),
                    status="call_task_open",
                    idempotency_key=key,
                    suppression_reason=f"staff_review:{body.result}",
                )
            )
    record_audit(
        db,
        request,
        user,
        "reminder.call_outcome_recorded",
        "reminder_job",
        job.id,
        summary={"result": body.result, "attempt_no": max_attempt + 1},
    )
    return {"job_id": job.id, "status": job.status, "result": body.result}


@router.post("/reminders/{job_id}/retry-review")
def retry_review(
    job_id: UUID,
    body: RetryReviewIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("reminder:retry_review"))],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    job = _job_or_404(db, job_id, user)
    if job.status not in {"send_unknown", "failed_terminal"} or job.action_kind != "send_message":
        raise HTTPException(status_code=409, detail={"code": "reminder_not_reviewable"})
    if body.decision == "retry":
        if job.status == "send_unknown" and not body.confirmed_not_sent:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "unknown_send_requires_reconciliation",
                    "message": "Confirm that provider reconciliation found no accepted send",
                },
            )
        job.status = "scheduled"
        job.scheduled_at = datetime.now(timezone.utc)
        job.next_retry_at = None
        job.last_error_code = None
        job.suppression_reason = None
        job.completed_at = None
    else:
        job.status = "suppressed"
        job.suppression_reason = "supervisor_suppressed"
        job.completed_at = datetime.now(timezone.utc)
    record_audit(
        db,
        request,
        user,
        "reminder.retry_reviewed",
        "reminder_job",
        job.id,
        reason=body.reason,
        summary={
            "decision": body.decision,
            "confirmed_not_sent": body.confirmed_not_sent,
            "attempt_count": job.attempt_count,
        },
    )
    return {"job_id": job.id, "status": job.status}


@router.post("/provider-webhooks/{provider_name}")
async def provider_webhook(
    provider_name: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    signature: Annotated[str | None, Header(alias="X-Provider-Signature")] = None,
    timestamp: Annotated[str | None, Header(alias="X-Provider-Timestamp")] = None,
) -> dict[str, Any]:
    if provider_name != "fake":
        raise HTTPException(status_code=404, detail={"code": "provider_not_supported"})
    if not settings.provider_webhook_secret:
        raise HTTPException(status_code=503, detail={"code": "webhook_disabled"})
    if not signature or not timestamp:
        raise HTTPException(status_code=401, detail={"code": "signature_required"})
    try:
        timestamp_number = int(timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail={"code": "signature_invalid"}) from exc
    if abs(time.time() - timestamp_number) > 300:
        raise HTTPException(status_code=401, detail={"code": "webhook_timestamp_expired"})
    body_bytes = await request.body()
    signed_content = timestamp.encode("ascii") + b"." + body_bytes
    expected = hmac.new(
        settings.provider_webhook_secret.encode("utf-8"),
        signed_content,
        hashlib.sha256,
    ).hexdigest()
    received = signature.removeprefix("sha256=")
    if not hmac.compare_digest(expected, received):
        raise HTTPException(status_code=401, detail={"code": "signature_invalid"})
    try:
        event = WebhookEventIn.model_validate_json(body_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"code": "invalid_webhook_payload"}) from exc
    if db.scalar(
        select(ProviderWebhookEvent.id).where(
            ProviderWebhookEvent.provider_event_id == event.event_id
        )
    ):
        return {"accepted": True, "duplicate": True}
    job = db.scalar(
        select(ReminderJob).where(ReminderJob.provider_message_id == event.message_id)
    )
    if job is None:
        raise HTTPException(status_code=404, detail={"code": "provider_message_not_found"})
    db.add(
        ProviderWebhookEvent(
            provider_event_id=event.event_id,
            provider_message_id=event.message_id,
            status=event.status,
        )
    )
    if job.status not in {"cancelled", "suppressed"}:
        if event.status == "delivered" and job.status in {"sent", "delivered"}:
            job.status = "delivered"
        elif event.status == "failed" and job.status in {"sent", "delivered"}:
            job.status = "failed_terminal"
            job.last_error_code = "provider_reported_failure"
    request.state.facility_id = job.facility_id
    record_audit(
        db,
        request,
        None,
        "provider.webhook_processed",
        "reminder_job",
        job.id,
        summary={"event_id": event.event_id, "status": event.status},
    )
    return {"accepted": True, "duplicate": False}
