import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def json_type():
    return JSON().with_variant(JSONB(), "postgresql")


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class Facility(Base, TimestampMixin):
    __tablename__ = "facilities"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Kolkata")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("facility_id", "username", name="uq_users_facility_username"),
        UniqueConstraint("external_subject", name="uq_users_external_subject"),
        CheckConstraint(
            "role IN ('doctor','assistant_verifier','followup_coordinator',"
            "'clinic_supervisor','system_admin','auditor','receptionist')",
            name="ck_users_role",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    external_subject: Mapped[str | None] = mapped_column(String(255), unique=True)
    username: Mapped[str] = mapped_column(String(120), nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False)
    department: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    system_identifier: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    work_email: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")


class RegistrationRequest(Base, TimestampMixin):
    __tablename__ = "registration_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    work_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    department: Mapped[str] = mapped_column(String(120), nullable=False)
    requested_role: Mapped[str] = mapped_column(String(40), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    certification_agreed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)


class Patient(Base, TimestampMixin):
    __tablename__ = "patients"
    __table_args__ = (
        UniqueConstraint(
            "facility_id", "hospital_patient_identifier", name="uq_patient_facility_identifier"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    hospital_patient_identifier: Mapped[str] = mapped_column(String(120), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(160))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    identity_status: Mapped[str] = mapped_column(String(32), nullable=False, default="verified")


class PatientContact(Base, TimestampMixin):
    __tablename__ = "patient_contacts"
    __table_args__ = (
        CheckConstraint("channel IN ('whatsapp','sms','voice')", name="ck_contact_channel"),
        Index("ix_contacts_patient_active", "patient_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    channel: Mapped[str] = mapped_column(String(24), nullable=False)
    destination_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    destination_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sharing_status_source: Mapped[str | None] = mapped_column(String(160))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class CommunicationPreference(Base, TimestampMixin):
    __tablename__ = "communication_preferences"
    __table_args__ = (
        UniqueConstraint(
            "patient_contact_id", "purpose", "channel", name="uq_contact_preference"
        ),
        CheckConstraint(
            "permission_status IN ('unknown','opted_in','opted_out','not_permitted')",
            name="ck_preference_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_contact_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patient_contacts.id", ondelete="RESTRICT"), nullable=False
    )
    purpose: Mapped[str] = mapped_column(String(80), nullable=False)
    channel: Mapped[str] = mapped_column(String(24), nullable=False)
    permission_status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="unknown"
    )
    evidence_type: Mapped[str | None] = mapped_column(String(80))
    evidence_reference: Mapped[str | None] = mapped_column(String(255))
    captured_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Encounter(Base):
    __tablename__ = "encounters"
    __table_args__ = (
        UniqueConstraint(
            "facility_id", "external_encounter_identifier", name="uq_encounter_facility_external"
        ),
        Index("ix_encounter_patient", "patient_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    external_encounter_identifier: Mapped[str] = mapped_column(String(120), nullable=False)
    clinician_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    encounter_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ScanDocument(Base, TimestampMixin):
    __tablename__ = "scan_documents"
    __table_args__ = (
        UniqueConstraint("facility_id", "form_identifier", name="uq_scan_form_identifier"),
        UniqueConstraint("facility_id", "sha256", name="uq_scan_facility_checksum"),
        CheckConstraint(
            "processing_status IN ('uploaded','queued_for_processing','processing',"
            "'needs_review','processing_failed','clarification_required','verified','rejected')",
            name="ck_scan_status",
        ),
        Index("ix_scan_queue", "processing_status", "uploaded_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    form_identifier: Mapped[str] = mapped_column(String(120), nullable=False)
    form_version: Mapped[str] = mapped_column(String(40), nullable=False)
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("encounters.id", ondelete="RESTRICT")
    )
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    processing_status: Mapped[str] = mapped_column(String(32), nullable=False, default="uploaded")
    extracted_fields: Mapped[dict[str, Any]] = mapped_column(json_type(), nullable=False, default=dict)
    field_confidence: Mapped[dict[str, Any]] = mapped_column(json_type(), nullable=False, default=dict)
    processing_version: Mapped[str | None] = mapped_column(String(80))
    submitted_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_code: Mapped[str | None] = mapped_column(String(100))


class ClinicalDecision(Base):
    __tablename__ = "clinical_decisions"
    __table_args__ = (
        UniqueConstraint("scan_document_id", "revision", name="uq_clinical_decision_revision"),
        CheckConstraint(
            "severity IS NULL OR severity IN ('normal','moderate','severe')",
            name="ck_decision_severity",
        ),
        CheckConstraint(
            "(followup_required = true AND severity IS NOT NULL AND scheduled_at IS NOT NULL) OR "
            "(followup_required = false AND severity IS NULL AND scheduled_at IS NULL)",
            name="ck_decision_fields",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    scan_document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("scan_documents.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    followup_required: Mapped[bool] = mapped_column(Boolean, nullable=False)
    severity: Mapped[str | None] = mapped_column(String(16))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    clinician_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class VerificationEvent(Base):
    __tablename__ = "verification_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    scan_document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("scan_documents.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    reviewer_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    result: Mapped[str] = mapped_column(String(32), nullable=False)
    confirmed_fields: Mapped[dict[str, Any]] = mapped_column(json_type(), nullable=False, default=dict)
    correction_summary: Mapped[dict[str, Any] | None] = mapped_column(json_type())
    reason: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class PolicyVersion(Base):
    __tablename__ = "policy_versions"
    __table_args__ = (
        UniqueConstraint("facility_id", "name", "version", name="uq_policy_facility_name_version"),
        CheckConstraint("version > 0", name="ck_policy_version_positive"),
        Index(
            "uq_policy_one_active_per_facility",
            "facility_id",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    config: Mapped[dict[str, Any]] = mapped_column(json_type(), nullable=False)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    approval_reference: Mapped[str | None] = mapped_column(String(255))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class FollowupOrder(Base, TimestampMixin):
    __tablename__ = "followup_orders"
    __table_args__ = (
        UniqueConstraint("source_scan_document_id", name="uq_followup_source_scan"),
        CheckConstraint(
            "severity IS NULL OR severity IN ('normal','moderate','severe')",
            name="ck_followup_severity",
        ),
        CheckConstraint(
            "status IN ('pending_verification','active','contact_resolution_required',"
            "'completed','cancelled','superseded','not_required')",
            name="ck_followup_status",
        ),
        CheckConstraint(
            "(followup_required = false AND severity IS NULL AND scheduled_at IS NULL) OR "
            "(followup_required = true AND severity IS NOT NULL AND scheduled_at IS NOT NULL)",
            name="ck_followup_decision_fields",
        ),
        CheckConstraint(
            "(status != 'not_required' OR followup_required = false)",
            name="ck_not_required_status",
        ),
        CheckConstraint(
            "(status NOT IN ('active','contact_resolution_required')) OR "
            "(followup_required = true AND policy_version_id IS NOT NULL)",
            name="ck_active_followup_policy",
        ),
        Index("ix_followup_facility_status_schedule", "facility_id", "status", "scheduled_at"),
        Index("ix_followup_patient", "patient_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    encounter_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False
    )
    source_scan_document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("scan_documents.id", ondelete="RESTRICT"), nullable=False
    )
    created_by_clinician_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    verified_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    followup_required: Mapped[bool] = mapped_column(Boolean, nullable=False)
    severity: Mapped[str | None] = mapped_column(String(16))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    policy_version_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("policy_versions.id", ondelete="RESTRICT")
    )
    contact_resolution_status: Mapped[str] = mapped_column(
        String(40), nullable=False, default="not_required"
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    supersedes_followup_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("followup_orders.id", ondelete="RESTRICT")
    )
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    cancellation_reason: Mapped[str | None] = mapped_column(String(500))


class FollowupRevision(Base):
    __tablename__ = "followup_revisions"
    __table_args__ = (UniqueConstraint("followup_order_id", "revision", name="uq_followup_revision"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    followup_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("followup_orders.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    changed_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ReminderJob(Base, TimestampMixin):
    __tablename__ = "reminder_jobs"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_reminder_idempotency_key"),
        CheckConstraint(
            "channel IN ('whatsapp','sms','staff_call')", name="ck_reminder_channel"
        ),
        CheckConstraint(
            "action_kind IN ('send_message','create_call_task')", name="ck_reminder_action"
        ),
        CheckConstraint(
            "status IN ('scheduled','claimed','sending','sent','delivered','call_task_open',"
            "'completed','retry_wait','suppressed','cancelled','failed_terminal','send_unknown')",
            name="ck_reminder_status",
        ),
        Index("ix_reminder_due", "status", "scheduled_at"),
        Index("ix_reminder_followup_status", "followup_order_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    followup_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("followup_orders.id", ondelete="RESTRICT"), nullable=False
    )
    policy_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("policy_versions.id", ondelete="RESTRICT"), nullable=False
    )
    patient_contact_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("patient_contacts.id", ondelete="RESTRICT")
    )
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)
    channel: Mapped[str] = mapped_column(String(24), nullable=False)
    action_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduled")
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    claim_token: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    last_error_code: Mapped[str | None] = mapped_column(String(100))
    suppression_reason: Mapped[str | None] = mapped_column(String(160))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CommunicationAttempt(Base):
    __tablename__ = "communication_attempts"
    __table_args__ = (
        UniqueConstraint("reminder_job_id", "attempt_no", name="uq_attempt_job_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    reminder_job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("reminder_jobs.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False)
    channel: Mapped[str] = mapped_column(String(24), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    result: Mapped[str] = mapped_column(String(40), nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(255))
    staff_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    error_code: Mapped[str | None] = mapped_column(String(100))
    safe_result_notes: Mapped[str | None] = mapped_column(String(500))


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        Index("ix_audit_facility_time", "facility_id", "occurred_at"),
        Index("ix_audit_entity", "entity_type", "entity_id", "occurred_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    request_id: Mapped[str | None] = mapped_column(String(80))
    reason: Mapped[str | None] = mapped_column(String(500))
    change_summary: Mapped[dict[str, Any] | None] = mapped_column(json_type())


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"
    __table_args__ = (UniqueConstraint("scope", "key", name="uq_idempotency_scope_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    scope: Mapped[str] = mapped_column(String(180), nullable=False)
    key: Mapped[str] = mapped_column(String(180), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_status: Mapped[int] = mapped_column(Integer, nullable=False)
    response_body: Mapped[dict[str, Any]] = mapped_column(json_type(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ProviderWebhookEvent(Base):
    __tablename__ = "provider_webhook_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    provider_event_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    provider_message_id: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
