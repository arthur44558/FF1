export type Role =
  | "doctor"
  | "assistant_verifier"
  | "followup_coordinator"
  | "clinic_supervisor"
  | "system_admin"
  | "auditor"
  | "receptionist";

export type Severity = "normal" | "moderate" | "severe";

export type Channel = "whatsapp" | "sms" | "voice";

export type PreferenceStatus = "unknown" | "opted_in" | "opted_out" | "not_permitted";

export interface ApiErrorDetail {
  code: string;
  message?: string;
  errors?: Array<{
    location: string[];
    code: string;
    message: string;
  }>;
  request_id?: string;
}

export interface ApiErrorResponse {
  detail: string | ApiErrorDetail;
}

export interface LoginRequest {
  unique_id: string;
  password: string;
}

export interface ForgotPasswordRequest {
  identity: string;
}

export interface ForgotPasswordResponse {
  message: string;
  delivery: string;
  reset_token?: string | null;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  status: string;
  message: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  role: Role;
  system_identifier: string;
  display_name: string;
}

export interface RegistrationRequestIn {
  full_name: string;
  work_email: string;
  department: string;
  requested_role: string;
  password: string;
  certification_agreed: boolean;
}

export interface RegistrationRequestOut {
  id: string;
  facility_id: string;
  full_name: string;
  work_email: string;
  department: string;
  requested_role: string;
  certification_agreed: boolean;
  status: string;
  created_at: string;
  reviewed_at?: string | null;
}

export interface DevTokenRequest {
  username: string;
}

export interface DevTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface MeOut {
  id: string;
  facility_id: string;
  username: string;
  display_name: string;
  role: Role;
  permissions: string[];
  environment: string;
  system_identifier?: string | null;
  work_email?: string | null;
  status?: string;
}

export interface UserOut {
  id: string;
  facility_id: string;
  username: string;
  display_name: string;
  role: Role;
  department: string | null;
  is_active: boolean;
  external_subject: string | null;
  system_identifier?: string | null;
  work_email?: string | null;
  status?: string;
}

export interface UserCreate {
  username: string;
  display_name: string;
  role: Role;
  external_subject?: string | null;
  department?: string | null;
}

export interface UserPatch {
  is_active?: boolean;
  role?: Role;
  department?: string | null;
  reason: string;
}

export interface PatientOut {
  id: string;
  hospital_patient_identifier: string;
  display_name: string | null;
  date_of_birth: string | null;
  identity_status: string;
  created_at: string;
}

export interface PatientCreate {
  hospital_patient_identifier: string;
  display_name?: string | null;
  date_of_birth?: string | null;
}

export interface EncounterOut {
  id: string;
  patient_id: string;
  external_encounter_identifier: string;
  clinician_user_id: string;
  encounter_at: string;
  created_at: string;
}

export interface EncounterCreate {
  patient_id: string;
  external_encounter_identifier: string;
  clinician_user_id?: string;
  encounter_at: string;
}

export interface ScanOut {
  id: string;
  form_identifier: string;
  form_version: string;
  processing_status: string;
  sha256: string;
  mime_type: string;
  size_bytes: number;
  extracted_fields: Record<string, any>;
  field_confidence: Record<string, any>;
  processing_version: string | null;
  failure_code: string | null;
  uploaded_at: string;
  processed_at: string | null;
  reviewed_at: string | null;
}

export interface ClinicalDecisionOut {
  revision: number;
  followup_required: boolean;
  severity: Severity | null;
  scheduled_at: string | null;
  timezone: string;
  clinician_user_id: string;
}

export interface ScanReviewOut extends ScanOut {
  image_endpoint: string;
  clinical_decision: ClinicalDecisionOut | null;
}

export interface ClinicalDecisionIn {
  followup_required: boolean;
  severity?: Severity | null;
  scheduled_at_local?: string | null;
  timezone: string;
  reason: string;
}

export interface VerificationIn {
  result: "verified" | "clarification_required" | "rejected";
  patient_identifier?: string | null;
  encounter_identifier?: string | null;
  followup_required?: boolean | null;
  scheduled_at_local?: string | null;
  timezone?: string | null;
  severity?: Severity | null;
  correction_summary?: Record<string, any> | null;
  reason?: string | null;
}

export interface VerificationOut {
  scan_id: string;
  scan_status: string;
  followup_id?: string | null;
  followup_status?: string | null;
  message: string;
}

export interface FollowupOut {
  id: string;
  patient_id: string;
  patient_identifier: string;
  patient_display_name: string | null;
  encounter_id: string;
  external_encounter_identifier: string;
  clinician_user_id: string;
  severity: Severity | null;
  followup_required: boolean;
  scheduled_at: string | null;
  status: string;
  contact_resolution_status: string;
  revision: number;
  policy_version_id: string | null;
  overdue: boolean;
  created_at: string;
  activated_at: string | null;
}

export interface FollowupDetail {
  followup: FollowupOut;
  schedule: Array<{
    id: string;
    sequence_no: number;
    channel: string;
    action_kind: string;
    scheduled_at: string;
    status: string;
    suppression_reason: string | null;
  }>;
  audit_history: Array<{
    id: string;
    occurred_at: string;
    actor_user_id: string | null;
    action: string;
    reason: string | null;
    change_summary: Record<string, any> | null;
  }>;
}

export interface FollowupAmendmentIn {
  severity: Severity;
  scheduled_at: string;
  expected_revision: number;
  reason: string;
}

export interface RescheduleIn {
  scheduled_at: string;
  expected_revision: number;
  reason: string;
}

export interface CompleteIn {
  outcome_category: string;
  completed_at?: string | null;
}

export interface CancelIn {
  reason: string;
}

export interface ContactResolveIn {
  reason: string;
}

export interface SupersedeIn {
  replacement_followup_id: string;
  reason: string;
}

export interface PreferenceOut {
  id: string;
  channel: string;
  purpose: string;
  permission_status: string;
  evidence_type: string | null;
  evidence_reference: string | null;
  captured_at: string | null;
  expires_at: string | null;
}

export interface ContactOut {
  id: string;
  channel: string;
  masked_destination: string;
  verified_at: string | null;
  is_shared: boolean;
  sharing_status_source: string | null;
  is_active: boolean;
  preferences: PreferenceOut[];
}

export interface ContactCreate {
  channel: Channel;
  destination: string;
  is_shared: boolean;
  sharing_status_source?: string | null;
  verified: boolean;
  verification_source?: string | null;
}

export interface ContactPatch {
  is_shared?: boolean;
  sharing_status_source?: string | null;
  verified?: boolean;
  verification_source?: string | null;
  is_active?: boolean;
  reason: string;
}

export interface ContactRevealIn {
  reason: string;
}

export interface ContactRevealOut {
  contact_id: string;
  channel: string;
  destination: string;
  is_shared: boolean;
  verified_at: string | null;
}

export interface PreferenceIn {
  channel: Channel;
  purpose?: string;
  permission_status: PreferenceStatus;
  evidence_type?: string | null;
  evidence_reference?: string | null;
  expires_at?: string | null;
}

export interface OptOutIn {
  channel: Channel;
  purpose?: string;
  evidence_reference?: string | null;
  reason: string;
}

export interface ReminderOut {
  id: string;
  followup_order_id: string;
  patient_identifier: string;
  patient_display_name: string | null;
  severity: Severity | null;
  followup_scheduled_at: string | null;
  clinician_user_id: string | null;
  sequence_no: number;
  channel: string;
  action_kind: string;
  scheduled_at: string;
  status: string;
  attempt_count: number;
  suppression_reason: string | null;
  provider_message_id: string | null;
  overdue_priority?: string | null;
  contact_reference?: string | null;
  masked_contact?: string | null;
  script_id?: string | null;
}

export interface CommunicationAttemptOut {
  attempt_no: number;
  channel: string;
  started_at: string;
  finished_at: string | null;
  result: string;
  provider_reference: string | null;
  staff_user_id: string | null;
  error_code: string | null;
}

export interface ReminderDetail {
  reminder: ReminderOut;
  attempts: CommunicationAttemptOut[];
}

export interface CallOutcomeIn {
  result:
    | "contacted_patient"
    | "no_answer"
    | "voicemail_left_neutral"
    | "wrong_number"
    | "shared_contact_blocked"
    | "requested_reschedule"
    | "declined_messages"
    | "contact_details_invalid"
    | "escalated_to_clinician"
    | "other_review_required";
  safe_result_notes?: string | null;
  occurred_at?: string | null;
}

export interface RetryReviewIn {
  decision: "retry" | "suppress";
  reason: string;
  confirmed_not_sent?: boolean;
}

export interface PolicyConfig {
  timezone: string;
  fractions: number[];
  actions: {
    normal: string[];
    moderate: string[];
    severe: string[];
  };
  severe_initial_message: boolean;
  message_channel: Channel;
  template_id: string;
  call_script_id: string | null;
  allowed_start: string;
  allowed_end: string;
  allow_shared_neutral_messages: boolean;
  short_interval_action: "call_task" | "suppress";
  overdue_priority_by_severity: boolean;
  provider_policy_reviewed: boolean;
  message_content_approval_reference: string | null;
}

export interface PolicyCreate {
  name: string;
  config: PolicyConfig;
}

export interface PolicyApproveIn {
  approval_reference: string;
}

export interface PolicyOut {
  id: string;
  name: string;
  version: number;
  config: PolicyConfig;
  approved_by_user_id: string | null;
  approval_reference: string | null;
  approved_at: string | null;
  effective_from: string | null;
  is_active: boolean;
  created_at: string;
}

export interface OperationsSummary {
  generated_at: string;
  followups_by_status: Record<string, number>;
  followups_by_severity: Record<string, number>;
  overdue_followups: number;
  reminder_jobs_by_status: Record<string, number>;
  scans_by_processing_status: Record<string, number>;
}

export interface AuditEventOut {
  id: string;
  occurred_at: string;
  actor_type: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  request_id: string | null;
  reason: string | null;
  change_summary: Record<string, any> | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  limit: number;
  offset: number;
}
