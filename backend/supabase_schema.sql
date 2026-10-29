-- CareTrack Hospital Follow-up Full PostgreSQL Schema & Initial Data for Supabase

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE facilities (
	id UUID NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	timezone VARCHAR(64) NOT NULL, 
	active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE idempotency_records (
	id UUID NOT NULL, 
	scope VARCHAR(180) NOT NULL, 
	key VARCHAR(180) NOT NULL, 
	request_hash VARCHAR(64) NOT NULL, 
	response_status INTEGER NOT NULL, 
	response_body JSONB NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_idempotency_scope_key UNIQUE (scope, key)
);

CREATE TABLE provider_webhook_events (
	id UUID NOT NULL, 
	provider_event_id VARCHAR(255) NOT NULL, 
	provider_message_id VARCHAR(255) NOT NULL, 
	status VARCHAR(40) NOT NULL, 
	received_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (provider_event_id)
);

CREATE TABLE patients (
	id UUID NOT NULL, 
	facility_id UUID NOT NULL, 
	hospital_patient_identifier VARCHAR(120) NOT NULL, 
	display_name VARCHAR(160), 
	date_of_birth DATE, 
	identity_status VARCHAR(32) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_patient_facility_identifier UNIQUE (facility_id, hospital_patient_identifier), 
	FOREIGN KEY(facility_id) REFERENCES facilities (id) ON DELETE RESTRICT
);

CREATE TABLE users (
	id UUID NOT NULL, 
	facility_id UUID NOT NULL, 
	external_subject VARCHAR(255), 
	username VARCHAR(120) NOT NULL, 
	display_name VARCHAR(160) NOT NULL, 
	role VARCHAR(40) NOT NULL, 
	department VARCHAR(120), 
	is_active BOOLEAN NOT NULL, 
	last_login_at TIMESTAMP WITH TIME ZONE, 
	system_identifier VARCHAR(64), 
	password_hash VARCHAR(255), 
	work_email VARCHAR(255), 
	status VARCHAR(32) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_users_facility_username UNIQUE (facility_id, username), 
	CONSTRAINT uq_users_external_subject UNIQUE (external_subject), 
	CONSTRAINT ck_users_role CHECK (role IN ('doctor','assistant_verifier','followup_coordinator','clinic_supervisor','system_admin','auditor','receptionist')), 
	FOREIGN KEY(facility_id) REFERENCES facilities (id) ON DELETE RESTRICT, 
	UNIQUE (external_subject)
);

CREATE TABLE audit_events (
	id UUID NOT NULL, 
	facility_id UUID NOT NULL, 
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	actor_type VARCHAR(20) NOT NULL, 
	actor_user_id UUID, 
	action VARCHAR(120) NOT NULL, 
	entity_type VARCHAR(80) NOT NULL, 
	entity_id UUID NOT NULL, 
	request_id VARCHAR(80), 
	reason VARCHAR(500), 
	change_summary JSONB, 
	PRIMARY KEY (id), 
	FOREIGN KEY(facility_id) REFERENCES facilities (id) ON DELETE RESTRICT, 
	FOREIGN KEY(actor_user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE encounters (
	id UUID NOT NULL, 
	facility_id UUID NOT NULL, 
	patient_id UUID NOT NULL, 
	external_encounter_identifier VARCHAR(120) NOT NULL, 
	clinician_user_id UUID NOT NULL, 
	encounter_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_encounter_facility_external UNIQUE (facility_id, external_encounter_identifier), 
	FOREIGN KEY(facility_id) REFERENCES facilities (id) ON DELETE RESTRICT, 
	FOREIGN KEY(patient_id) REFERENCES patients (id) ON DELETE RESTRICT, 
	FOREIGN KEY(clinician_user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE patient_contacts (
	id UUID NOT NULL, 
	patient_id UUID NOT NULL, 
	channel VARCHAR(24) NOT NULL, 
	destination_encrypted TEXT NOT NULL, 
	destination_fingerprint VARCHAR(64) NOT NULL, 
	verified_at TIMESTAMP WITH TIME ZONE, 
	is_shared BOOLEAN NOT NULL, 
	sharing_status_source VARCHAR(160), 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_contact_channel CHECK (channel IN ('whatsapp','sms','voice')), 
	FOREIGN KEY(patient_id) REFERENCES patients (id) ON DELETE RESTRICT
);

CREATE TABLE policy_versions (
	id UUID NOT NULL, 
	facility_id UUID NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	version INTEGER NOT NULL, 
	config JSONB NOT NULL, 
	approved_by_user_id UUID, 
	approval_reference VARCHAR(255), 
	approved_at TIMESTAMP WITH TIME ZONE, 
	effective_from TIMESTAMP WITH TIME ZONE, 
	retired_at TIMESTAMP WITH TIME ZONE, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_policy_facility_name_version UNIQUE (facility_id, name, version), 
	CONSTRAINT ck_policy_version_positive CHECK (version > 0), 
	FOREIGN KEY(facility_id) REFERENCES facilities (id) ON DELETE RESTRICT, 
	FOREIGN KEY(approved_by_user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE registration_requests (
	id UUID NOT NULL, 
	facility_id UUID NOT NULL, 
	full_name VARCHAR(160) NOT NULL, 
	work_email VARCHAR(255) NOT NULL, 
	department VARCHAR(120) NOT NULL, 
	requested_role VARCHAR(40) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	certification_agreed BOOLEAN NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	reviewed_by_user_id UUID, 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	rejection_reason TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(facility_id) REFERENCES facilities (id) ON DELETE RESTRICT, 
	FOREIGN KEY(reviewed_by_user_id) REFERENCES users (id)
);

CREATE TABLE communication_preferences (
	id UUID NOT NULL, 
	patient_contact_id UUID NOT NULL, 
	purpose VARCHAR(80) NOT NULL, 
	channel VARCHAR(24) NOT NULL, 
	permission_status VARCHAR(24) NOT NULL, 
	evidence_type VARCHAR(80), 
	evidence_reference VARCHAR(255), 
	captured_by_user_id UUID, 
	captured_at TIMESTAMP WITH TIME ZONE, 
	expires_at TIMESTAMP WITH TIME ZONE, 
	withdrawn_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_contact_preference UNIQUE (patient_contact_id, purpose, channel), 
	CONSTRAINT ck_preference_status CHECK (permission_status IN ('unknown','opted_in','opted_out','not_permitted')), 
	FOREIGN KEY(patient_contact_id) REFERENCES patient_contacts (id) ON DELETE RESTRICT, 
	FOREIGN KEY(captured_by_user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE scan_documents (
	id UUID NOT NULL, 
	facility_id UUID NOT NULL, 
	form_identifier VARCHAR(120) NOT NULL, 
	form_version VARCHAR(40) NOT NULL, 
	encounter_id UUID, 
	storage_key VARCHAR(255) NOT NULL, 
	sha256 VARCHAR(64) NOT NULL, 
	mime_type VARCHAR(80) NOT NULL, 
	size_bytes INTEGER NOT NULL, 
	processing_status VARCHAR(32) NOT NULL, 
	extracted_fields JSONB NOT NULL, 
	field_confidence JSONB NOT NULL, 
	processing_version VARCHAR(80), 
	submitted_by_user_id UUID NOT NULL, 
	reviewed_by_user_id UUID, 
	uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	processed_at TIMESTAMP WITH TIME ZONE, 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	failure_code VARCHAR(100), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_scan_form_identifier UNIQUE (facility_id, form_identifier), 
	CONSTRAINT uq_scan_facility_checksum UNIQUE (facility_id, sha256), 
	CONSTRAINT ck_scan_status CHECK (processing_status IN ('uploaded','queued_for_processing','processing','needs_review','processing_failed','clarification_required','verified','rejected')), 
	FOREIGN KEY(facility_id) REFERENCES facilities (id) ON DELETE RESTRICT, 
	FOREIGN KEY(encounter_id) REFERENCES encounters (id) ON DELETE RESTRICT, 
	FOREIGN KEY(submitted_by_user_id) REFERENCES users (id) ON DELETE RESTRICT, 
	FOREIGN KEY(reviewed_by_user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE clinical_decisions (
	id UUID NOT NULL, 
	scan_document_id UUID NOT NULL, 
	revision INTEGER NOT NULL, 
	followup_required BOOLEAN NOT NULL, 
	severity VARCHAR(16), 
	scheduled_at TIMESTAMP WITH TIME ZONE, 
	timezone VARCHAR(64) NOT NULL, 
	clinician_user_id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_clinical_decision_revision UNIQUE (scan_document_id, revision), 
	CONSTRAINT ck_decision_severity CHECK (severity IS NULL OR severity IN ('normal','moderate','severe')), 
	CONSTRAINT ck_decision_fields CHECK ((followup_required = true AND severity IS NOT NULL AND scheduled_at IS NOT NULL) OR (followup_required = false AND severity IS NULL AND scheduled_at IS NULL)), 
	FOREIGN KEY(scan_document_id) REFERENCES scan_documents (id) ON DELETE RESTRICT, 
	FOREIGN KEY(clinician_user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE followup_orders (
	id UUID NOT NULL, 
	facility_id UUID NOT NULL, 
	patient_id UUID NOT NULL, 
	encounter_id UUID NOT NULL, 
	source_scan_document_id UUID NOT NULL, 
	created_by_clinician_id UUID NOT NULL, 
	verified_by_user_id UUID NOT NULL, 
	followup_required BOOLEAN NOT NULL, 
	severity VARCHAR(16), 
	scheduled_at TIMESTAMP WITH TIME ZONE, 
	status VARCHAR(40) NOT NULL, 
	policy_version_id UUID, 
	contact_resolution_status VARCHAR(40) NOT NULL, 
	revision INTEGER NOT NULL, 
	supersedes_followup_id UUID, 
	activated_at TIMESTAMP WITH TIME ZONE, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	cancelled_at TIMESTAMP WITH TIME ZONE, 
	cancelled_by_user_id UUID, 
	cancellation_reason VARCHAR(500), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_followup_source_scan UNIQUE (source_scan_document_id), 
	CONSTRAINT ck_followup_severity CHECK (severity IS NULL OR severity IN ('normal','moderate','severe')), 
	CONSTRAINT ck_followup_status CHECK (status IN ('pending_verification','active','contact_resolution_required','completed','cancelled','superseded','not_required')), 
	CONSTRAINT ck_followup_decision_fields CHECK ((followup_required = false AND severity IS NULL AND scheduled_at IS NULL) OR (followup_required = true AND severity IS NOT NULL AND scheduled_at IS NOT NULL)), 
	CONSTRAINT ck_not_required_status CHECK ((status != 'not_required' OR followup_required = false)), 
	CONSTRAINT ck_active_followup_policy CHECK ((status NOT IN ('active','contact_resolution_required')) OR (followup_required = true AND policy_version_id IS NOT NULL)), 
	FOREIGN KEY(facility_id) REFERENCES facilities (id) ON DELETE RESTRICT, 
	FOREIGN KEY(patient_id) REFERENCES patients (id) ON DELETE RESTRICT, 
	FOREIGN KEY(encounter_id) REFERENCES encounters (id) ON DELETE RESTRICT, 
	FOREIGN KEY(source_scan_document_id) REFERENCES scan_documents (id) ON DELETE RESTRICT, 
	FOREIGN KEY(created_by_clinician_id) REFERENCES users (id) ON DELETE RESTRICT, 
	FOREIGN KEY(verified_by_user_id) REFERENCES users (id) ON DELETE RESTRICT, 
	FOREIGN KEY(policy_version_id) REFERENCES policy_versions (id) ON DELETE RESTRICT, 
	FOREIGN KEY(supersedes_followup_id) REFERENCES followup_orders (id) ON DELETE RESTRICT, 
	FOREIGN KEY(cancelled_by_user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE verification_events (
	id UUID NOT NULL, 
	scan_document_id UUID NOT NULL, 
	reviewer_user_id UUID NOT NULL, 
	result VARCHAR(32) NOT NULL, 
	confirmed_fields JSONB NOT NULL, 
	correction_summary JSONB, 
	reason VARCHAR(500), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(scan_document_id) REFERENCES scan_documents (id) ON DELETE RESTRICT, 
	FOREIGN KEY(reviewer_user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE followup_revisions (
	id UUID NOT NULL, 
	followup_order_id UUID NOT NULL, 
	revision INTEGER NOT NULL, 
	severity VARCHAR(16) NOT NULL, 
	scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	reason VARCHAR(500) NOT NULL, 
	changed_by_user_id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_followup_revision UNIQUE (followup_order_id, revision), 
	FOREIGN KEY(followup_order_id) REFERENCES followup_orders (id) ON DELETE RESTRICT, 
	FOREIGN KEY(changed_by_user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE reminder_jobs (
	id UUID NOT NULL, 
	facility_id UUID NOT NULL, 
	followup_order_id UUID NOT NULL, 
	policy_version_id UUID NOT NULL, 
	patient_contact_id UUID, 
	sequence_no INTEGER NOT NULL, 
	channel VARCHAR(24) NOT NULL, 
	action_kind VARCHAR(32) NOT NULL, 
	scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	idempotency_key VARCHAR(255) NOT NULL, 
	attempt_count INTEGER NOT NULL, 
	next_retry_at TIMESTAMP WITH TIME ZONE, 
	claimed_at TIMESTAMP WITH TIME ZONE, 
	claim_token UUID, 
	provider_message_id VARCHAR(255), 
	last_error_code VARCHAR(100), 
	suppression_reason VARCHAR(160), 
	completed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_reminder_idempotency_key UNIQUE (idempotency_key), 
	CONSTRAINT ck_reminder_channel CHECK (channel IN ('whatsapp','sms','staff_call')), 
	CONSTRAINT ck_reminder_action CHECK (action_kind IN ('send_message','create_call_task')), 
	CONSTRAINT ck_reminder_status CHECK (status IN ('scheduled','claimed','sending','sent','delivered','call_task_open','completed','retry_wait','suppressed','cancelled','failed_terminal','send_unknown')), 
	FOREIGN KEY(facility_id) REFERENCES facilities (id) ON DELETE RESTRICT, 
	FOREIGN KEY(followup_order_id) REFERENCES followup_orders (id) ON DELETE RESTRICT, 
	FOREIGN KEY(policy_version_id) REFERENCES policy_versions (id) ON DELETE RESTRICT, 
	FOREIGN KEY(patient_contact_id) REFERENCES patient_contacts (id) ON DELETE RESTRICT
);

CREATE TABLE communication_attempts (
	id UUID NOT NULL, 
	reminder_job_id UUID NOT NULL, 
	attempt_no INTEGER NOT NULL, 
	channel VARCHAR(24) NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	finished_at TIMESTAMP WITH TIME ZONE, 
	result VARCHAR(40) NOT NULL, 
	provider_reference VARCHAR(255), 
	staff_user_id UUID, 
	error_code VARCHAR(100), 
	safe_result_notes VARCHAR(500), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_attempt_job_number UNIQUE (reminder_job_id, attempt_no), 
	FOREIGN KEY(reminder_job_id) REFERENCES reminder_jobs (id) ON DELETE RESTRICT, 
	FOREIGN KEY(staff_user_id) REFERENCES users (id) ON DELETE RESTRICT
);


CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update_delete ON audit_events;
CREATE TRIGGER audit_events_no_update_delete
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();



-- Insert Facility
INSERT INTO facilities (id, name, timezone, active, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'CareTrack General Hospital', 'Asia/Kolkata', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert Pre-Provisioned Staff Users (Password: CareTrack@2026)
INSERT INTO users (id, facility_id, username, display_name, role, system_identifier, work_email, department, password_hash, is_active, status, created_at, updated_at)
VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'doctor', 'Dr. Amelia Reed', 'doctor', 'DOC-1029', 'amelia.reed@caretrack.health', 'Cardiology', 'pbkdf2_sha256$100000$ad4856f6deec5c02ca63946c6a71bd34$51ee7c2f4acc87d2f67ea386ebb230275eccb75527348a167df7367a3e60fd5b', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'assistant', 'Dr. Marcus Chen (Assistant)', 'assistant_verifier', 'AST-9021', 'marcus.chen@caretrack.health', 'Emergency Medicine', 'pbkdf2_sha256$100000$ad4856f6deec5c02ca63946c6a71bd34$51ee7c2f4acc87d2f67ea386ebb230275eccb75527348a167df7367a3e60fd5b', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'coordinator', 'James Okafor', 'followup_coordinator', 'STF-4410', 'james.okafor@caretrack.health', 'Laboratory', 'pbkdf2_sha256$100000$ad4856f6deec5c02ca63946c6a71bd34$51ee7c2f4acc87d2f67ea386ebb230275eccb75527348a167df7367a3e60fd5b', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'supervisor', 'Nadia Williams (Head)', 'clinic_supervisor', 'HD-101', 'nadia.williams@caretrack.health', 'Nursing Operations', 'pbkdf2_sha256$100000$ad4856f6deec5c02ca63946c6a71bd34$51ee7c2f4acc87d2f67ea386ebb230275eccb75527348a167df7367a3e60fd5b', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'reception', 'Priya Nair', 'receptionist', 'RCP-302', 'priya.nair@caretrack.health', 'Front Office', 'pbkdf2_sha256$100000$ad4856f6deec5c02ca63946c6a71bd34$51ee7c2f4acc87d2f67ea386ebb230275eccb75527348a167df7367a3e60fd5b', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'admin', 'IT Head', 'system_admin', 'ITH-001', 'it.head@caretrack.health', 'Security Operations', 'pbkdf2_sha256$100000$ad4856f6deec5c02ca63946c6a71bd34$51ee7c2f4acc87d2f67ea386ebb230275eccb75527348a167df7367a3e60fd5b', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'auditor', 'Compliance Auditor', 'auditor', 'AUD-001', 'auditor@caretrack.health', 'Compliance', 'pbkdf2_sha256$100000$ad4856f6deec5c02ca63946c6a71bd34$51ee7c2f4acc87d2f67ea386ebb230275eccb75527348a167df7367a3e60fd5b', true, 'active', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Insert Active Follow-up Policy
INSERT INTO policy_versions (id, facility_id, version_number, name, description, active, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 1, 'Standard Clinical Follow-up Protocol v1', 'Automated spaced follow-up scheduling for Cardiology, Internal Medicine, and Oncology discharges', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
