import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import IdempotencyRecord


def _request_hash(payload: Any) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def replay_response(
    db: Session, scope: str, key: str | None, payload: Any
) -> dict[str, Any] | None:
    if not key:
        return None
    if len(key) > 180:
        raise HTTPException(
            status_code=400,
            detail={"code": "idempotency_key_too_long", "message": "Idempotency-Key is too long"},
        )
    existing = db.scalar(
        select(IdempotencyRecord).where(
            IdempotencyRecord.scope == scope,
            IdempotencyRecord.key == key,
        )
    )
    if not existing:
        return None
    if existing.expires_at <= datetime.now(timezone.utc):
        db.delete(existing)
        return None
    if existing.request_hash != _request_hash(payload):
        raise HTTPException(
            status_code=409,
            detail={"code": "idempotency_key_conflict", "message": "Key was already used with a different request"},
        )
    return existing.response_body


def save_idempotent_response(
    db: Session,
    scope: str,
    key: str | None,
    payload: Any,
    response: dict[str, Any],
    status_code: int = 200,
) -> None:
    if not key:
        return
    db.add(
        IdempotencyRecord(
            scope=scope,
            key=key,
            request_hash=_request_hash(payload),
            response_status=status_code,
            response_body=response,
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        )
    )
