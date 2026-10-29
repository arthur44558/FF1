import os
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db import SessionLocal
from app.models import Facility, PolicyVersion, User

DEFAULT_USERS = [
    ("doctor", "Dr. Amelia Reed", "doctor", "DOC-1029", "amelia.reed@caretrack.health", "Cardiology"),
    ("assistant", "Dr. Marcus Chen (Assistant)", "assistant_verifier", "AST-9021", "marcus.chen@caretrack.health", "Emergency Medicine"),
    ("coordinator", "James Okafor", "followup_coordinator", "STF-4410", "james.okafor@caretrack.health", "Laboratory"),
    ("supervisor", "Nadia Williams (Head)", "clinic_supervisor", "HD-101", "nadia.williams@caretrack.health", "Nursing Operations"),
    ("admin", "IT Head", "system_admin", "ITH-001", "it.head@caretrack.health", "Security Operations"),
    ("auditor", "Compliance Auditor", "auditor", "AUD-001", "auditor@caretrack.health", "Compliance"),
    ("reception", "Priya Nair", "receptionist", "RCP-302", "priya.nair@caretrack.health", "Front Office"),
]


def seed_policy(db, facility: Facility) -> None:
    existing = db.scalar(
        select(PolicyVersion.id).where(
            PolicyVersion.facility_id == facility.id,
            PolicyVersion.name == "clinic-follow-up",
            PolicyVersion.version == 1,
        )
    )
    if existing:
        return
    config = {
        "timezone": facility.timezone,
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
    db.add(
        PolicyVersion(
            facility_id=facility.id,
            name="clinic-follow-up",
            version=1,
            config=config,
            is_active=False,
        )
    )
    print("Created draft policy version 1; a clinic supervisor must approve it.")


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

        if settings.environment.lower() == "development":
            for username, display_name, role, system_id, email, dept in DEFAULT_USERS:
                existing = db.scalar(
                    select(User).where(
                        User.facility_id == facility.id,
                        (User.username == username) | (User.system_identifier == system_id),
                    )
                )
                if existing is None:
                    db.add(
                        User(
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
                    )
                else:
                    existing.display_name = display_name
                    existing.role = role
                    existing.system_identifier = system_id
                    existing.work_email = email
                    existing.department = dept
                    existing.password_hash = default_pwd_hash
                    existing.is_active = True
                    existing.status = "active"
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
                db.add(
                    User(
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
                )
                print("Created the initial OIDC system administrator.")

        seed_policy(db, facility)
        db.commit()
    print("Bootstrap complete.")


if __name__ == "__main__":
    main()
