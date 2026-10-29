import math
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    CommunicationPreference,
    Encounter,
    FollowupOrder,
    PatientContact,
    PolicyVersion,
    ReminderJob,
)


@dataclass(frozen=True)
class JobSpec:
    sequence_no: int
    channel: str
    action_kind: str
    scheduled_at: datetime
    contact_id: Any | None
    contact_resolution: bool = False


def _permitted_contact(
    db: Session,
    followup: FollowupOrder,
    channel: str,
    *,
    allow_shared_message: bool,
) -> PatientContact | None:
    now = datetime.now(timezone.utc)
    candidates = db.scalars(
        select(PatientContact)
        .join(
            CommunicationPreference,
            CommunicationPreference.patient_contact_id == PatientContact.id,
        )
        .where(
            PatientContact.patient_id == followup.patient_id,
            PatientContact.is_active.is_(True),
            PatientContact.channel == channel,
            PatientContact.verified_at.is_not(None),
            CommunicationPreference.channel == channel,
            CommunicationPreference.purpose == "appointment_reminder",
            CommunicationPreference.permission_status == "opted_in",
            CommunicationPreference.withdrawn_at.is_(None),
        )
        .order_by(PatientContact.is_shared.asc(), PatientContact.verified_at.desc())
    ).all()
    for contact in candidates:
        preference = db.scalar(
            select(CommunicationPreference).where(
                CommunicationPreference.patient_contact_id == contact.id,
                CommunicationPreference.channel == channel,
                CommunicationPreference.purpose == "appointment_reminder",
            )
        )
        if preference and preference.expires_at and preference.expires_at <= now:
            continue
        if contact.is_shared and (channel == "voice" or not allow_shared_message):
            continue
        return contact
    return None


def _local_clock(value: str) -> time:
    try:
        hour, minute = (int(part) for part in value.split(":", 1))
        return time(hour=hour, minute=minute)
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "invalid_policy_time", "message": "Policy contact hours must use HH:MM"},
        ) from exc


def compute_spaced_offsets(total_days: int) -> list[int]:
    """
    Spaced scheduling:
    - Reminders 2 days apart starting from Day 2 (Day 2, Day 4, Day 6...).
    - Final reminder 1 day before the scheduled appointment day (Day total_days - 1).
    - If total_days <= 1: returns [] (triggers short_interval_action).
    - If total_days == 2: returns [1].
    - If total_days is odd (e.g. 7): Day 2, Day 4, Day 6 (Day 6 is 1 day before Day 7).
    - If total_days is even (e.g. 6): Day 2, Day 4, Day 5 (Day 5 is 1 day before Day 6).
    """
    if total_days <= 1:
        return []
    if total_days == 2:
        return [1]

    offsets: list[int] = []
    day = 2
    while day < total_days - 1:
        offsets.append(day)
        day += 2

    final_day = total_days - 1
    if not offsets or offsets[-1] != final_day:
        offsets.append(final_day)

    return sorted(list(set(offsets)))


def resolve_checkpoint_action(
    severity: str | None,
    index: int,
    total_checkpoints: int,
    policy_actions: list[str] | None = None,
) -> str:
    if policy_actions and index <= len(policy_actions):
        return policy_actions[index - 1]
    if severity == "severe":
        return "call"
    if severity == "moderate":
        if index >= max(1, total_checkpoints - 1):
            return "call"
        return "message"
    return "message"


def build_job_specs(
    db: Session,
    followup: FollowupOrder,
    encounter: Encounter,
    policy: PolicyVersion,
    facility_timezone: str,
) -> list[JobSpec]:
    config = policy.config
    zone = ZoneInfo(config.get("timezone") or facility_timezone)
    plan_start = encounter.encounter_at.astimezone(zone)
    appointment = followup.scheduled_at.astimezone(zone)
    total_days = (appointment.date() - plan_start.date()).days
    if total_days <= 0 or appointment <= plan_start:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "appointment_not_after_encounter",
                "message": "The clinician must resolve a follow-up time after the encounter time",
            },
        )

    start_clock = _local_clock(config.get("allowed_start", "09:00"))
    end_clock = _local_clock(config.get("allowed_end", "17:00"))
    if start_clock >= end_clock:
        raise HTTPException(
            status_code=422,
            detail={"code": "invalid_policy_window", "message": "Policy contact start must precede end"},
        )

    schedule_mode = config.get("schedule_mode", "spaced")
    if schedule_mode == "fractional":
        fractions: list[float] = config.get("fractions", [])
        actions: list[str] = config.get("actions", {}).get(followup.severity or "", [])
        if not fractions or len(actions) != len(fractions):
            raise HTTPException(
                status_code=409,
                detail={"code": "policy_schedule_invalid", "message": "Active policy schedule is incomplete"},
            )
        offset_action_pairs = [
            (max(1, math.floor(total_days * float(frac) + 0.5)), act)
            for frac, act in zip(fractions, actions, strict=True)
        ]
    else:
        # Spaced scheduling mode (reminders two days apart, final reminder 1 day before appointment)
        spaced_offsets = compute_spaced_offsets(total_days)
        policy_actions = config.get("actions", {}).get(followup.severity or "", [])
        offset_action_pairs = [
            (
                offset,
                resolve_checkpoint_action(
                    followup.severity,
                    idx,
                    len(spaced_offsets),
                    policy_actions if len(policy_actions) == len(spaced_offsets) else None,
                ),
            )
            for idx, offset in enumerate(spaced_offsets, start=1)
        ]

    specs: list[JobSpec] = []
    chosen_contact = _permitted_contact(
        db,
        followup,
        config.get("message_channel", "sms"),
        allow_shared_message=bool(config.get("allow_shared_neutral_messages", False)),
    )
    voice_contact = _permitted_contact(
        db,
        followup,
        "voice",
        allow_shared_message=False,
    )
    if followup.severity == "severe" and config.get("severe_initial_message", True):
        if chosen_contact:
            specs.append(
                JobSpec(
                    sequence_no=0,
                    channel=config.get("message_channel", "sms"),
                    action_kind="send_message",
                    scheduled_at=datetime.now(timezone.utc),
                    contact_id=chosen_contact.id,
                )
            )
        else:
            specs.append(
                JobSpec(
                    sequence_no=0,
                    channel="staff_call",
                    action_kind="create_call_task",
                    scheduled_at=datetime.now(timezone.utc),
                    contact_id=None,
                    contact_resolution=True,
                )
            )

    seen_dates: set[date] = set()
    duplicates_or_short = len(offset_action_pairs) == 0
    activation_day = datetime.now(timezone.utc).astimezone(zone).date()
    for index, (offset, action) in enumerate(offset_action_pairs, start=1):
        checkpoint_day = plan_start.date() + timedelta(days=offset)
        if (
            checkpoint_day <= activation_day
            or checkpoint_day >= appointment.date()
            or checkpoint_day in seen_dates
        ):
            duplicates_or_short = True
            continue
        seen_dates.add(checkpoint_day)
        if action == "suppress":
            continue
        scheduled_local = datetime.combine(checkpoint_day, start_clock, tzinfo=zone)
        if scheduled_local >= appointment:
            duplicates_or_short = True
            continue
        if action == "message":
            if chosen_contact:
                specs.append(
                    JobSpec(
                        sequence_no=index,
                        channel=config.get("message_channel", "sms"),
                        action_kind="send_message",
                        scheduled_at=scheduled_local.astimezone(timezone.utc),
                        contact_id=chosen_contact.id,
                    )
                )
            else:
                specs.append(
                    JobSpec(
                        sequence_no=index,
                        channel="staff_call",
                        action_kind="create_call_task",
                        scheduled_at=scheduled_local.astimezone(timezone.utc),
                        contact_id=None,
                        contact_resolution=True,
                    )
                )
        elif action == "call":
            specs.append(
                JobSpec(
                    sequence_no=index,
                    channel="staff_call",
                    action_kind="create_call_task",
                    scheduled_at=scheduled_local.astimezone(timezone.utc),
                    contact_id=voice_contact.id if voice_contact else None,
                    contact_resolution=voice_contact is None,
                )
            )

    if duplicates_or_short and config.get("short_interval_action", "call_task") == "call_task":
        if not any(s.sequence_no > 0 for s in specs) or schedule_mode == "fractional":
            specs.append(
                JobSpec(
                    sequence_no=90,
                    channel="staff_call",
                    action_kind="create_call_task",
                    scheduled_at=datetime.now(timezone.utc),
                    contact_id=voice_contact.id if voice_contact else None,
                    contact_resolution=voice_contact is None,
                )
            )
    return specs


def create_schedule(
    db: Session,
    followup: FollowupOrder,
    encounter: Encounter,
    policy: PolicyVersion,
    facility_timezone: str,
) -> bool:
    specs = build_job_specs(db, followup, encounter, policy, facility_timezone)
    unresolved = False
    for spec in specs:
        unresolved = unresolved or spec.contact_resolution
        key = (
            f"{followup.id}:{followup.revision}:{policy.id}:"
            f"{spec.sequence_no}:{spec.action_kind}"
        )
        existing = db.scalar(select(ReminderJob).where(ReminderJob.idempotency_key == key))
        if existing:
            continue
        db.add(
            ReminderJob(
                facility_id=followup.facility_id,
                followup_order_id=followup.id,
                policy_version_id=policy.id,
                patient_contact_id=spec.contact_id,
                sequence_no=spec.sequence_no,
                channel=spec.channel,
                action_kind=spec.action_kind,
                scheduled_at=spec.scheduled_at,
                status="scheduled",
                idempotency_key=key,
                suppression_reason=(
                    "contact_resolution_required" if spec.contact_resolution else None
                ),
            )
        )
    followup.status = "contact_resolution_required" if unresolved else "active"
    followup.contact_resolution_status = "required" if unresolved else "resolved"
    return unresolved
