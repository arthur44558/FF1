import hashlib
import hmac
import re

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from app.core.config import settings

PHONE_PATTERN = re.compile(r"^\+[1-9][0-9]{7,14}$")


def normalize_phone(value: str) -> str:
    normalized = re.sub(r"[\s().-]", "", value.strip())
    if not PHONE_PATTERN.fullmatch(normalized):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "invalid_phone_format",
                "message": "Use an international phone number such as +919876543210",
            },
        )
    return normalized


def _fernet() -> Fernet:
    if not settings.contact_encryption_key:
        raise HTTPException(
            status_code=503,
            detail={"code": "contact_encryption_unavailable", "message": "Contact encryption is not configured"},
        )
    try:
        return Fernet(settings.contact_encryption_key.encode("ascii"))
    except (ValueError, UnicodeEncodeError) as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "contact_encryption_invalid", "message": "Contact encryption key is invalid"},
        ) from exc


def encrypt_destination(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_destination(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeEncodeError, ValueError) as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "contact_decryption_failed", "message": "Contact data cannot be decrypted"},
        ) from exc


def destination_fingerprint(value: str) -> str:
    if not settings.contact_fingerprint_key:
        raise HTTPException(
            status_code=503,
            detail={"code": "contact_fingerprint_unavailable", "message": "Contact fingerprinting is not configured"},
        )
    return hmac.new(
        settings.contact_fingerprint_key.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def mask_destination(encrypted_value: str) -> str:
    value = decrypt_destination(encrypted_value)
    return f"{'*' * max(4, len(value) - 4)}{value[-4:]}"
