from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import postgresql
from app.db import Base
from app import models
import json

lines = [
    '-- CareTrack Hospital Follow-up Full PostgreSQL Schema & Initial Data for Supabase',
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
]

for table in Base.metadata.sorted_tables:
    ddl = str(CreateTable(table).compile(dialect=postgresql.dialect())).strip()
    # Ensure idempotent CREATE TABLE IF NOT EXISTS
    ddl = ddl.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ', 1)
    lines.append(ddl + ';')

trigger_sql = """
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
"""
lines.append(trigger_sql)

fac_id = "00000000-0000-0000-0000-000000000001"
pwd_hash = "pbkdf2_sha256$100000$ad4856f6deec5c02ca63946c6a71bd34$51ee7c2f4acc87d2f67ea386ebb230275eccb75527348a167df7367a3e60fd5b"

policy_config = {
    "timezone": "Asia/Kolkata",
    "schedule_mode": "spaced",
    "fractions": [0.29, 0.57, 0.79, 0.86, 0.93],
    "actions": {
        "normal": ["message", "message", "message", "message", "message"],
        "moderate": ["message", "message", "call", "call", "call"],
        "severe": ["call", "call", "call", "call", "call"]
    },
    "severe_initial_message": True
}
policy_config_json = json.dumps(policy_config)

seed_sql = f"""
-- Insert Facility
INSERT INTO facilities (id, name, timezone, active, created_at, updated_at)
VALUES ('{fac_id}', 'CareTrack General Hospital', 'Asia/Kolkata', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert Pre-Provisioned Staff Users (Password: CareTrack@2026)
INSERT INTO users (id, facility_id, username, display_name, role, system_identifier, work_email, department, password_hash, is_active, status, created_at, updated_at)
VALUES
    (gen_random_uuid(), '{fac_id}', 'doctor', 'Dr. Amelia Reed', 'doctor', 'DOC-1029', 'amelia.reed@caretrack.health', 'Cardiology', '{pwd_hash}', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '{fac_id}', 'assistant', 'Dr. Marcus Chen (Assistant)', 'assistant_verifier', 'AST-9021', 'marcus.chen@caretrack.health', 'Emergency Medicine', '{pwd_hash}', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '{fac_id}', 'coordinator', 'James Okafor', 'followup_coordinator', 'STF-4410', 'james.okafor@caretrack.health', 'Laboratory', '{pwd_hash}', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '{fac_id}', 'supervisor', 'Nadia Williams (Head)', 'clinic_supervisor', 'HD-101', 'nadia.williams@caretrack.health', 'Nursing Operations', '{pwd_hash}', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '{fac_id}', 'reception', 'Priya Nair', 'receptionist', 'RCP-302', 'priya.nair@caretrack.health', 'Front Office', '{pwd_hash}', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '{fac_id}', 'admin', 'IT Head', 'system_admin', 'ITH-001', 'it.head@caretrack.health', 'Security Operations', '{pwd_hash}', true, 'active', NOW(), NOW()),
    (gen_random_uuid(), '{fac_id}', 'auditor', 'Compliance Auditor', 'auditor', 'AUD-001', 'auditor@caretrack.health', 'Compliance', '{pwd_hash}', true, 'active', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Insert Active Follow-up Policy
INSERT INTO policy_versions (id, facility_id, name, version, config, is_active, effective_from, created_at)
VALUES
    ('00000000-0000-0000-0000-000000000002', '{fac_id}', 'clinic-follow-up', 1, '{policy_config_json}'::jsonb, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
"""
lines.append(seed_sql)

with open('backend/supabase_schema.sql', 'w', encoding='utf-8') as f:
    f.write('\n\n'.join(lines))

print('Wrote idempotent backend/supabase_schema.sql!')
