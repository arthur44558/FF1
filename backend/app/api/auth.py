import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID, uuid4

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.core.config import settings
from app.core.security import (
    current_user,
    hash_password,
    permissions_for,
    require_permission,
    verify_password,
)
from app.db import get_db
from app.models import Facility, RegistrationRequest, User
from app.schemas import (
    DevTokenRequest,
    LoginRequest,
    MeOut,
    RegistrationApprovalIn,
    RegistrationRejectionIn,
    RegistrationRequestIn,
    RegistrationRequestOut,
    UserCreate,
    UserOut,
    UserPatch,
)

router = APIRouter(prefix="/api/v1", tags=["authentication and staff"])
_token_attempts: dict[str, list[datetime]] = {}

ROLE_PREFIX_MAP = {
    "doctor": "DOC",
    "assistant_doctor": "AST",
    "assistant_verifier": "AST",
    "staff_head": "HD",
    "clinic_supervisor": "HD",
    "staff": "STF",
    "followup_coordinator": "STF",
    "receptionist": "RCP",
    "system_admin": "ITH",
    "it_head": "ITH",
    "auditor": "AUD",
}

REQUESTED_TO_BACKEND_ROLE = {
    "doctor": "doctor",
    "assistant_doctor": "assistant_verifier",
    "staff_head": "clinic_supervisor",
    "staff": "followup_coordinator",
    "receptionist": "receptionist",
}


def _generate_unique_id(db: Session, prefix: str) -> str:
    for _ in range(100):
        candidate = f"{prefix}-{random.randint(1000, 9999)}"
        if not db.scalar(select(User.id).where(User.system_identifier == candidate)):
            return candidate
    return f"{prefix}-{random.randint(10000, 99999)}"


@router.post("/auth/login")
def login(
    body: LoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    """Authenticates staff using Generated Unique ID and password.
    Returns identical safe error for unknown ID, incorrect password, or revoked account."""
    now = datetime.now(timezone.utc)
    key = request.client.host if request.client else "unknown"
    recent = [item for item in _token_attempts.get(key, []) if now - item < timedelta(minutes=1)]
    if len(recent) >= 20:
        raise HTTPException(status_code=429, detail={"code": "rate_limited", "message": "Too many login attempts. Please wait."})
    recent.append(now)
    _token_attempts[key] = recent

    identifier = body.unique_id.strip().upper()
    user = db.scalar(
        select(User).where(
            (User.system_identifier == identifier) | (User.username == body.unique_id.strip())
        )
    )

    SAFE_ERROR = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "invalid_credentials", "message": "Invalid Unique ID or Access Revoked"},
        headers={"WWW-Authenticate": "Bearer"},
    )

    if user is None:
        raise SAFE_ERROR
    if not user.is_active or user.status != "active":
        raise SAFE_ERROR
    if not verify_password(body.password, user.password_hash):
        raise SAFE_ERROR

    token_secret = settings.dev_auth_secret or "caretrack-dev-secret-key-32bytes-min"
    token = jwt.encode(
        {
            "sub": str(user.id),
            "iss": "hospital-followup-development",
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "jti": str(uuid4()),
        },
        token_secret,
        algorithm="HS256",
    )
    user.last_login_at = now
    record_audit(
        db,
        request,
        user,
        "auth.login",
        "user",
        user.id,
        summary={"system_identifier": user.system_identifier, "outcome": "success"},
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 900,
        "role": user.role,
        "system_identifier": user.system_identifier,
        "display_name": user.display_name,
    }


@router.post("/auth/register-request", status_code=201)
def request_registration(
    body: RegistrationRequestIn,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    """Public staff registration request. Stores password hash and marks as pending administrator approval."""
    if not body.certification_agreed:
        raise HTTPException(
            status_code=422,
            detail={"code": "certification_required", "message": "You must certify authorization to request clinical access."},
        )

    clean_email = body.work_email.strip().lower()
    existing_user = db.scalar(select(User.id).where(User.work_email == clean_email))
    if existing_user:
        raise HTTPException(
            status_code=409,
            detail={"code": "email_exists", "message": "An account with this work email address already exists."},
        )

    pending_req = db.scalar(
        select(RegistrationRequest.id).where(
            RegistrationRequest.work_email == clean_email,
            RegistrationRequest.status == "pending",
        )
    )
    if pending_req:
        raise HTTPException(
            status_code=409,
            detail={"code": "request_pending", "message": "A pending registration request with this email is already awaiting approval."},
        )

    facility = db.scalar(select(Facility).where(Facility.active.is_(True)).order_by(Facility.created_at).limit(1))
    if facility is None:
        raise HTTPException(status_code=500, detail={"code": "facility_not_found", "message": "No active hospital facility configured"})

    req_obj = RegistrationRequest(
        facility_id=facility.id,
        full_name=body.full_name.strip(),
        work_email=clean_email,
        department=body.department.strip(),
        requested_role=body.requested_role,
        password_hash=hash_password(body.password),
        certification_agreed=True,
        status="pending",
    )
    db.add(req_obj)
    db.flush()

    record_audit(
        db,
        request,
        None,
        "auth.registration_requested",
        "registration_request",
        req_obj.id,
        summary={"work_email": clean_email, "requested_role": body.requested_role},
        facility_id=facility.id,
    )

    return {
        "id": str(req_obj.id),
        "status": "pending",
        "message": "Registration request submitted. An administrator must verify and approve your account before you can sign in.",
    }


@router.get("/admin/registration-requests", response_model=list[RegistrationRequestOut])
def list_registration_requests(
    user: Annotated[User, Depends(require_permission("user:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> list[RegistrationRequest]:
    """IT Administrator endpoint to list pending access requests."""
    return list(
        db.scalars(
            select(RegistrationRequest)
            .where(RegistrationRequest.facility_id == user.facility_id)
            .order_by(RegistrationRequest.created_at.desc())
        ).all()
    )


@router.post("/admin/registration-requests/{request_id}/approve", response_model=UserOut)
def approve_registration_request(
    request_id: UUID,
    body: RegistrationApprovalIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("user:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """IT Administrator approves request, generates Unique ID, and provisions active User account."""
    req_obj = db.get(RegistrationRequest, request_id)
    if req_obj is None or req_obj.facility_id != user.facility_id:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Registration request not found"})
    if req_obj.status != "pending":
        raise HTTPException(status_code=400, detail={"code": "invalid_status", "message": f"Request is already {req_obj.status}"})

    backend_role = REQUESTED_TO_BACKEND_ROLE.get(req_obj.requested_role, req_obj.requested_role)
    prefix = ROLE_PREFIX_MAP.get(req_obj.requested_role, "STF")
    unique_id = _generate_unique_id(db, prefix)

    new_user = User(
        facility_id=body.assigned_facility_id or req_obj.facility_id,
        username=unique_id.lower(),
        display_name=req_obj.full_name,
        role=backend_role,
        department=req_obj.department,
        work_email=req_obj.work_email,
        system_identifier=unique_id,
        password_hash=req_obj.password_hash,
        is_active=True,
        status="active",
    )
    db.add(new_user)
    db.flush()

    req_obj.status = "approved"
    req_obj.reviewed_by_user_id = user.id
    req_obj.reviewed_at = datetime.now(timezone.utc)

    record_audit(
        db,
        request,
        user,
        "user.registration_approved",
        "user",
        new_user.id,
        summary={"system_identifier": unique_id, "role": backend_role, "request_id": str(request_id)},
    )
    return new_user


@router.post("/admin/registration-requests/{request_id}/reject")
def reject_registration_request(
    request_id: UUID,
    body: RegistrationRejectionIn,
    request: Request,
    user: Annotated[User, Depends(require_permission("user:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    """IT Administrator rejects an access request with documented reason."""
    req_obj = db.get(RegistrationRequest, request_id)
    if req_obj is None or req_obj.facility_id != user.facility_id:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Registration request not found"})
    if req_obj.status != "pending":
        raise HTTPException(status_code=400, detail={"code": "invalid_status", "message": f"Request is already {req_obj.status}"})

    req_obj.status = "rejected"
    req_obj.rejection_reason = body.reason
    req_obj.reviewed_by_user_id = user.id
    req_obj.reviewed_at = datetime.now(timezone.utc)

    record_audit(
        db,
        request,
        user,
        "user.registration_rejected",
        "registration_request",
        request_id,
        reason=body.reason,
    )
    return {"status": "rejected", "message": "Access request rejected."}


@router.post("/users/{user_id}/revoke", response_model=UserOut)
def revoke_user_access(
    user_id: UUID,
    request: Request,
    user: Annotated[User, Depends(require_permission("user:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """IT Administrator revokes user access."""
    target = db.scalar(select(User).where(User.id == user_id, User.facility_id == user.facility_id))
    if target is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "User not found"})
    target.is_active = False
    target.status = "revoked"
    record_audit(
        db,
        request,
        user,
        "user.access_revoked",
        "user",
        target.id,
        summary={"system_identifier": target.system_identifier, "is_active": False},
    )
    return target


@router.post("/users/{user_id}/restore", response_model=UserOut)
def restore_user_access(
    user_id: UUID,
    request: Request,
    user: Annotated[User, Depends(require_permission("user:manage"))],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """IT Administrator restores previously revoked user access."""
    target = db.scalar(select(User).where(User.id == user_id, User.facility_id == user.facility_id))
    if target is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "User not found"})
    target.is_active = True
    target.status = "active"
    record_audit(
        db,
        request,
        user,
        "user.access_restored",
        "user",
        target.id,
        summary={"system_identifier": target.system_identifier, "is_active": True},
    )
    return target


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
    if len(recent) >= 20:
        raise HTTPException(status_code=429, detail={"code": "rate_limited"})
    recent.append(now)
    _token_attempts[key] = recent

    users = db.scalars(
        select(User).where(
            (User.username == body.username) | (User.system_identifier == body.username.upper()),
            User.is_active.is_(True),
        ).limit(2)
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
        system_identifier=user.system_identifier,
        work_email=user.work_email,
        status=user.status,
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
    prefix = ROLE_PREFIX_MAP.get(body.role.value, "STF")
    unique_id = _generate_unique_id(db, prefix)
    created = User(
        facility_id=user.facility_id,
        username=body.username,
        display_name=body.display_name,
        role=body.role.value,
        external_subject=body.external_subject,
        department=body.department,
        system_identifier=unique_id,
        password_hash=hash_password("CareTrack@2026"),
        is_active=True,
        status="active",
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
        summary={"role": created.role, "active": True, "system_identifier": unique_id},
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
        parsed_id = UUID(user_id)
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
        target.status = "active" if body.is_active else "revoked"
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
