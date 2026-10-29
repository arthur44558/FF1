from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import uuid4

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.core.config import settings
from app.core.security import current_user, permissions_for, require_permission
from app.db import get_db
from app.models import User
from app.schemas import DevTokenRequest, MeOut, UserCreate, UserOut, UserPatch

router = APIRouter(prefix="/api/v1", tags=["authentication and staff"])
_token_attempts: dict[str, list[datetime]] = {}


@router.post("/dev/token")
def development_token(
    body: DevTokenRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    if settings.environment.lower() != "development" or settings.auth_mode != "development":
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    if not settings.dev_auth_secret:
        raise HTTPException(
            status_code=503,
            detail={"code": "dev_auth_disabled", "message": "Set DEV_AUTH_SECRET to enable local tokens"},
        )
    now = datetime.now(timezone.utc)
    key = request.client.host if request.client else "unknown"
    recent = [item for item in _token_attempts.get(key, []) if now - item < timedelta(minutes=1)]
    if len(recent) >= 10:
        raise HTTPException(status_code=429, detail={"code": "rate_limited"})
    recent.append(now)
    _token_attempts[key] = recent

    users = db.scalars(
        select(User).where(User.username == body.username, User.is_active.is_(True)).limit(2)
    ).all()
    if not users:
        raise HTTPException(
            status_code=401,
            detail={"code": "unknown_staff_identity", "message": "Staff identity is not provisioned"},
        )
    if len(users) > 1:
        raise HTTPException(status_code=409, detail={"code": "username_not_unique"})
    user = users[0]
    token = jwt.encode(
        {
            "sub": str(user.id),
            "iss": "hospital-followup-development",
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "jti": str(uuid4()),
        },
        settings.dev_auth_secret,
        algorithm="HS256",
    )
    user.last_login_at = now
    record_audit(
        db,
        request,
        user,
        "auth.development_login",
        "user",
        user.id,
        summary={"outcome": "success"},
    )
    return {"access_token": token, "token_type": "bearer", "expires_in": 900}


@router.get("/me", response_model=MeOut)
def get_me(
    user: Annotated[User, Depends(current_user)],
) -> MeOut:
    return MeOut(
        id=user.id,
        facility_id=user.facility_id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
        permissions=sorted(permissions_for(user.role)),
        environment=settings.environment,
    )


@router.get("/users", response_model=list[UserOut])
def list_users(
    user: Annotated[User, Depends(require_permission("user:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> list[User]:
    return list(
        db.scalars(
            select(User).where(User.facility_id == user.facility_id).order_by(User.username)
        ).all()
    )


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    request: Request,
    user: Annotated[User, Depends(require_permission("user:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if db.scalar(
        select(User.id).where(
            User.facility_id == user.facility_id,
            User.username == body.username,
        )
    ):
        raise HTTPException(status_code=409, detail={"code": "username_exists"})
    if body.external_subject and db.scalar(
        select(User.id).where(User.external_subject == body.external_subject)
    ):
        raise HTTPException(status_code=409, detail={"code": "external_subject_exists"})
    created = User(
        facility_id=user.facility_id,
        username=body.username,
        display_name=body.display_name,
        role=body.role.value,
        external_subject=body.external_subject,
        department=body.department,
        is_active=True,
    )
    db.add(created)
    db.flush()
    record_audit(
        db,
        request,
        user,
        "user.created",
        "user",
        created.id,
        summary={"role": created.role, "active": True},
    )
    return created


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: UserPatch,
    request: Request,
    user: Annotated[User, Depends(require_permission("user:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    try:
        parsed_id = __import__("uuid").UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"code": "not_found"}) from exc
    target = db.scalar(
        select(User).where(User.id == parsed_id, User.facility_id == user.facility_id)
    )
    if target is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    changes: dict[str, object] = {}
    if body.is_active is not None:
        target.is_active = body.is_active
        changes["is_active"] = body.is_active
    if body.role is not None:
        target.role = body.role.value
        changes["role"] = body.role.value
    if body.department is not None:
        target.department = body.department
        changes["department_changed"] = True
    record_audit(
        db,
        request,
        user,
        "user.updated",
        "user",
        target.id,
        reason=body.reason,
        summary=changes,
    )
    return target
