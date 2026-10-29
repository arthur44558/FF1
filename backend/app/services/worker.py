import asyncio
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import decrypt_destination
from app.db import SessionLocal
from app.models import (
    AuditEvent,
    CommunicationAttempt,
    CommunicationPreference,
    Encounter,
    Facility,
    FollowupOrder,
    PatientContact,
    PolicyVersion,
    ProviderWebhookEvent,
    ReminderJob,
    ScanDocument,
    utc_now,
)
from app.services.omr import extract_scan
from app.services.providers import FakeMessagingProvider, ProviderSendError
from app.services.storage import resolve_storage_key

logger = logging.getLogger("hospital_followup.worker")
provider = FakeMessagingProvider()


def _audit_worker(
    db: Session,
    facility_id: uuid.UUID,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    summary: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditEvent(
            facility_id=facility_id,
            actor_type="service",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            change_summary=summary,
        )
    )


def process_one_scan() -> bool:
    with SessionLocal() as db:
        scan = db.scalar(
            select(ScanDocument)
            .where(ScanDocument.processing_status == "queued_for_processing")
            .order_by(ScanDocument.uploaded_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if scan is None:
            return False
        scan.processing_status = "processing"
        scan.failure_code = None
        db.commit()
        scan_id = scan.id
        storage_key = scan.storage_key
        form_version = scan.form_version

    try:
        output = extract_scan(
            resolve_storage_key(storage_key),
            settings.form_templates_path,
            form_version,
        )
    except Exception:
        logger.error("Scan extraction failed", extra={"scan_id": str(scan_id)})
        output = {
            "fields": {},
            "confidence": {},
            "processing_version": "omr-fixed-layout-1",
            "status": "processing_failed",
            "failure_code": "scan_processing_error",
        }

    with SessionLocal() as db:
        scan = db.get(ScanDocument, scan_id)
        if scan is None or scan.processing_status != "processing":
            return True
        scan.extracted_fields = output["fields"]
        scan.field_confidence = output["confidence"]
        scan.processing_version = output["processing_version"]
        scan.processing_status = output["status"]
        scan.failure_code = output["failure_code"]
        scan.processed_at = utc_now()
        _audit_worker(
            db,
            scan.facility_id,
            "scan.processing_finished",
            "scan_document",
            scan.id,
            {"status": scan.processing_status, "failure_code": scan.failure_code},
        )
        db.commit()
    return True


def _suppress(db: Session, job: ReminderJob, reason: str) -> None:
    job.status = "suppressed"
    job.suppression_reason = reason[:160]
    job.completed_at = utc_now()
    job.claim_token = None
    job.claimed_at = None
    last_attempt = db.scalar(
        select(CommunicationAttempt.attempt_no)
        .where(CommunicationAttempt.reminder_job_id == job.id)
        .order_by(CommunicationAttempt.attempt_no.desc())
        .limit(1)
    ) or 0
    db.add(
        CommunicationAttempt(
            reminder_job_id=job.id,
            attempt_no=last_attempt + 1,
            channel=job.channel,
            result="suppressed",
            error_code=reason[:100],
            finished_at=utc_now(),
        )
    )
    _audit_worker(
        db,
        job.facility_id,
        "reminder.suppressed",
        "reminder_job",
        job.id,
        {"reason": reason[:100]},
    )


def _preference_is_permitted(db: Session, contact: PatientContact, channel: str) -> bool:
    preference = db.scalar(
        select(CommunicationPreference).where(
            CommunicationPreference.patient_contact_id == contact.id,
            CommunicationPreference.channel == channel,
            CommunicationPreference.purpose == "appointment_reminder",
        )
    )
    if not contact.is_active or contact.verified_at is None:
        return False
    if channel == "voice" and contact.is_shared:
        return False
    if (
        preference is None
        or preference.permission_status != "opted_in"
        or preference.withdrawn_at is not None
    ):
        return False
    return preference.expires_at is None or preference.expires_at > utc_now()


def _local_allowed_now(policy: PolicyVersion, facility: Facility, now: datetime) -> bool:
    config = policy.config
    zone = ZoneInfo(config.get("timezone") or facility.timezone)
    local = now.astimezone(zone)
    start_h, start_m = (int(value) for value in config.get("allowed_start", "09:00").split(":"))
    end_h, end_m = (int(value) for value in config.get("allowed_end", "17:00").split(":"))
    clock = local.timetz().replace(tzinfo=None)
    return time_in_range(clock, start_h, start_m, end_h, end_m)


def time_in_range(value, start_h: int, start_m: int, end_h: int, end_m: int) -> bool:
    minute = value.hour * 60 + value.minute
    return start_h * 60 + start_m <= minute < end_h * 60 + end_m


def _defer_to_next_allowed(
    job: ReminderJob,
    followup: FollowupOrder,
    policy: PolicyVersion,
    facility: Facility,
) -> bool:
    zone = ZoneInfo(policy.config.get("timezone") or facility.timezone)
    local = utc_now().astimezone(zone)
    start_h, start_m = (int(value) for value in policy.config.get("allowed_start", "09:00").split(":"))
    candidate = local.replace(hour=start_h, minute=start_m, second=0, microsecond=0)
    if candidate <= local:
        candidate += timedelta(days=1)
    if followup.scheduled_at is None or candidate.astimezone(timezone.utc) >= followup.scheduled_at:
        return False
    job.status = "scheduled"
    job.scheduled_at = candidate.astimezone(timezone.utc)
    job.claim_token = None
    job.claimed_at = None
    return True


def _create_staff_review_task(
    db: Session, source_job: ReminderJob, followup: FollowupOrder, reason: str
) -> None:
    key = f"review:{source_job.id}:{reason}"
    if db.scalar(select(ReminderJob.id).where(ReminderJob.idempotency_key == key)):
        return
    task = ReminderJob(
        id=uuid.uuid4(),
        facility_id=source_job.facility_id,
        followup_order_id=followup.id,
        policy_version_id=source_job.policy_version_id,
        sequence_no=13000 + followup.revision,
        channel="staff_call",
        action_kind="create_call_task",
        scheduled_at=utc_now(),
        status="call_task_open",
        idempotency_key=key,
        suppression_reason=reason,
    )
    db.add(task)
    _audit_worker(
        db,
        task.facility_id,
        "reminder.staff_review_task_created",
        "reminder_job",
        task.id,
        {"followup_id": str(followup.id), "reason": reason},
    )


def _make_due_call_task(db: Session, job: ReminderJob, followup: FollowupOrder) -> None:
    contact = db.get(PatientContact, job.patient_contact_id) if job.patient_contact_id else None
    if contact is not None and not _preference_is_permitted(db, contact, "voice"):
        job.patient_contact_id = None
        job.suppression_reason = "contact_resolution_required"
    if job.patient_contact_id is None or job.suppression_reason == "contact_resolution_required":
        followup.status = "contact_resolution_required"
        followup.contact_resolution_status = "required"
    job.status = "call_task_open"
    job.claim_token = None
    job.claimed_at = None
    job.completed_at = None


async def _process_claimed_job(job_id: uuid.UUID, claim_token: uuid.UUID) -> None:
    with SessionLocal() as db:
        job = db.get(ReminderJob, job_id)
        if job is None or job.claim_token != claim_token or job.status != "claimed":
            return
        followup = db.get(FollowupOrder, job.followup_order_id)
        policy = db.get(PolicyVersion, job.policy_version_id)
        facility = db.get(Facility, job.facility_id)
        if (
            followup is None
            or followup.status not in {"active", "contact_resolution_required"}
            or not followup.followup_required
        ):
            _suppress(db, job, "followup_inactive")
            db.commit()
            return
        if policy is None or facility is None or policy.approved_at is None:
            _suppress(db, job, "policy_unavailable")
            db.commit()
            return

        db.refresh(job)
        if job.status != "claimed" or job.claim_token != claim_token:
            db.rollback()
            return
        db.refresh(followup)
        if followup.status not in {"active", "contact_resolution_required"}:
            _suppress(db, job, "followup_inactive")
            db.commit()
            return

        if job.action_kind == "create_call_task":
            _make_due_call_task(db, job, followup)
            _audit_worker(
                db,
                job.facility_id,
                "reminder.call_task_opened",
                "reminder_job",
                job.id,
                {"contact_resolution_required": job.suppression_reason == "contact_resolution_required"},
            )
            db.commit()
            return

        contact = db.get(PatientContact, job.patient_contact_id) if job.patient_contact_id else None
        if contact is None:
            _suppress(db, job, "contact_unavailable")
            db.commit()
            return
        if not _preference_is_permitted(db, contact, job.channel):
            _suppress(db, job, "contact_permission_revoked")
            db.commit()
            return
        if contact.is_shared and not policy.config.get("allow_shared_neutral_messages", False):
            _suppress(db, job, "shared_contact_not_allowed")
            db.commit()
            return
        if not settings.outbound_messaging_enabled:
            _suppress(db, job, "outbound_disabled")
            db.commit()
            return
        if not (
            policy.config.get("provider_policy_reviewed")
            and policy.config.get("message_content_approval_reference")
            and policy.config.get("template_id")
        ):
            _suppress(db, job, "message_policy_not_approved")
            db.commit()
            return
        if not _local_allowed_now(policy, facility, utc_now()):
            if _defer_to_next_allowed(job, followup, policy, facility):
                db.commit()
                return
            _suppress(db, job, "quiet_hours_deadline_passed")
            _create_staff_review_task(db, job, followup, "quiet_hours_review")
            db.commit()
            return

        # Recheck the order and contact in a short transaction immediately before the
        # provider call. The network call itself always happens outside that transaction.
        current_followup = db.get(FollowupOrder, job.followup_order_id)
        current_contact = db.get(PatientContact, contact.id)
        db.refresh(job)
        if current_followup is not None:
            db.refresh(current_followup)
        if current_contact is not None:
            db.refresh(current_contact)
        if (
            job.status != "claimed"
            or job.claim_token != claim_token
            or current_followup is None
            or current_followup.status not in {"active", "contact_resolution_required"}
            or current_contact is None
            or not _preference_is_permitted(db, current_contact, job.channel)
        ):
            if job.status != "claimed" or job.claim_token != claim_token:
                db.rollback()
                return
            _suppress(db, job, "state_changed_before_send")
            db.commit()
            return
        job.status = "sending"
        job.attempt_count += 1
        job.claimed_at = utc_now()
        attempt_no = job.attempt_count
        db.add(
            CommunicationAttempt(
                reminder_job_id=job.id,
                attempt_no=attempt_no,
                channel=job.channel,
                result="started",
                started_at=utc_now(),
            )
        )
        destination_encrypted = current_contact.destination_encrypted
        template_id = policy.config["template_id"]
        idempotency_key = job.idempotency_key
        db.commit()

    try:
        destination = decrypt_destination(destination_encrypted)
        result = await provider.send_template(
            destination=destination,
            template_key=template_id,
            variables={},
            idempotency_key=idempotency_key,
        )
    except ProviderSendError as exc:
        with SessionLocal() as db:
            job = db.get(ReminderJob, job_id)
            attempt = db.scalar(
                select(CommunicationAttempt).where(
                    CommunicationAttempt.reminder_job_id == job_id,
                    CommunicationAttempt.attempt_no == attempt_no,
                )
            )
            if job and job.status == "sending":
                if exc.outcome_unknown:
                    job.status = "send_unknown"
                    job.last_error_code = exc.code
                elif exc.retryable and job.attempt_count < 5:
                    delay = min(60 * (2 ** max(job.attempt_count - 1, 0)), 3600)
                    job.status = "retry_wait"
                    job.scheduled_at = utc_now() + timedelta(
                        seconds=delay + random.randint(0, 30)
                    )
                    job.next_retry_at = job.scheduled_at
                    job.last_error_code = exc.code
                else:
                    job.status = "failed_terminal"
                    job.last_error_code = exc.code
                job.claim_token = None
                job.claimed_at = None
            if attempt:
                attempt.result = "unknown" if exc.outcome_unknown else "failed"
                attempt.error_code = exc.code
                attempt.finished_at = utc_now()
            if job:
                _audit_worker(
                    db,
                    job.facility_id,
                    "reminder.provider_result",
                    "reminder_job",
                    job.id,
                    {"result": "unknown" if exc.outcome_unknown else "failed", "error_code": exc.code},
                )
            db.commit()
        return
    except Exception:
        logger.error("Fake provider call failed", extra={"job_id": str(job_id)})
        with SessionLocal() as db:
            job = db.get(ReminderJob, job_id)
            attempt = db.scalar(
                select(CommunicationAttempt).where(
                    CommunicationAttempt.reminder_job_id == job_id,
                    CommunicationAttempt.attempt_no == attempt_no,
                )
            )
            if job and job.status == "sending":
                job.status = "send_unknown"
                job.last_error_code = "provider_outcome_unknown"
                job.claim_token = None
                job.claimed_at = None
            if attempt:
                attempt.result = "unknown"
                attempt.error_code = "provider_outcome_unknown"
                attempt.finished_at = utc_now()
            if job:
                _audit_worker(
                    db,
                    job.facility_id,
                    "reminder.provider_result",
                    "reminder_job",
                    job.id,
                    {"result": "unknown", "error_code": "provider_outcome_unknown"},
                )
            db.commit()
        return

    with SessionLocal() as db:
        job = db.get(ReminderJob, job_id)
        attempt = db.scalar(
            select(CommunicationAttempt).where(
                CommunicationAttempt.reminder_job_id == job_id,
                CommunicationAttempt.attempt_no == attempt_no,
            )
        )
        if job and attempt:
            job.provider_message_id = result.provider_message_id
            job.status = "sent" if result.status == "accepted" else "failed_terminal"
            job.completed_at = utc_now() if result.status != "accepted" else None
            job.claim_token = None
            job.claimed_at = None
            attempt.result = result.status
            attempt.provider_reference = result.provider_message_id
            attempt.finished_at = utc_now()
            _audit_worker(
                db,
                job.facility_id,
                "reminder.provider_result",
                "reminder_job",
                job.id,
                {"result": result.status},
            )
            db.commit()


def claim_due_jobs(batch_size: int) -> list[tuple[uuid.UUID, uuid.UUID]]:
    now = utc_now()
    claimed: list[tuple[uuid.UUID, uuid.UUID]] = []
    with SessionLocal() as db:
        jobs = db.scalars(
            select(ReminderJob)
            .where(
                ReminderJob.status.in_(["scheduled", "retry_wait"]),
                ReminderJob.scheduled_at <= now,
            )
            .order_by(ReminderJob.scheduled_at)
            .with_for_update(skip_locked=True)
            .limit(batch_size)
        ).all()
        for job in jobs:
            token = uuid.uuid4()
            job.status = "claimed"
            job.claim_token = token
            job.claimed_at = now
            claimed.append((job.id, token))
        db.commit()
    return claimed


def recover_stale_claims() -> int:
    stale_before = utc_now() - timedelta(minutes=5)
    changed = 0
    with SessionLocal() as db:
        jobs = db.scalars(
            select(ReminderJob).where(
                ReminderJob.status.in_(["claimed", "sending"]),
                ReminderJob.claimed_at < stale_before,
            )
        ).all()
        for job in jobs:
            if job.status == "sending":
                job.status = "send_unknown"
                job.last_error_code = "worker_restarted_during_send"
            else:
                job.status = "scheduled"
                job.scheduled_at = utc_now()
            job.claim_token = None
            job.claimed_at = None
            _audit_worker(
                db,
                job.facility_id,
                "reminder.stale_claim_recovered",
                "reminder_job",
                job.id,
                {"recovered_status": job.status},
            )
            changed += 1
        db.commit()
    return changed


def recover_stale_scans() -> int:
    stale_before = utc_now() - timedelta(minutes=5)
    recovered = 0
    with SessionLocal() as db:
        scans = db.scalars(
            select(ScanDocument).where(
                ScanDocument.processing_status == "processing",
                ScanDocument.updated_at < stale_before,
            )
        ).all()
        for scan in scans:
            scan.processing_status = "queued_for_processing"
            scan.failure_code = "worker_restart_retry"
            _audit_worker(
                db,
                scan.facility_id,
                "scan.stale_processing_requeued",
                "scan_document",
                scan.id,
            )
            recovered += 1
        db.commit()
    return recovered


def create_overdue_tasks() -> int:
    now = utc_now()
    created = 0
    with SessionLocal() as db:
        orders = db.scalars(
            select(FollowupOrder).where(
                FollowupOrder.followup_required.is_(True),
                FollowupOrder.status.in_(["active", "contact_resolution_required"]),
                FollowupOrder.scheduled_at < now,
            )
        ).all()
        for followup in orders:
            policy = db.get(PolicyVersion, followup.policy_version_id) if followup.policy_version_id else None
            if policy is None:
                continue
            key = f"overdue:{followup.id}:{followup.revision}"
            if db.scalar(select(ReminderJob.id).where(ReminderJob.idempotency_key == key)):
                continue
            task = ReminderJob(
                    id=uuid.uuid4(),
                    facility_id=followup.facility_id,
                    followup_order_id=followup.id,
                    policy_version_id=policy.id,
                    sequence_no=10000 + followup.revision,
                    channel="staff_call",
                    action_kind="create_call_task",
                    scheduled_at=now,
                    status="call_task_open",
                    idempotency_key=key,
                    suppression_reason="overdue_followup",
                )
            db.add(task)
            _audit_worker(
                db,
                followup.facility_id,
                "followup.overdue_task_created",
                "reminder_job",
                task.id,
                {"followup_id": str(followup.id), "revision": followup.revision},
            )
            created += 1
        db.commit()
    return created


def _expire_check_and_process_webhook(
    db: Session, event_id: str, message_id: str, status: str
) -> bool:
    existing = db.scalar(
        select(ProviderWebhookEvent).where(ProviderWebhookEvent.provider_event_id == event_id)
    )
    if existing:
        return False
    db.add(
        ProviderWebhookEvent(
            provider_event_id=event_id,
            provider_message_id=message_id,
            status=status,
        )
    )
    job = db.scalar(
        select(ReminderJob)
        .where(ReminderJob.provider_message_id == message_id)
        .with_for_update()
    )
    if job is not None and job.status not in {"cancelled", "suppressed"}:
        if status == "delivered" and job.status in {"sent", "delivered"}:
            job.status = "delivered"
        elif status == "failed" and job.status in {"sent", "delivered"}:
            job.status = "failed_terminal"
            job.last_error_code = "provider_reported_failure"
    return True


def process_provider_webhook(event_id: str, message_id: str, status: str) -> bool:
    with SessionLocal() as db:
        changed = _expire_check_and_process_webhook(db, event_id, message_id, status)
        db.commit()
        return changed


async def run_worker() -> None:
    logger.info("Worker started")
    last_recovery = datetime.min.replace(tzinfo=timezone.utc)
    while True:
        now = utc_now()
        if now - last_recovery >= timedelta(minutes=1):
            recover_stale_claims()
            recover_stale_scans()
            create_overdue_tasks()
            last_recovery = now
        while process_one_scan():
            pass
        for job_id, token in claim_due_jobs(settings.worker_batch_size):
            await _process_claimed_job(job_id, token)
        await asyncio.sleep(settings.worker_poll_seconds)
