from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.core.crypto import (
    destination_fingerprint,
    encrypt_destination,
    mask_destination,
    normalize_phone,
)
from app.core.security import require_permission
from app.db import get_db
from app.models import (
    CommunicationPreference,
    Patient,
    PatientContact,
    ReminderJob,
    User,
)
from app.schemas import (
    ContactCreate,
    ContactOut,
    ContactPatch,
    ContactRevealIn,
    OptOutIn,
    PreferenceIn,
    PreferenceOut,
)

router = APIRouter(prefix="/api/v1", tags=["contacts and preferences"])


def _patient_or_404(db: Session, patient_id: UUID, user: User) -> Patient:
    patient = db.scalar(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.facility_id == user.facility_id,
        )
    )
    if patient is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    return patient


def _contact_or_404(db: Session, contact_id: UUID, user: User) -> PatientContact:
    contact = db.get(PatientContact, contact_id)
    if contact is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    _patient_or_404(db, contact.patient_id, user)
    return contact


def _preferences(db: Session, contact_id: UUID) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(CommunicationPreference)
        .where(CommunicationPreference.patient_contact_id == contact_id)
        .order_by(CommunicationPreference.purpose, CommunicationPreference.channel)
    ).all()
    return [
        PreferenceOut(
            id=row.id,
            channel=row.channel,
            purpose=row.purpose,
            permission_status=row.permission_status,
            evidence_type=row.evidence_type,
            evidence_reference=row.evidence_reference,
            captured_at=row.captured_at,
            expires_at=row.expires_at,
        ).model_dump(mode="json")
        for row in rows
    ]


@router.get("/patients/{patient_id}/contacts", response_model=list[ContactOut])
def list_contacts(
    patient_id: UUID,
    user: Annotated[User, Depends(require_permission("contact:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> list[ContactOut]:
    _patient_or_404(db, patient_id, user)
    contacts = db.scalars(
        select(PatientContact)
        .where(PatientContact.patient_id == patient_id)
        .order_by(PatientContact.created_at)
    ).all()
    return [
        ContactOut(
            id=contact.id,
            channel=contact.channel,
            masked_destination=mask_destination(contact.destination_encrypted),
            verified_at=contact.verified_at,
            is_shared=contact.is_shared,
            sharing_status_source=contact.sharing_status_source,
            is_active=contact.is_active,
            preferences=_preferences(db, contact.id),
        )
        for contact in contacts
    ]


@router.post("/patients/{patient_id}/contacts", response_model=ContactOut, status_code=201)
def create_contact(
    patient_id: UUID,
    body: ContactCreate,
    request: Request,
    user: Annotated[User, Depends(require_permission("contact:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> ContactOut:
    patient = _patient_or_404(db, patient_id, user)
    if not body.sharing_status_source:
        raise HTTPException(
            status_code=422,
            detail={"code": "sharing_evidence_required", "message": "Record how shared status was established"},
        )
    if body.verified and not body.verification_source:
        raise HTTPException(
            status_code=422,
            detail={"code": "verification_evidence_required", "message": "Record how the contact was verified"},
        )
    destination = normalize_phone(body.destination)
    fingerprint = destination_fingerprint(destination)
    duplicate = db.scalar(
        select(PatientContact.id).where(
            PatientContact.patient_id == patient.id,
            PatientContact.channel == body.channel.value,
            PatientContact.destination_fingerprint == fingerprint,
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail={"code": "contact_already_registered"})
    contact = PatientContact(
        patient_id=patient.id,
        channel=body.channel.value,
        destination_encrypted=encrypt_destination(destination),
        destination_fingerprint=fingerprint,
        verified_at=datetime.now(timezone.utc) if body.verified else None,
        is_shared=body.is_shared,
        sharing_status_source=body.sharing_status_source,
        is_active=True,
    )
    db.add(contact)
    db.flush()
    db.add(
        CommunicationPreference(
            patient_contact_id=contact.id,
            purpose="appointment_reminder",
            channel=body.channel.value,
            permission_status="unknown",
        )
    )
    record_audit(
        db,
        request,
        user,
        "contact.created",
        "patient_contact",
        contact.id,
        summary={
            "patient_id": str(patient.id),
            "channel": contact.channel,
            "shared": contact.is_shared,
            "verified": bool(contact.verified_at),
        },
    )
    return ContactOut(
        id=contact.id,
        channel=contact.channel,
        masked_destination=mask_destination(contact.destination_encrypted),
        verified_at=contact.verified_at,
        is_shared=contact.is_shared,
        sharing_status_source=contact.sharing_status_source,
        is_active=contact.is_active,
        preferences=_preferences(db, contact.id),
    )


@router.post("/contacts/{contact_id}/reveal")
def reveal_contact(
    contact_id: UUID,
    body: ContactRevealIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("contact:reveal"))],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    contact = _contact_or_404(db, contact_id, user)
    if not contact.is_active or contact.verified_at is None:
        raise HTTPException(status_code=409, detail={"code": "contact_not_verified"})
    if contact.channel != "voice":
        raise HTTPException(status_code=409, detail={"code": "voice_contact_required"})
    if contact.is_shared:
        raise HTTPException(status_code=409, detail={"code": "shared_voice_contact_blocked"})
    preference = db.scalar(
        select(CommunicationPreference).where(
            CommunicationPreference.patient_contact_id == contact.id,
            CommunicationPreference.channel == contact.channel,
            CommunicationPreference.purpose == "appointment_reminder",
        )
    )
    if (
        preference is None
        or preference.permission_status != "opted_in"
        or preference.withdrawn_at is not None
        or (preference.expires_at and preference.expires_at <= datetime.now(timezone.utc))
    ):
        raise HTTPException(status_code=403, detail={"code": "contact_permission_required"})
    from app.core.crypto import decrypt_destination

    record_audit(
        db,
        request,
        user,
        "contact.destination_revealed",
        "patient_contact",
        contact.id,
        reason=body.reason,
        summary={"channel": contact.channel},
    )
    return {
        "contact_id": contact.id,
        "channel": contact.channel,
        "destination": decrypt_destination(contact.destination_encrypted),
        "is_shared": contact.is_shared,
        "verified_at": contact.verified_at,
    }


@router.patch("/contacts/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: UUID,
    body: ContactPatch,
    request: Request,
    user: Annotated[User, Depends(require_permission("contact:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> ContactOut:
    contact = _contact_or_404(db, contact_id, user)
    changes: dict[str, Any] = {}
    if body.is_shared is not None and body.is_shared != contact.is_shared:
        if not body.sharing_status_source:
            raise HTTPException(
                status_code=422,
                detail={"code": "sharing_evidence_required", "message": "A shared-status change needs evidence"},
            )
        contact.is_shared = body.is_shared
        contact.sharing_status_source = body.sharing_status_source
        changes["is_shared"] = body.is_shared
    if body.verified is True and contact.verified_at is None:
        if not body.verification_source:
            raise HTTPException(
                status_code=422,
                detail={"code": "verification_evidence_required", "message": "Contact verification needs evidence"},
            )
        contact.verified_at = datetime.now(timezone.utc)
        changes["verified"] = True
    elif body.verified is False and contact.verified_at is not None:
        contact.verified_at = None
        changes["verified"] = False
    if body.is_active is not None and body.is_active != contact.is_active:
        if body.is_active and not body.verification_source:
            raise HTTPException(
                status_code=422,
                detail={"code": "verification_evidence_required", "message": "Reactivating a contact needs verification"},
            )
        contact.is_active = body.is_active
        changes["is_active"] = body.is_active
    if body.is_active is False or body.verified is False:
        jobs = db.scalars(
            select(ReminderJob).where(
                ReminderJob.patient_contact_id == contact.id,
                ReminderJob.status.in_(["scheduled", "claimed", "retry_wait"]),
            )
        ).all()
        for job in jobs:
            job.status = "suppressed"
            job.suppression_reason = "contact_inactive_or_unverified"
            job.completed_at = datetime.now(timezone.utc)
            job.claim_token = None
            job.claimed_at = None
    record_audit(
        db,
        request,
        user,
        "contact.updated",
        "patient_contact",
        contact.id,
        reason=body.reason,
        summary=changes,
    )
    return ContactOut(
        id=contact.id,
        channel=contact.channel,
        masked_destination=mask_destination(contact.destination_encrypted),
        verified_at=contact.verified_at,
        is_shared=contact.is_shared,
        sharing_status_source=contact.sharing_status_source,
        is_active=contact.is_active,
        preferences=_preferences(db, contact.id),
    )


@router.post("/contacts/{contact_id}/preferences", response_model=PreferenceOut)
def set_preference(
    contact_id: UUID,
    body: PreferenceIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("contact:manage_preferences"))],
    db: Annotated[Session, Depends(get_db)],
) -> PreferenceOut:
    contact = _contact_or_404(db, contact_id, user)
    if body.channel.value != contact.channel:
        raise HTTPException(status_code=422, detail={"code": "contact_channel_mismatch"})
    preference = db.scalar(
        select(CommunicationPreference).where(
            CommunicationPreference.patient_contact_id == contact.id,
            CommunicationPreference.purpose == body.purpose,
            CommunicationPreference.channel == body.channel.value,
        )
    )
    if preference is None:
        preference = CommunicationPreference(
            patient_contact_id=contact.id,
            purpose=body.purpose,
            channel=body.channel.value,
            permission_status="unknown",
        )
        db.add(preference)
    preference.permission_status = body.permission_status.value
    preference.evidence_type = body.evidence_type
    preference.evidence_reference = body.evidence_reference
    preference.captured_by_user_id = user.id
    preference.captured_at = datetime.now(timezone.utc)
    preference.expires_at = body.expires_at
    preference.withdrawn_at = (
        datetime.now(timezone.utc) if body.permission_status.value == "opted_out" else None
    )
    if body.permission_status.value != "opted_in":
        jobs = db.scalars(
            select(ReminderJob).where(
                ReminderJob.patient_contact_id == contact.id,
                ReminderJob.channel == body.channel.value,
                ReminderJob.status.in_(["scheduled", "claimed", "retry_wait"]),
            )
        ).all()
        for job in jobs:
            job.status = "suppressed"
            job.suppression_reason = f"permission_{body.permission_status.value}"
            job.completed_at = datetime.now(timezone.utc)
            job.claim_token = None
            job.claimed_at = None
    record_audit(
        db,
        request,
        user,
        "contact.preference_changed",
        "patient_contact",
        contact.id,
        summary={
            "channel": body.channel.value,
            "purpose": body.purpose,
            "permission_status": body.permission_status.value,
            "evidence_type": body.evidence_type,
        },
    )
    return PreferenceOut(
        id=preference.id,
        channel=preference.channel,
        purpose=preference.purpose,
        permission_status=preference.permission_status,
        evidence_type=preference.evidence_type,
        evidence_reference=preference.evidence_reference,
        captured_at=preference.captured_at,
        expires_at=preference.expires_at,
    )


@router.post("/contacts/{contact_id}/opt-out", response_model=PreferenceOut)
def opt_out_contact(
    contact_id: UUID,
    body: OptOutIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("contact:manage_preferences"))],
    db: Annotated[Session, Depends(get_db)],
) -> PreferenceOut:
    contact = _contact_or_404(db, contact_id, user)
    if body.channel.value != contact.channel:
        raise HTTPException(status_code=422, detail={"code": "contact_channel_mismatch"})
    preference = db.scalar(
        select(CommunicationPreference).where(
            CommunicationPreference.patient_contact_id == contact.id,
            CommunicationPreference.purpose == body.purpose,
            CommunicationPreference.channel == body.channel.value,
        )
    )
    if preference is None:
        preference = CommunicationPreference(
            patient_contact_id=contact.id,
            purpose=body.purpose,
            channel=body.channel.value,
            permission_status="opted_out",
        )
        db.add(preference)
    preference.permission_status = "opted_out"
    preference.evidence_type = "staff_recorded_opt_out"
    preference.evidence_reference = body.evidence_reference
    preference.captured_by_user_id = user.id
    preference.captured_at = datetime.now(timezone.utc)
    preference.withdrawn_at = datetime.now(timezone.utc)
    jobs = db.scalars(
        select(ReminderJob).where(
            ReminderJob.patient_contact_id == contact.id,
            ReminderJob.channel == body.channel.value,
            ReminderJob.status.in_(["scheduled", "claimed", "retry_wait"]),
        )
    ).all()
    for job in jobs:
        job.status = "suppressed"
        job.suppression_reason = "opt_out"
        job.completed_at = datetime.now(timezone.utc)
        job.claim_token = None
        job.claimed_at = None
    record_audit(
        db,
        request,
        user,
        "contact.opted_out",
        "patient_contact",
        contact.id,
        reason=body.reason,
        summary={"channel": body.channel.value, "purpose": body.purpose, "suppressed_jobs": len(jobs)},
    )
    return PreferenceOut(
        id=preference.id,
        channel=preference.channel,
        purpose=preference.purpose,
        permission_status=preference.permission_status,
        evidence_type=preference.evidence_type,
        evidence_reference=preference.evidence_reference,
        captured_at=preference.captured_at,
        expires_at=preference.expires_at,
    )
