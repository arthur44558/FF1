from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.core.security import require_permission
from app.db import get_db
from app.models import AuditEvent, Facility, PolicyVersion, User
from app.schemas import PolicyApproveIn, PolicyCreate, PolicyOut

router = APIRouter(prefix="/api/v1", tags=["policies and audit"])


@router.get("/policies", response_model=dict[str, Any])
def list_policies(
    user: Annotated[User, Depends(require_permission("policy:read"))],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    policies = db.scalars(
        select(PolicyVersion)
        .where(PolicyVersion.facility_id == user.facility_id)
        .order_by(PolicyVersion.name, PolicyVersion.version.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return {
        "items": [
            PolicyOut(
                id=policy.id,
                name=policy.name,
                version=policy.version,
                config=policy.config,
                approved_by_user_id=policy.approved_by_user_id,
                approval_reference=policy.approval_reference,
                approved_at=policy.approved_at,
                effective_from=policy.effective_from,
                is_active=policy.is_active,
                created_at=policy.created_at,
            ).model_dump(mode="json")
            for policy in policies
        ],
        "limit": limit,
        "offset": offset,
    }


@router.post("/policies", response_model=PolicyOut, status_code=201)
def create_policy(
    body: PolicyCreate,
    request: Request,
    user: Annotated[User, Depends(require_permission("policy:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> PolicyOut:
    facility = db.get(Facility, user.facility_id)
    if facility is None or body.config.timezone != facility.timezone:
        raise HTTPException(status_code=422, detail={"code": "facility_timezone_required"})
    try:
        ZoneInfo(body.config.timezone)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=422, detail={"code": "invalid_timezone"}) from exc
    version = (
        db.scalar(
            select(func.max(PolicyVersion.version)).where(
                PolicyVersion.facility_id == user.facility_id,
                PolicyVersion.name == body.name,
            )
        )
        or 0
    ) + 1
    policy = PolicyVersion(
        facility_id=user.facility_id,
        name=body.name,
        version=version,
        config=body.config.model_dump(mode="json"),
        is_active=False,
    )
    db.add(policy)
    db.flush()
    record_audit(
        db,
        request,
        user,
        "policy.draft_created",
        "policy_version",
        policy.id,
        summary={"name": policy.name, "version": policy.version},
    )
    return PolicyOut(
        id=policy.id,
        name=policy.name,
        version=policy.version,
        config=policy.config,
        approved_by_user_id=policy.approved_by_user_id,
        approval_reference=policy.approval_reference,
        approved_at=policy.approved_at,
        effective_from=policy.effective_from,
        is_active=policy.is_active,
        created_at=policy.created_at,
    )


@router.post("/policies/{policy_id}/approve", response_model=PolicyOut)
def approve_policy(
    policy_id: UUID,
    body: PolicyApproveIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("policy:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> PolicyOut:
    policy = db.scalar(
        select(PolicyVersion).where(
            PolicyVersion.id == policy_id,
            PolicyVersion.facility_id == user.facility_id,
        )
    )
    if policy is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    if policy.approved_at is not None:
        raise HTTPException(status_code=409, detail={"code": "policy_immutable_after_approval"})
    config = policy.config
    if not config.get("fractions") or not config.get("actions"):
        raise HTTPException(status_code=422, detail={"code": "policy_schedule_invalid"})
    policy.approved_by_user_id = user.id
    policy.approval_reference = body.approval_reference
    policy.approved_at = datetime.now(timezone.utc)
    record_audit(
        db,
        request,
        user,
        "policy.approved",
        "policy_version",
        policy.id,
        reason=body.approval_reference,
        summary={"name": policy.name, "version": policy.version},
    )
    return PolicyOut(
        id=policy.id,
        name=policy.name,
        version=policy.version,
        config=policy.config,
        approved_by_user_id=policy.approved_by_user_id,
        approval_reference=policy.approval_reference,
        approved_at=policy.approved_at,
        effective_from=policy.effective_from,
        is_active=policy.is_active,
        created_at=policy.created_at,
    )


@router.post("/policies/{policy_id}/activate", response_model=PolicyOut)
def activate_policy(
    policy_id: UUID,
    request: Request,
    user: Annotated[User, Depends(require_permission("policy:activate"))],
    db: Annotated[Session, Depends(get_db)],
) -> PolicyOut:
    policy = db.scalar(
        select(PolicyVersion).where(
            PolicyVersion.id == policy_id,
            PolicyVersion.facility_id == user.facility_id,
        )
    )
    if policy is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    if policy.approved_at is None:
        raise HTTPException(status_code=409, detail={"code": "policy_approval_required"})
    if policy.is_active:
        return PolicyOut(
            id=policy.id,
            name=policy.name,
            version=policy.version,
            config=policy.config,
            approved_by_user_id=policy.approved_by_user_id,
            approval_reference=policy.approval_reference,
            approved_at=policy.approved_at,
            effective_from=policy.effective_from,
            is_active=True,
            created_at=policy.created_at,
        )
    now = datetime.now(timezone.utc)
    current = db.scalars(
        select(PolicyVersion).where(
            PolicyVersion.facility_id == user.facility_id,
            PolicyVersion.is_active.is_(True),
        )
    ).all()
    for old in current:
        old.is_active = False
        old.retired_at = now
    policy.is_active = True
    policy.effective_from = now
    record_audit(
        db,
        request,
        user,
        "policy.activated",
        "policy_version",
        policy.id,
        summary={"name": policy.name, "version": policy.version},
    )
    return PolicyOut(
        id=policy.id,
        name=policy.name,
        version=policy.version,
        config=policy.config,
        approved_by_user_id=policy.approved_by_user_id,
        approval_reference=policy.approval_reference,
        approved_at=policy.approved_at,
        effective_from=policy.effective_from,
        is_active=policy.is_active,
        created_at=policy.created_at,
    )


@router.get("/audit-events", response_model=dict[str, Any])
def list_audit_events(
    request: Request,
    user: Annotated[User, Depends(require_permission("audit:read"))],
    db: Annotated[Session, Depends(get_db)],
    entity_type: str | None = Query(default=None, max_length=80),
    action: str | None = Query(default=None, max_length=120),
    since: datetime | None = None,
    until: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    statement = select(AuditEvent).where(AuditEvent.facility_id == user.facility_id)
    if entity_type:
        statement = statement.where(AuditEvent.entity_type == entity_type)
    if action:
        statement = statement.where(AuditEvent.action == action)
    if since:
        statement = statement.where(AuditEvent.occurred_at >= since)
    if until:
        statement = statement.where(AuditEvent.occurred_at <= until)
    events = db.scalars(
        statement.order_by(AuditEvent.occurred_at.desc()).limit(limit).offset(offset)
    ).all()
    record_audit(
        db,
        request,
        user,
        "audit.events_read",
        "audit_event",
        uuid4(),
        summary={"entity_type_filter": entity_type, "action_filter": action, "limit": limit},
    )
    return {
        "items": [
            {
                "id": str(event.id),
                "occurred_at": event.occurred_at.isoformat(),
                "actor_type": event.actor_type,
                "actor_user_id": str(event.actor_user_id) if event.actor_user_id else None,
                "action": event.action,
                "entity_type": event.entity_type,
                "entity_id": str(event.entity_id),
                "request_id": event.request_id,
                "reason": event.reason,
                "change_summary": event.change_summary,
            }
            for event in events
        ],
        "limit": limit,
        "offset": offset,
    }
