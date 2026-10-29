import hashlib
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select

from app.core.config import settings
from app.core.crypto import destination_fingerprint, encrypt_destination, normalize_phone
from app.core.security import hash_password
from app.db import SessionLocal
from app.models import (
    CommunicationPreference,
    Encounter,
    Facility,
    FollowupOrder,
    Patient,
    PatientContact,
    PolicyVersion,
    ReminderJob,
    ScanDocument,
    User,
)
from app.services.scheduling import create_schedule

DEFAULT_USERS = [
    ("doctor", "Dr. Amelia Reed", "doctor", "DOC-1029", "amelia.reed@caretrack.health", "Cardiology"),
    ("assistant", "Dr. Marcus Chen (Assistant)", "assistant_verifier", "AST-9021", "marcus.chen@caretrack.health", "Emergency Medicine"),
    ("coordinator", "James Okafor", "followup_coordinator", "STF-4410", "james.okafor@caretrack.health", "Laboratory"),
    ("supervisor", "Nadia Williams (Head)", "clinic_supervisor", "HD-101", "nadia.williams@caretrack.health", "Nursing Operations"),
    ("admin", "IT Head", "system_admin", "ITH-001", "it.head@caretrack.health", "Security Operations"),
    ("auditor", "Compliance Auditor", "auditor", "AUD-001", "auditor@caretrack.health", "Compliance"),
    ("reception", "Priya Nair", "receptionist", "RCP-302", "priya.nair@caretrack.health", "Front Office"),
]

SEED_PATIENTS = [
    {
        "identifier": "PT-20496",
        "name": "Elena Marlowe",
        "dob": date(1984, 4, 16),
        "phone": "+16175550142",
        "severity": "moderate",
        "encounter_code": "ENC-20496",
        "days_offset": 5,
    },
    {
        "identifier": "PT-31842",
        "name": "Marcus Chen",
        "dob": date(1977, 9, 2),
        "phone": "+16175550195",
        "severity": "normal",
        "encounter_code": "ENC-31842",
        "days_offset": 7,
    },
    {
        "identifier": "PT-58213",
        "name": "Priya Shah",
        "dob": date(1992, 1, 28),
        "phone": "+18575550128",
        "severity": "severe",
        "encounter_code": "ENC-58213",
        "days_offset": 2,
    },
    {
        "identifier": "PT-74601",
        "name": "Jordan Ellis",
        "dob": date(1969, 6, 11),
        "phone": "+17815550164",
        "severity": "normal",
        "encounter_code": "ENC-74601",
        "days_offset": 10,
    },
    {
        "identifier": "PT-49107",
        "name": "Avery Thompson",
        "dob": date(2001, 12, 4),
        "phone": "+13395550171",
        "severity": "moderate",
        "encounter_code": "ENC-49107",
        "days_offset": -2,  # Overdue!
    },
    {
        "identifier": "PT-82539",
        "name": "Noah Williams",
        "dob": date(1958, 3, 22),
        "phone": "+17815550116",
        "severity": "severe",
        "encounter_code": "ENC-82539",
        "days_offset": 1,  # Tomorrow!
    },
]


def seed_policy(db, facility: Facility) -> PolicyVersion:
    existing = db.scalar(
        select(PolicyVersion).where(
            PolicyVersion.facility_id == facility.id,
            PolicyVersion.name == "clinic-follow-up",
            PolicyVersion.version == 1,
        )
    )
    if existing:
        existing.is_active = True
        if "schedule_mode" not in existing.config:
            new_conf = dict(existing.config)
            new_conf["schedule_mode"] = "spaced"
            existing.config = new_conf
        return existing

    config = {
        "timezone": facility.timezone,
        "schedule_mode": "spaced",
        "fractions": [0.29, 0.57, 0.79, 0.86, 0.93],
        "actions": {
            "normal": ["message", "message", "message", "message", "message"],
            "moderate": ["message", "message", "call", "call", "call"],
            "severe": ["call", "call", "call", "call", "call"],
        },
        "severe_initial_message": True,
        "message_channel": "sms",
        "template_id": "appointment_reminder_v1",
        "call_script_id": "neutral_follow_up_v1",
        "allowed_start": "09:00",
        "allowed_end": "17:00",
        "allow_shared_neutral_messages": False,
        "short_interval_action": "call_task",
        "overdue_priority_by_severity": False,
        "provider_policy_reviewed": False,
        "message_content_approval_reference": None,
    }
    policy = PolicyVersion(
        facility_id=facility.id,
        name="clinic-follow-up",
        version=1,
        config=config,
        is_active=True,
        effective_from=datetime.now(timezone.utc),
    )
    db.add(policy)
    db.flush()
    print("Created active policy version 1.")
    return policy


def seed_patient_records(db, facility: Facility, doctor: User, assistant: User, policy: PolicyVersion) -> None:
    for item in SEED_PATIENTS:
        # 1. Patient
        patient = db.scalar(
            select(Patient).where(
                Patient.facility_id == facility.id,
                Patient.hospital_patient_identifier == item["identifier"],
            )
        )
        if not patient:
            patient = Patient(
                facility_id=facility.id,
                hospital_patient_identifier=item["identifier"],
                display_name=item["name"],
                date_of_birth=item["dob"],
                identity_status="verified",
            )
            db.add(patient)
            db.flush()

        # 2. Contact (SMS & Voice)
        clean_phone = normalize_phone(item["phone"])
        fprint = destination_fingerprint(clean_phone)
        contact = db.scalar(
            select(PatientContact).where(
                PatientContact.patient_id == patient.id,
                PatientContact.destination_fingerprint == fprint,
                PatientContact.channel == "sms",
            )
        )
        if not contact:
            contact = PatientContact(
                patient_id=patient.id,
                channel="sms",
                destination_encrypted=encrypt_destination(clean_phone),
                destination_fingerprint=fprint,
                verified_at=datetime.now(timezone.utc),
                is_shared=False,
                sharing_status_source="patient_direct_declaration",
                is_active=True,
            )
            db.add(contact)
            db.flush()

            pref = CommunicationPreference(
                patient_contact_id=contact.id,
                purpose="appointment_reminder",
                channel="sms",
                permission_status="opted_in",
                evidence_type="in_person_declaration",
                evidence_reference="Reception intake consent",
                captured_by_user_id=doctor.id,
                captured_at=datetime.now(timezone.utc),
            )
            db.add(pref)

        # Also voice contact for staff calls
        voice_contact = db.scalar(
            select(PatientContact).where(
                PatientContact.patient_id == patient.id,
                PatientContact.destination_fingerprint == fprint,
                PatientContact.channel == "voice",
            )
        )
        if not voice_contact:
            voice_contact = PatientContact(
                patient_id=patient.id,
                channel="voice",
                destination_encrypted=encrypt_destination(clean_phone),
                destination_fingerprint=fprint,
                verified_at=datetime.now(timezone.utc),
                is_shared=False,
                sharing_status_source="patient_direct_declaration",
                is_active=True,
            )
            db.add(voice_contact)
            db.flush()

            vpref = CommunicationPreference(
                patient_contact_id=voice_contact.id,
                purpose="appointment_reminder",
                channel="voice",
                permission_status="opted_in",
                evidence_type="in_person_declaration",
                evidence_reference="Reception intake consent",
                captured_by_user_id=doctor.id,
                captured_at=datetime.now(timezone.utc),
            )
            db.add(vpref)

        # 3. Encounter
        encounter = db.scalar(
            select(Encounter).where(
                Encounter.facility_id == facility.id,
                Encounter.external_encounter_identifier == item["encounter_code"],
            )
        )
        if not encounter:
            encounter = Encounter(
                facility_id=facility.id,
                patient_id=patient.id,
                external_encounter_identifier=item["encounter_code"],
                clinician_user_id=doctor.id,
                encounter_at=datetime.now(timezone.utc) - timedelta(days=5),
            )
            db.add(encounter)
            db.flush()

        # 4. Scan Document
        scan_form_id = f"FORM-{item['identifier']}"
        scan = db.scalar(
            select(ScanDocument).where(
                ScanDocument.facility_id == facility.id,
                ScanDocument.form_identifier == scan_form_id,
            )
        )
        if not scan:
            dummy_sha = hashlib.sha256(scan_form_id.encode()).hexdigest()
            scan = ScanDocument(
                facility_id=facility.id,
                form_identifier=scan_form_id,
                form_version="v1",
                encounter_id=encounter.id,
                storage_key=f"scans/{scan_form_id}.pdf",
                sha256=dummy_sha,
                mime_type="application/pdf",
                size_bytes=1024,
                processing_status="verified",
                submitted_by_user_id=assistant.id,
                reviewed_by_user_id=doctor.id,
            )
            db.add(scan)
            db.flush()

        # 5. Followup Order
        order = db.scalar(
            select(FollowupOrder).where(
                FollowupOrder.source_scan_document_id == scan.id
            )
        )
        target_date = datetime.now(timezone.utc) + timedelta(days=item["days_offset"])
        if not order:
            order = FollowupOrder(
                facility_id=facility.id,
                patient_id=patient.id,
                encounter_id=encounter.id,
                source_scan_document_id=scan.id,
                created_by_clinician_id=doctor.id,
                verified_by_user_id=assistant.id,
                followup_required=True,
                severity=item["severity"],
                scheduled_at=target_date,
                status="active",
                policy_version_id=policy.id,
                contact_resolution_status="not_required",
                revision=1,
                activated_at=datetime.now(timezone.utc),
            )
            db.add(order)
            db.flush()

        # 6. Reminder Jobs
        if item["days_offset"] > 0:
            create_schedule(db, order, encounter, policy, facility.timezone)
        else:
            job_key = f"REM-{item['identifier']}-1"
            job = db.scalar(
                select(ReminderJob).where(
                    ReminderJob.idempotency_key == job_key
                )
            )
            if not job:
                job = ReminderJob(
                    facility_id=facility.id,
                    followup_order_id=order.id,
                    policy_version_id=policy.id,
                    patient_contact_id=contact.id,
                    sequence_no=1,
                    channel="staff_call",
                    action_kind="create_call_task",
                    scheduled_at=target_date,
                    status="call_task_open",
                    idempotency_key=job_key,
                    attempt_count=1,
                )
                db.add(job)

    print(f"Seeded {len(SEED_PATIENTS)} historical patient records with encounters, orders & reminders.")


def main() -> None:
    if settings.environment.lower() == "development":
        if settings.auth_mode != "development":
            raise SystemExit("Development bootstrap requires AUTH_MODE=development")
    elif settings.auth_mode != "oidc":
        raise SystemExit("Non-development bootstrap requires OIDC authentication")

    facility_name = os.getenv("BOOTSTRAP_FACILITY_NAME", "Local Development Clinic")
    timezone_name = os.getenv("BOOTSTRAP_FACILITY_TIMEZONE", "Asia/Kolkata")
    try:
        ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as exc:
        raise SystemExit("BOOTSTRAP_FACILITY_TIMEZONE must be an IANA timezone") from exc

    with SessionLocal() as db:
        facility = db.scalar(select(Facility).order_by(Facility.created_at).limit(1))
        if facility is None:
            facility = Facility(name=facility_name, timezone=timezone_name, active=True)
            db.add(facility)
            db.flush()
            print(f"Created facility {facility.name} ({facility.timezone}).")

        default_pwd_hash = hash_password("CareTrack@2026")
        created_users = {}

        if settings.environment.lower() == "development":
            for username, display_name, role, system_id, email, dept in DEFAULT_USERS:
                existing = db.scalar(
                    select(User).where(
                        User.facility_id == facility.id,
                        (User.username == username) | (User.system_identifier == system_id),
                    )
                )
                if existing is None:
                    user_obj = User(
                        facility_id=facility.id,
                        username=username,
                        display_name=display_name,
                        role=role,
                        system_identifier=system_id,
                        work_email=email,
                        department=dept,
                        password_hash=default_pwd_hash,
                        is_active=True,
                        status="active",
                    )
                    db.add(user_obj)
                    db.flush()
                    created_users[username] = user_obj
                else:
                    existing.display_name = display_name
                    existing.role = role
                    existing.system_identifier = system_id
                    existing.work_email = email
                    existing.department = dept
                    existing.password_hash = default_pwd_hash
                    existing.is_active = True
                    existing.status = "active"
                    created_users[username] = existing

            print("Development staff accounts initialized with Generated Unique IDs and password 'CareTrack@2026':")
            for _, display_name, role, system_id, _, _ in DEFAULT_USERS:
                print(f"  - {system_id} | {display_name} ({role})")
        else:
            username = os.getenv("BOOTSTRAP_ADMIN_USERNAME", "").strip()
            display_name = os.getenv("BOOTSTRAP_ADMIN_NAME", "").strip()
            subject = os.getenv("BOOTSTRAP_ADMIN_SUBJECT", "").strip()
            if not all((username, display_name, subject)):
                raise SystemExit(
                    "Set BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_NAME and "
                    "BOOTSTRAP_ADMIN_SUBJECT for the first OIDC system administrator."
                )
            existing = db.scalar(
                select(User).where(
                    (User.username == username) | (User.external_subject == subject)
                )
            )
            if existing is None:
                existing = User(
                    facility_id=facility.id,
                    username=username,
                    display_name=display_name,
                    external_subject=subject,
                    role="system_admin",
                    system_identifier="ITH-001",
                    password_hash=default_pwd_hash,
                    is_active=True,
                    status="active",
                )
                db.add(existing)
                db.flush()
                print("Created the initial OIDC system administrator.")
            created_users["admin"] = existing

        policy = seed_policy(db, facility)

        doc_user = created_users.get("doctor") or db.scalar(select(User).where(User.role == "doctor"))
        ast_user = created_users.get("assistant") or db.scalar(select(User).where(User.role == "assistant_verifier"))

        if doc_user and ast_user:
            seed_patient_records(db, facility, doc_user, ast_user, policy)

        db.commit()
    print("Bootstrap complete.")


if __name__ == "__main__":
    main()
