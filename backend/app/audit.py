from typing import Any
from uuid import UUID

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditEvent, User


def record_audit(
    db: Session,
    request: Request,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: UUID,
    *,
    reason: str | None = None,
    summary: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditEvent(
            facility_id=actor.facility_id if actor else request.state.facility_id,
            actor_type="user" if actor else "service",
            actor_user_id=actor.id if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            request_id=getattr(request.state, "request_id", None),
            reason=reason,
            change_summary=summary,
        )
    )
