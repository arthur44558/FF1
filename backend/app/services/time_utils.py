from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException


def local_to_utc(value: datetime, timezone_name: str) -> datetime:
    try:
        zone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "invalid_timezone", "message": "Timezone is not a valid IANA timezone"},
        ) from exc
    if value.tzinfo is None:
        return value.replace(tzinfo=zone).astimezone(timezone.utc)
    return value.astimezone(zone).astimezone(timezone.utc)


def require_timezone(value: datetime, timezone_name: str) -> datetime:
    if value.tzinfo is None and not timezone_name:
        raise HTTPException(
            status_code=422,
            detail={"code": "timezone_required", "message": "A timezone is required for local date/time"},
        )
    return local_to_utc(value, timezone_name)


def to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
