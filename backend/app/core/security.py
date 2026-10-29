from functools import lru_cache
from typing import Annotated, Callable
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, PyJWKClientError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.models import Facility, User


ROLE_PERMISSIONS: dict[str, set[str]] = {
    "doctor": {
        "patient:read",
        "scan:read",
        "scan:decision",
        "followup:read",
        "followup:amend",
        "followup:complete",
        "followup:cancel",
        "patient:manage",
        "contact:read",
        "contact:reveal",
        "contact:manage",
        "contact:manage_preferences",
        "reminder:read_queue",
        "reminder:record_call",
        "policy:read",
        "audit:read",
    },
    "assistant_verifier": {
        "scan:upload",
        "scan:process",
        "scan:read",
        "scan:verify",
        "followup:read",
        "patient:read",
    },
    "followup_coordinator": {
        "followup:complete",
        "followup:read",
        "patient:read",
        "contact:read",
        "contact:reveal",
        "contact:resolve",
        "contact:manage",
        "contact:manage_preferences",
        "reminder:read_queue",
        "reminder:record_call",
    },
    "clinic_supervisor": {
        "operations:read",
        "patient:read",
        "scan:read",
        "followup:read",
        "followup:complete",
        "followup:cancel",
        "patient:manage",
        "contact:read",
        "contact:reveal",
        "contact:resolve",
        "contact:manage",
        "contact:manage_preferences",
        "reminder:read_queue",
        "reminder:record_call",
        "reminder:retry_review",
        "policy:read",
        "policy:create",
        "policy:approve",
        "policy:activate",
        "audit:read",
    },
    "system_admin": {
        "operations:read",
        "user:manage",
        "policy:read",
        "policy:create",
        "system:config",
        "audit:read",
    },
    "auditor": {"audit:read", "followup:read", "policy:read", "operations:read"},
}


def permissions_for(role: str) -> set[str]:
    return ROLE_PERMISSIONS.get(role, set())


bearer = HTTPBearer(auto_error=False)


@lru_cache
def _oidc_jwks_client() -> PyJWKClient:
    if not settings.oidc_jwks_url:
        raise RuntimeError("OIDC_JWKS_URL is not configured")
    return PyJWKClient(settings.oidc_jwks_url, cache_keys=True)


def _decode_subject(token: str) -> tuple[str, bool]:
    if settings.auth_mode == "development":
        if not settings.dev_auth_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "dev_auth_disabled", "message": "Development token auth is disabled"},
            )
        try:
            payload = jwt.decode(
                token,
                settings.dev_auth_secret,
                algorithms=["HS256"],
                issuer="hospital-followup-development",
                options={"require": ["sub", "exp", "iss"]},
            )
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "invalid_token", "message": "Bearer token is invalid or expired"},
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        return str(payload["sub"]), True

    try:
        signing_key = _oidc_jwks_client().get_signing_key_from_jwt(token).key
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256", "ES256"],
            issuer=settings.oidc_issuer,
            audience=settings.oidc_audience,
            options={"require": ["sub", "exp", "iss", "aud"]},
        )
    except (jwt.PyJWTError, PyJWKClientError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_token", "message": "Bearer token is invalid or expired"},
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return str(payload["sub"]), False


def current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "authentication_required", "message": "Bearer token required"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    subject, is_development_subject = _decode_subject(credentials.credentials)
    if is_development_subject:
        try:
            user_id = UUID(subject)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "invalid_token", "message": "Bearer token subject is invalid"},
            ) from exc
        user = db.scalar(select(User).where(User.id == user_id, User.is_active.is_(True)))
    else:
        user = db.scalar(
            select(User).where(
                User.external_subject == subject,
                User.is_active.is_(True),
            )
        )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "unknown_staff_identity", "message": "Staff identity is not provisioned"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    facility = db.get(Facility, user.facility_id)
    if facility is None or not facility.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "facility_inactive", "message": "Staff facility is inactive"},
        )
    request.state.actor_user_id = str(user.id)
    return user


def require_permission(permission: str) -> Callable:
    def dependency(
        user: Annotated[User, Depends(current_user)],
    ) -> User:
        if permission not in permissions_for(user.role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "permission_denied", "message": "Required permission is missing"},
            )
        return user

    return dependency


def scoped_user_id(value: UUID, user: User) -> UUID:
    if value != user.facility_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "Resource not found"},
        )
    return value
