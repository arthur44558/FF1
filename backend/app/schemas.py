from datetime import date, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Role(StrEnum):
    doctor = "doctor"
    assistant_verifier = "assistant_verifier"
    followup_coordinator = "followup_coordinator"
    clinic_supervisor = "clinic_supervisor"
    system_admin = "system_admin"
    auditor = "auditor"
    receptionist = "receptionist"


class Severity(StrEnum):
    normal = "normal"
    moderate = "moderate"
    severe = "severe"


class Channel(StrEnum):
    whatsapp = "whatsapp"
    sms = "sms"
    voice = "voice"


class PreferenceStatus(StrEnum):
    unknown = "unknown"
    opted_in = "opted_in"
    opted_out = "opted_out"
    not_permitted = "not_permitted"


class PatientCreate(StrictModel):
    hospital_patient_identifier: str = Field(min_length=1, max_length=120)
    display_name: str | None = Field(default=None, max_length=160)
    date_of_birth: date | None = None


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    hospital_patient_identifier: str
    display_name: str | None
    date_of_birth: date | None
    identity_status: str
    created_at: datetime


class EncounterCreate(StrictModel):
    patient_id: UUID
    external_encounter_identifier: str = Field(min_length=1, max_length=120)
    clinician_user_id: UUID | None = None
    encounter_at: datetime


class EncounterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    patient_id: UUID
    external_encounter_identifier: str
    clinician_user_id: UUID
    encounter_at: datetime
    created_at: datetime


class UserCreate(StrictModel):
    username: str = Field(min_length=2, max_length=120)
    display_name: str = Field(min_length=1, max_length=160)
    role: Role
    external_subject: str | None = Field(default=None, max_length=255)
    department: str | None = Field(default=None, max_length=120)


class UserPatch(StrictModel):
    is_active: bool | None = None
    role: Role | None = None
    department: str | None = Field(default=None, max_length=120)
    reason: str = Field(min_length=3, max_length=500)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    facility_id: UUID
    username: str
    display_name: str
    role: str
    department: str | None
    is_active: bool
    external_subject: str | None
    system_identifier: str | None = None
    work_email: str | None = None
    status: str = "active"


class LoginRequest(StrictModel):
    unique_id: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=1, max_length=255)


class ForgotPasswordIn(StrictModel):
    identity: str = Field(min_length=2, max_length=255)


class ForgotPasswordOut(BaseModel):
    message: str
    delivery: str
    reset_token: str | None = None


class ResetPasswordIn(StrictModel):
    token: str = Field(min_length=10, max_length=1024)
    new_password: str = Field(min_length=8, max_length=128)


class ResetPasswordOut(BaseModel):
    status: str
    message: str


class RegistrationRequestIn(StrictModel):
    full_name: str = Field(min_length=2, max_length=160)
    work_email: str = Field(min_length=5, max_length=255)
    department: str = Field(min_length=1, max_length=120)
    requested_role: str = Field(min_length=2, max_length=40)
    password: str = Field(min_length=8, max_length=128)
    certification_agreed: bool = Field(...)

    @field_validator("requested_role")
    @classmethod
    def validate_requested_role(cls, v: str) -> str:
        allowed = {"doctor", "assistant_doctor", "staff_head", "staff", "receptionist"}
        if v.lower() not in allowed:
            raise ValueError(f"Requested role must be one of {allowed}")
        return v.lower()


class RegistrationRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    facility_id: UUID
    full_name: str
    work_email: str
    department: str
    requested_role: str
    certification_agreed: bool
    status: str
    created_at: datetime
    reviewed_at: datetime | None = None


class RegistrationApprovalIn(StrictModel):
    assigned_facility_id: UUID | None = None


class RegistrationRejectionIn(StrictModel):
    reason: str = Field(min_length=3, max_length=500)


class DevTokenRequest(StrictModel):
    username: str = Field(min_length=2, max_length=120)


class MeOut(BaseModel):
    id: UUID
    facility_id: UUID
    username: str
    display_name: str
    role: str
    permissions: list[str]
    environment: str
    system_identifier: str | None = None
    work_email: str | None = None
    status: str = "active"


class ScanOut(BaseModel):
    id: UUID
    form_identifier: str
    form_version: str
    processing_status: str
    sha256: str
    mime_type: str
    size_bytes: int
    extracted_fields: dict[str, Any]
    field_confidence: dict[str, Any]
    processing_version: str | None
    failure_code: str | None
    uploaded_at: datetime
    processed_at: datetime | None
    reviewed_at: datetime | None


class ClinicalDecisionIn(StrictModel):
    followup_required: bool
    severity: Severity | None = None
    scheduled_at_local: datetime | None = None
    timezone: str = Field(min_length=1, max_length=64)
    reason: str = Field(min_length=3, max_length=500)

    @model_validator(mode="after")
    def required_fields_match_decision(self) -> "ClinicalDecisionIn":
        if self.followup_required and (self.severity is None or self.scheduled_at_local is None):
            raise ValueError("A required follow-up needs clinician-selected severity and date/time")
        if not self.followup_required and (self.severity is not None or self.scheduled_at_local):
            raise ValueError("A no-follow-up decision cannot include severity or appointment time")
        return self


class VerificationIn(StrictModel):
    result: str = Field(pattern="^(verified|clarification_required|rejected)$")
    patient_identifier: str | None = Field(default=None, max_length=120)
    encounter_identifier: str | None = Field(default=None, max_length=120)
    followup_required: bool | None = None
    scheduled_at_local: datetime | None = None
    timezone: str | None = Field(default=None, max_length=64)
    severity: Severity | None = None
    correction_summary: dict[str, Any] | None = None
    reason: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def verified_payload_is_complete(self) -> "VerificationIn":
        if self.result == "verified":
            if not self.patient_identifier or not self.encounter_identifier:
                raise ValueError("Verified scans require matched patient and encounter identifiers")
            if self.followup_required is None or not self.timezone:
                raise ValueError("Verified scans require the confirmed follow-up choice and timezone")
            if self.followup_required and (self.severity is None or self.scheduled_at_local is None):
                raise ValueError("Required follow-up needs confirmed severity and date/time")
            if not self.followup_required and (self.severity is not None or self.scheduled_at_local):
                raise ValueError("No-follow-up verification cannot include severity or appointment time")
            if self.correction_summary and not self.reason:
                raise ValueError("A reason is required when transcription corrections are recorded")
        if self.result != "verified" and not self.reason:
            raise ValueError("A reason is required for clarification or rejection")
        return self


class VerificationOut(BaseModel):
    scan_id: UUID
    scan_status: str
    followup_id: UUID | None = None
    followup_status: str | None = None
    message: str


class ContactCreate(StrictModel):
    channel: Channel
    destination: str = Field(min_length=5, max_length=200)
    is_shared: bool = False
    sharing_status_source: str | None = Field(default=None, max_length=160)
    verified: bool = False
    verification_source: str | None = Field(default=None, max_length=160)


class ContactPatch(StrictModel):
    is_shared: bool | None = None
    sharing_status_source: str | None = Field(default=None, max_length=160)
    verified: bool | None = None
    verification_source: str | None = Field(default=None, max_length=160)
    is_active: bool | None = None
    reason: str = Field(min_length=3, max_length=500)


class ContactOut(BaseModel):
    id: UUID
    channel: str
    masked_destination: str
    verified_at: datetime | None
    is_shared: bool
    sharing_status_source: str | None
    is_active: bool
    preferences: list[dict[str, Any]]


class ContactRevealIn(StrictModel):
    reason: str = Field(min_length=3, max_length=500)


class ContactResolveIn(StrictModel):
    reason: str = Field(min_length=3, max_length=500)


class PreferenceIn(StrictModel):
    channel: Channel
    purpose: str = Field(default="appointment_reminder", min_length=2, max_length=80)
    permission_status: PreferenceStatus
    evidence_type: str | None = Field(default=None, max_length=80)
    evidence_reference: str | None = Field(default=None, max_length=255)
    expires_at: datetime | None = None

    @model_validator(mode="after")
    def opt_in_requires_evidence(self) -> "PreferenceIn":
        if self.permission_status == PreferenceStatus.opted_in and not (
            self.evidence_type and self.evidence_reference
        ):
            raise ValueError("Opt-in requires evidence type and reference")
        if self.expires_at is not None and self.expires_at.tzinfo is None:
            raise ValueError("Preference expiry must include a timezone")
        return self


class OptOutIn(StrictModel):
    channel: Channel
    purpose: str = Field(default="appointment_reminder", min_length=2, max_length=80)
    evidence_reference: str | None = Field(default=None, max_length=255)
    reason: str = Field(min_length=3, max_length=500)


class PreferenceOut(BaseModel):
    id: UUID
    channel: str
    purpose: str
    permission_status: str
    evidence_type: str | None
    evidence_reference: str | None
    captured_at: datetime | None
    expires_at: datetime | None


class FollowupOut(BaseModel):
    id: UUID
    patient_id: UUID
    patient_identifier: str
    patient_display_name: str | None
    encounter_id: UUID
    external_encounter_identifier: str
    clinician_user_id: UUID
    severity: str | None
    followup_required: bool
    scheduled_at: datetime | None
    status: str
    contact_resolution_status: str
    revision: int
    policy_version_id: UUID | None
    overdue: bool
    created_at: datetime
    activated_at: datetime | None


class FollowupAmendmentIn(StrictModel):
    severity: Severity
    scheduled_at: datetime
    expected_revision: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=500)


class RescheduleIn(StrictModel):
    scheduled_at: datetime
    expected_revision: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=500)


class CompleteIn(StrictModel):
    outcome_category: str = Field(min_length=2, max_length=80)
    completed_at: datetime | None = None


class CancelIn(StrictModel):
    reason: str = Field(min_length=3, max_length=500)


class SupersedeIn(StrictModel):
    replacement_followup_id: UUID
    reason: str = Field(min_length=3, max_length=500)


class PolicyConfig(StrictModel):
    timezone: str = "Asia/Kolkata"
    schedule_mode: str = "spaced"
    fractions: list[float] = Field(
        default_factory=lambda: [0.29, 0.57, 0.79, 0.86, 0.93], min_length=1, max_length=12
    )
    actions: dict[str, list[str]] = Field(
        default_factory=lambda: {
            "normal": ["message", "message", "message", "message", "message"],
            "moderate": ["message", "message", "call", "call", "call"],
            "severe": ["call", "call", "call", "call", "call"],
        }
    )
    severe_initial_message: bool = True
    message_channel: Channel = Channel.sms
    template_id: str = "appointment_reminder_v1"
    call_script_id: str | None = "neutral_follow_up_v1"
    allowed_start: str = "09:00"
    allowed_end: str = "17:00"
    allow_shared_neutral_messages: bool = False
    short_interval_action: str = "call_task"
    overdue_priority_by_severity: bool = False
    provider_policy_reviewed: bool = False
    message_content_approval_reference: str | None = None

    @field_validator("fractions")
    @classmethod
    def fractions_are_ascending(cls, value: list[float]) -> list[float]:
        if any(not 0 < item < 1 for item in value) or sorted(set(value)) != value:
            raise ValueError("fractions must be unique, increasing values between 0 and 1")
        return value

    @field_validator("short_interval_action")
    @classmethod
    def valid_short_interval_action(cls, value: str) -> str:
        if value not in {"call_task", "suppress"}:
            raise ValueError("short_interval_action must be call_task or suppress")
        return value

    @field_validator("message_channel")
    @classmethod
    def messages_must_use_text_channel(cls, value: Channel) -> Channel:
        if value == Channel.voice:
            raise ValueError("Automated messages can use only an approved text channel")
        return value

    @model_validator(mode="after")
    def action_rules_match_fractions(self) -> "PolicyConfig":
        if getattr(self, "schedule_mode", "spaced") == "fractional":
            for severity in ("normal", "moderate", "severe"):
                choices = self.actions.get(severity)
                if choices is None or len(choices) != len(self.fractions):
                    raise ValueError(f"actions.{severity} must match the number of fractions")
                if any(value not in {"message", "call", "suppress"} for value in choices):
                    raise ValueError("Actions may be message, call or suppress")
        return self


class PolicyCreate(StrictModel):
    name: str = Field(min_length=2, max_length=120)
    config: PolicyConfig


class PolicyApproveIn(StrictModel):
    approval_reference: str = Field(min_length=3, max_length=255)


class PolicyOut(BaseModel):
    id: UUID
    name: str
    version: int
    config: dict[str, Any]
    approved_by_user_id: UUID | None
    approval_reference: str | None
    approved_at: datetime | None
    effective_from: datetime | None
    is_active: bool
    created_at: datetime


class ReminderOut(BaseModel):
    id: UUID
    followup_order_id: UUID
    patient_identifier: str
    patient_display_name: str | None
    severity: str | None
    followup_scheduled_at: datetime | None
    clinician_user_id: UUID | None
    sequence_no: int
    channel: str
    action_kind: str
    scheduled_at: datetime
    status: str
    attempt_count: int
    suppression_reason: str | None
    provider_message_id: str | None
    overdue_priority: str | None = None
    contact_reference: UUID | None = None
    masked_contact: str | None = None
    script_id: str | None = None


class CallOutcomeIn(StrictModel):
    result: str = Field(
        pattern=(
            "^(contacted_patient|no_answer|voicemail_left_neutral|wrong_number|"
            "shared_contact_blocked|requested_reschedule|declined_messages|"
            "contact_details_invalid|escalated_to_clinician|other_review_required)$"
        )
    )
    safe_result_notes: str | None = Field(default=None, max_length=500)
    occurred_at: datetime | None = None


class RetryReviewIn(StrictModel):
    decision: str = Field(pattern="^(retry|suppress)$")
    reason: str = Field(min_length=3, max_length=500)
    confirmed_not_sent: bool = False


class WebhookEventIn(StrictModel):
    event_id: str = Field(min_length=1, max_length=255)
    message_id: str = Field(min_length=1, max_length=255)
    status: str = Field(pattern="^(accepted|delivered|failed)$")


class AuditOut(BaseModel):
    id: UUID
    occurred_at: datetime
    actor_type: str
    actor_user_id: UUID | None
    action: str
    entity_type: str
    entity_id: UUID
    request_id: str | None
    reason: str | None
    change_summary: dict[str, Any] | None


class Page(BaseModel):
    items: list[Any]
    limit: int
    offset: int
