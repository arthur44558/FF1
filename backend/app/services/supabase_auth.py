import logging
from typing import Any
import httpx

from app.core.config import settings

logger = logging.getLogger("hospital_followup.supabase")


def is_supabase_configured() -> bool:
    """Returns True if Supabase project URL and service role key are configured."""
    return bool(settings.supabase_url and settings.supabase_service_role_key)


def _admin_headers() -> dict[str, str]:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


def _anon_headers() -> dict[str, str]:
    key = settings.supabase_anon_key or settings.supabase_service_role_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def supabase_admin_get_user_by_email(email: str) -> dict[str, Any] | None:
    """Retrieves user profile from Supabase Auth admin API matching given email."""
    if not is_supabase_configured() or not email:
        return None

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, headers=_admin_headers(), params={"page": 1, "per_page": 50})
            if resp.status_code == 200:
                data = resp.json()
                users = data.get("users", []) if isinstance(data, dict) else data
                for u in users:
                    if u.get("email", "").lower() == email.lower():
                        return u
            return None
    except Exception as exc:
        logger.error("supabase_admin_get_user_by_email_error", exc_info=exc)
        return None


def supabase_admin_create_user(email: str, password: str, metadata: dict[str, Any]) -> dict[str, Any] | None:
    """Creates an active verified user in Supabase Auth via the Admin API."""
    if not is_supabase_configured():
        return None

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": metadata,
        "app_metadata": metadata,
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, headers=_admin_headers(), json=payload)
            if resp.status_code in {200, 201}:
                return resp.json()
            if resp.status_code in {400, 422}:
                existing = supabase_admin_get_user_by_email(email)
                if existing:
                    return existing
            logger.warning(
                "supabase_create_user_failed",
                extra={"status_code": resp.status_code, "detail": resp.text},
            )
            return None
    except Exception as exc:
        logger.error("supabase_admin_create_user_error", exc_info=exc)
        return None


def supabase_admin_ban_user(supabase_uid: str) -> bool:
    """Bans a user in Supabase Auth, revoking login capability and active sessions."""
    if not is_supabase_configured() or not supabase_uid:
        return False

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{supabase_uid}"
    payload = {"ban_duration": "876000h"}
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.put(url, headers=_admin_headers(), json=payload)
            return resp.status_code in {200, 204}
    except Exception as exc:
        logger.error("supabase_admin_ban_user_error", exc_info=exc)
        return False


def supabase_admin_unban_user(supabase_uid: str) -> bool:
    """Unbans a user in Supabase Auth, restoring active login capability."""
    if not is_supabase_configured() or not supabase_uid:
        return False

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{supabase_uid}"
    payload = {"ban_duration": "none"}
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.put(url, headers=_admin_headers(), json=payload)
            return resp.status_code in {200, 204}
    except Exception as exc:
        logger.error("supabase_admin_unban_user_error", exc_info=exc)
        return False


def supabase_send_password_recovery(email: str, redirect_to: str | None = None) -> bool:
    """Dispatches a password recovery / reset email via Supabase Auth."""
    if not is_supabase_configured() or not email:
        return False

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/recover"
    payload: dict[str, Any] = {"email": email}
    if redirect_to:
        payload["redirect_to"] = redirect_to

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, headers=_anon_headers(), json=payload)
            return resp.status_code in {200, 204}
    except Exception as exc:
        logger.error("supabase_send_password_recovery_error", exc_info=exc)
        return False


def supabase_admin_update_password(supabase_uid: str, new_password: str) -> bool:
    """Updates a user's password directly via the Supabase Admin API."""
    if not is_supabase_configured() or not supabase_uid:
        return False

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{supabase_uid}"
    payload = {"password": new_password}
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.put(url, headers=_admin_headers(), json=payload)
            return resp.status_code in {200, 204}
    except Exception as exc:
        logger.error("supabase_admin_update_password_error", exc_info=exc)
        return False


def supabase_verify_credentials(email: str, password: str) -> dict[str, Any] | None:
    """Authenticates email & password against Supabase Auth endpoint."""
    if not is_supabase_configured() or not email or not password:
        return None

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
    payload = {"email": email, "password": password}
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, headers=_anon_headers(), json=payload)
            if resp.status_code == 200:
                return resp.json()
            return None
    except Exception as exc:
        logger.error("supabase_verify_credentials_error", exc_info=exc)
        return None
