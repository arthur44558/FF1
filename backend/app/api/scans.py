import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.core.security import current_user, require_permission
from app.db import get_db
from app.models import (
    ClinicalDecision,
    Encounter,
    Facility,
    FollowupOrder,
    Patient,
    PolicyVersion,
    ReminderJob,
    ScanDocument,
    User,
    VerificationEvent,
)
from app.schemas import ClinicalDecisionIn, ScanOut, VerificationIn, VerificationOut
from app.services.idempotency import replay_response, save_idempotent_response
from app.services.omr import extract_scan
from app.services.scheduling import create_schedule
from app.services.storage import remove_storage_key, resolve_storage_key, validate_and_store
from app.services.time_utils import local_to_utc

router = APIRouter(prefix="/api/v1/scans", tags=["scan intake and verification"])


def _scan_or_404(
    db: Session, scan_id: uuid.UUID, user: User, *, lock: bool = False
) -> ScanDocument:
    statement = select(ScanDocument).where(
            ScanDocument.id == scan_id,
            ScanDocument.facility_id == user.facility_id,
        )
    if lock:
        statement = statement.with_for_update()
    scan = db.scalar(statement)
    if scan is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    return scan


def _scan_out(scan: ScanDocument) -> ScanOut:
    return ScanOut(
        id=scan.id,
        form_identifier=scan.form_identifier,
        form_version=scan.form_version,
        processing_status=scan.processing_status,
        sha256=scan.sha256,
        mime_type=scan.mime_type,
        size_bytes=scan.size_bytes,
        extracted_fields=scan.extracted_fields or {},
        field_confidence=scan.field_confidence or {},
        processing_version=scan.processing_version,
        failure_code=scan.failure_code,
        uploaded_at=scan.uploaded_at,
        processed_at=scan.processed_at,
        reviewed_at=scan.reviewed_at,
    )


@router.post("", response_model=ScanOut, status_code=201)
async def upload_scan(
    request: Request,
    file: Annotated[UploadFile, File()],
    form_identifier: Annotated[str, Form(min_length=1, max_length=120)],
    form_version: Annotated[str, Form(min_length=1, max_length=40)],
    user: Annotated[User, Depends(require_permission("scan:upload"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> ScanOut | JSONResponse:
    storage_key, digest, mime_type, size, _format = await validate_and_store(file)
    request_fingerprint = {
        "form_identifier": form_identifier,
        "form_version": form_version,
        "sha256": digest,
    }
    replay = replay_response(db, f"scan-upload:{user.id}", idempotency_key, request_fingerprint)
    if replay is not None:
        remove_storage_key(storage_key)
        return JSONResponse(status_code=200, content=replay)

    existing = db.scalar(
        select(ScanDocument).where(
            ScanDocument.facility_id == user.facility_id,
            ScanDocument.sha256 == digest,
        )
    )
    if existing:
        remove_storage_key(storage_key)
        result = _scan_out(existing)
        return JSONResponse(status_code=200, content=result.model_dump(mode="json"))
    form_exists = db.scalar(
        select(ScanDocument.id).where(
            ScanDocument.facility_id == user.facility_id,
            ScanDocument.form_identifier == form_identifier,
        )
    )
    if form_exists:
        remove_storage_key(storage_key)
        raise HTTPException(
            status_code=409,
            detail={"code": "form_identifier_exists", "message": "Form identifier is already in use"},
        )

    scan = ScanDocument(
        facility_id=user.facility_id,
        form_identifier=form_identifier,
        form_version=form_version,
        storage_key=storage_key,
        sha256=digest,
        mime_type=mime_type,
        size_bytes=size,
        processing_status="uploaded",
        extracted_fields={},
        field_confidence={},
        submitted_by_user_id=user.id,
    )
    db.add(scan)
    db.flush()
    record_audit(
        db,
        request,
        user,
        "scan.uploaded",
        "scan_document",
        scan.id,
        summary={"form_version": form_version, "sha256": digest, "size_bytes": size},
    )
    output = _scan_out(scan)
    response_body = output.model_dump(mode="json")
    save_idempotent_response(
        db,
        f"scan-upload:{user.id}",
        idempotency_key,
        request_fingerprint,
        response_body,
        201,
    )
    return output


@router.get("/{scan_id}", response_model=ScanOut)
def get_scan(
    scan_id: uuid.UUID,
    user: Annotated[User, Depends(require_permission("scan:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> ScanOut:
    return _scan_out(_scan_or_404(db, scan_id, user))


@router.post("/{scan_id}/process", response_model=ScanOut)
def enqueue_scan_processing(
    scan_id: uuid.UUID,
    request: Request,
    user: Annotated[User, Depends(require_permission("scan:process"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> ScanOut | JSONResponse:
    scan = _scan_or_404(db, scan_id, user)
    request_data = {"scan_id": str(scan.id), "action": "process"}
    replay = replay_response(db, f"scan-process:{user.id}", idempotency_key, request_data)
    if replay is not None:
        return JSONResponse(status_code=200, content=replay)
    if scan.processing_status not in {"uploaded", "processing_failed"}:
        if scan.processing_status == "queued_for_processing":
            return _scan_out(scan)
        raise HTTPException(status_code=409, detail={"code": "scan_not_retryable"})
    scan.processing_status = "queued_for_processing"
    scan.failure_code = None
    record_audit(db, request, user, "scan.processing_queued", "scan_document", scan.id)
    output = _scan_out(scan)
    save_idempotent_response(
        db,
        f"scan-process:{user.id}",
        idempotency_key,
        request_data,
        output.model_dump(mode="json"),
    )
    return output


@router.get("/{scan_id}/review")
def scan_review(
    scan_id: uuid.UUID,
    request: Request,
    user: Annotated[User, Depends(require_permission("scan:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    scan = _scan_or_404(db, scan_id, user)
    record_audit(
        db,
        request,
        user,
        "scan.review_viewed",
        "scan_document",
        scan.id,
    )
    decision = db.scalar(
        select(ClinicalDecision)
        .where(ClinicalDecision.scan_document_id == scan.id)
        .order_by(ClinicalDecision.revision.desc())
        .limit(1)
    )
    return {
        **_scan_out(scan).model_dump(mode="json"),
        "image_endpoint": f"/api/v1/scans/{scan.id}/image",
        "clinical_decision": (
            {
                "revision": decision.revision,
                "followup_required": decision.followup_required,
                "severity": decision.severity,
                "scheduled_at": decision.scheduled_at.isoformat() if decision.scheduled_at else None,
                "timezone": decision.timezone,
                "clinician_user_id": str(decision.clinician_user_id),
            }
            if decision
            else None
        ),
    }


@router.get("/{scan_id}/image")
def scan_image(
    scan_id: uuid.UUID,
    request: Request,
    user: Annotated[User, Depends(require_permission("scan:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> FileResponse:
    scan = _scan_or_404(db, scan_id, user, lock=True)
    record_audit(
        db,
        request,
        user,
        "scan.image_viewed",
        "scan_document",
        scan.id,
    )
    path = resolve_storage_key(scan.storage_key)
    return FileResponse(
        path,
        media_type=scan.mime_type,
        filename=f"scan-{scan.id}",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.post("/{scan_id}/decision")
def record_clinician_decision(
    scan_id: uuid.UUID,
    body: ClinicalDecisionIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("scan:decision"))],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    scan = _scan_or_404(db, scan_id, user, lock=True)
    if scan.processing_status not in {"needs_review", "clarification_required"}:
        raise HTTPException(status_code=409, detail={"code": "scan_not_ready_for_decision"})
    facility = db.get(Facility, user.facility_id)
    if facility is None or body.timezone != facility.timezone:
        raise HTTPException(
            status_code=422,
            detail={"code": "facility_timezone_required", "message": "Decision timezone must match the facility"},
        )
    scheduled_at = (
        local_to_utc(body.scheduled_at_local, body.timezone)
        if body.scheduled_at_local is not None
        else None
    )
    latest_revision = db.scalar(
        select(func.max(ClinicalDecision.revision)).where(
            ClinicalDecision.scan_document_id == scan.id
        )
    ) or 0
    decision = ClinicalDecision(
        scan_document_id=scan.id,
        revision=latest_revision + 1,
        followup_required=body.followup_required,
        severity=body.severity.value if body.severity else None,
        scheduled_at=scheduled_at,
        timezone=body.timezone,
        clinician_user_id=user.id,
    )
    db.add(decision)
    db.flush()
    record_audit(
        db,
        request,
        user,
        "scan.clinical_decision_recorded",
        "scan_document",
        scan.id,
        reason=body.reason,
        summary={
            "decision_revision": decision.revision,
            "followup_required": decision.followup_required,
            "severity": decision.severity,
            "scheduled_at": decision.scheduled_at.isoformat() if decision.scheduled_at else None,
        },
    )
    return {
        "scan_id": scan.id,
        "decision_id": decision.id,
        "revision": decision.revision,
        "followup_required": decision.followup_required,
        "severity": decision.severity,
        "scheduled_at": decision.scheduled_at,
        "timezone": decision.timezone,
        "clinician_user_id": decision.clinician_user_id,
    }


@router.post("/{scan_id}/verification", response_model=VerificationOut)
def verify_scan(
    scan_id: uuid.UUID,
    body: VerificationIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("scan:verify"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> VerificationOut | JSONResponse:
    scan = _scan_or_404(db, scan_id, user, lock=True)
    payload = body.model_dump(mode="json")
    replay = replay_response(db, f"scan-verify:{scan.id}", idempotency_key, payload)
    if replay is not None:
        return JSONResponse(status_code=200, content=replay)
    if scan.processing_status not in {"needs_review", "clarification_required"}:
        raise HTTPException(status_code=409, detail={"code": "scan_not_verifiable"})

    decision = db.scalar(
        select(ClinicalDecision)
        .where(ClinicalDecision.scan_document_id == scan.id)
        .order_by(ClinicalDecision.revision.desc())
        .limit(1)
    )
    if decision is None:
        raise HTTPException(
            status_code=409,
            detail={"code": "clinician_decision_required", "message": "A clinician must authorize the decision first"},
        )

    if body.result in {"clarification_required", "rejected"}:
        scan.processing_status = body.result
        scan.reviewed_by_user_id = user.id
        scan.reviewed_at = datetime.now(timezone.utc)
        event = VerificationEvent(
            scan_document_id=scan.id,
            reviewer_user_id=user.id,
            result=body.result,
            confirmed_fields={},
            correction_summary=body.correction_summary,
            reason=body.reason,
        )
        db.add(event)
        record_audit(
            db,
            request,
            user,
            f"scan.{body.result}",
            "scan_document",
            scan.id,
            reason=body.reason,
            summary={"decision_revision": decision.revision},
        )
        response = VerificationOut(
            scan_id=scan.id,
            scan_status=scan.processing_status,
            message="Scan review recorded",
        )
        save_idempotent_response(
            db,
            f"scan-verify:{scan.id}",
            idempotency_key,
            payload,
            response.model_dump(mode="json"),
        )
        return response

    if body.timezone != decision.timezone:
        raise HTTPException(status_code=422, detail={"code": "decision_timezone_mismatch"})
    facility = db.get(Facility, user.facility_id)
    if facility is None or body.timezone != facility.timezone:
        raise HTTPException(status_code=422, detail={"code": "facility_timezone_required"})
    verified_at = (
        local_to_utc(body.scheduled_at_local, body.timezone)
        if body.scheduled_at_local is not None
        else None
    )
    decision_matches = (
        body.followup_required == decision.followup_required
        and (body.severity.value if body.severity else None) == decision.severity
        and verified_at == decision.scheduled_at
    )
    if not decision_matches:
        reason = "Clinical fields differ from the latest clinician-authorized decision"
        scan.processing_status = "clarification_required"
        scan.reviewed_by_user_id = user.id
        scan.reviewed_at = datetime.now(timezone.utc)
        db.add(
            VerificationEvent(
                scan_document_id=scan.id,
                reviewer_user_id=user.id,
                result="clarification_required",
                confirmed_fields=payload,
                correction_summary=body.correction_summary,
                reason=reason,
            )
        )
        record_audit(
            db,
            request,
            user,
            "scan.clinical_clarification_required",
            "scan_document",
            scan.id,
            reason=reason,
            summary={"decision_revision": decision.revision},
        )
        response = VerificationOut(
            scan_id=scan.id,
            scan_status=scan.processing_status,
            message="Clinical fields differ from the clinician decision and require clarification",
        )
        save_idempotent_response(
            db,
            f"scan-verify:{scan.id}",
            idempotency_key,
            payload,
            response.model_dump(mode="json"),
        )
        return response

    extracted = scan.extracted_fields or {}
    extracted_followup = extracted.get("followup_required")
    extracted_severity = extracted.get("severity")
    extracted_date = extracted.get("appointment_date")
    clinical_omr_conflict = (
        (
            extracted_followup in {"yes", "no"}
            and (extracted_followup == "yes") != decision.followup_required
        )
        or (
            extracted_severity in {"normal", "moderate", "severe"}
            and extracted_severity != decision.severity
        )
    )
    if extracted_date and decision.scheduled_at:
        clinician_local_date = decision.scheduled_at.astimezone(
            ZoneInfo(decision.timezone)
        ).date().isoformat()
        clinical_omr_conflict = clinical_omr_conflict or str(extracted_date)[:10] != clinician_local_date
    if clinical_omr_conflict:
        reason = "Extracted clinical fields conflict with the clinician-authorized decision"
        scan.processing_status = "clarification_required"
        scan.reviewed_by_user_id = user.id
        scan.reviewed_at = datetime.now(timezone.utc)
        db.add(
            VerificationEvent(
                scan_document_id=scan.id,
                reviewer_user_id=user.id,
                result="clarification_required",
                confirmed_fields=payload,
                correction_summary=body.correction_summary,
                reason=reason,
            )
        )
        record_audit(
            db,
            request,
            user,
            "scan.clinical_omr_conflict",
            "scan_document",
            scan.id,
            reason=reason,
            summary={"decision_revision": decision.revision},
        )
        response = VerificationOut(
            scan_id=scan.id,
            scan_status=scan.processing_status,
            message="Extracted clinical fields conflict with the clinician decision",
        )
        save_idempotent_response(
            db,
            f"scan-verify:{scan.id}",
            idempotency_key,
            payload,
            response.model_dump(mode="json"),
        )
        return response

    identity_corrections = [
        field
        for field, submitted in (
            ("patient_identifier", body.patient_identifier),
            ("encounter_identifier", body.encounter_identifier),
        )
        if extracted.get(field) and extracted[field] != submitted
    ]
    missing_correction_record = [
        field
        for field in identity_corrections
        if not body.correction_summary or field not in body.correction_summary
    ]
    if missing_correction_record:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "transcription_correction_record_required",
                "message": "Corrected extracted identity fields require field-level correction details",
            },
        )

    patient = db.scalar(
        select(Patient).where(
            Patient.facility_id == user.facility_id,
            Patient.hospital_patient_identifier == body.patient_identifier,
            Patient.identity_status == "verified",
        )
    )
    encounter = db.scalar(
        select(Encounter).where(
            Encounter.facility_id == user.facility_id,
            Encounter.external_encounter_identifier == body.encounter_identifier,
        )
    )
    if (
        patient is None
        or encounter is None
        or encounter.patient_id != patient.id
        or encounter.clinician_user_id != decision.clinician_user_id
    ):
        reason = "Patient or encounter identity did not match an authorized facility record"
        scan.processing_status = "clarification_required"
        scan.reviewed_by_user_id = user.id
        scan.reviewed_at = datetime.now(timezone.utc)
        db.add(
            VerificationEvent(
                scan_document_id=scan.id,
                reviewer_user_id=user.id,
                result="clarification_required",
                confirmed_fields={"patient_identifier": body.patient_identifier},
                correction_summary=body.correction_summary,
                reason=reason,
            )
        )
        record_audit(
            db,
            request,
            user,
            "scan.identity_clarification_required",
            "scan_document",
            scan.id,
            reason=reason,
        )
        response = VerificationOut(
            scan_id=scan.id,
            scan_status=scan.processing_status,
            message="Identity requires review; no follow-up was activated",
        )
        save_idempotent_response(
            db,
            f"scan-verify:{scan.id}",
            idempotency_key,
            payload,
            response.model_dump(mode="json"),
        )
        return response

    policy: PolicyVersion | None = None
    if decision.followup_required:
        policy = db.scalar(
            select(PolicyVersion).where(
                PolicyVersion.facility_id == user.facility_id,
                PolicyVersion.is_active.is_(True),
                PolicyVersion.approved_at.is_not(None),
                PolicyVersion.effective_from <= datetime.now(timezone.utc),
            )
        )
        if policy is None:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "approved_policy_required",
                    "message": "An approved active reminder policy is required before activation",
                },
            )
        if policy.config.get("timezone", facility.timezone) != facility.timezone:
            raise HTTPException(
                status_code=409,
                detail={"code": "policy_timezone_mismatch", "message": "Active policy timezone must match facility"},
            )

    if db.scalar(
        select(FollowupOrder.id).where(FollowupOrder.source_scan_document_id == scan.id)
    ):
        raise HTTPException(status_code=409, detail={"code": "followup_already_created"})

    order = FollowupOrder(
        facility_id=user.facility_id,
        patient_id=patient.id,
        encounter_id=encounter.id,
        source_scan_document_id=scan.id,
        created_by_clinician_id=decision.clinician_user_id,
        verified_by_user_id=user.id,
        followup_required=decision.followup_required,
        severity=decision.severity,
        scheduled_at=decision.scheduled_at,
        status="pending_verification",
        policy_version_id=policy.id if policy else None,
        contact_resolution_status="not_required",
        revision=1,
        activated_at=datetime.now(timezone.utc) if decision.followup_required else None,
    )
    db.add(order)
    db.flush()
    if decision.followup_required and policy:
        unresolved = create_schedule(db, order, encounter, policy, facility.timezone)
        if unresolved:
            order.contact_resolution_status = "required"
        job_count = db.scalar(
            select(func.count()).select_from(ReminderJob).where(
                ReminderJob.followup_order_id == order.id
            )
        ) or 0
        record_audit(
            db,
            request,
            user,
            "reminder.schedule_created",
            "followup_order",
            order.id,
            summary={
                "policy_version_id": str(policy.id),
                "revision": order.revision,
                "job_count": job_count,
            },
        )
    else:
        order.status = "not_required"

    scan.encounter_id = encounter.id
    scan.processing_status = "verified"
    scan.reviewed_by_user_id = user.id
    scan.reviewed_at = datetime.now(timezone.utc)
    confirmed = {
        "patient_identifier": body.patient_identifier,
        "encounter_identifier": body.encounter_identifier,
        "followup_required": decision.followup_required,
        "scheduled_at": decision.scheduled_at.isoformat() if decision.scheduled_at else None,
        "severity": decision.severity,
        "timezone": decision.timezone,
    }
    db.add(
        VerificationEvent(
            scan_document_id=scan.id,
            reviewer_user_id=user.id,
            result="verified",
            confirmed_fields=confirmed,
            correction_summary=body.correction_summary,
            reason=body.reason,
        )
    )
    record_audit(
        db,
        request,
        user,
        "scan.verified",
        "scan_document",
        scan.id,
        reason=body.reason,
        summary={
            "followup_id": str(order.id),
            "decision_revision": decision.revision,
            "followup_required": decision.followup_required,
        },
    )
    record_audit(
        db,
        request,
        user,
        "followup.activated" if decision.followup_required else "followup.not_required",
        "followup_order",
        order.id,
        summary={
            "status": order.status,
            "severity": order.severity,
            "policy_version_id": str(order.policy_version_id) if order.policy_version_id else None,
        },
    )
    response = VerificationOut(
        scan_id=scan.id,
        scan_status=scan.processing_status,
        followup_id=order.id,
        followup_status=order.status,
        message="Verified follow-up was created" if decision.followup_required else "No-follow-up decision was recorded",
    )
    save_idempotent_response(
        db,
        f"scan-verify:{scan.id}",
        idempotency_key,
        payload,
        response.model_dump(mode="json"),
    )
    return response
