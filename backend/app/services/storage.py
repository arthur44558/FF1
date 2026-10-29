import hashlib
import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

ALLOWED_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MAX_SCAN_PIXELS = 40_000_000
EXTENSIONS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}


async def validate_and_store(upload: UploadFile) -> tuple[str, str, str, int, str]:
    contents = await upload.read(settings.max_scan_bytes + 1)
    if not contents or len(contents) > settings.max_scan_bytes:
        raise HTTPException(
            status_code=413,
            detail={"code": "scan_size_invalid", "message": "Scan is empty or exceeds the configured size limit"},
        )
    try:
        with Image.open(io.BytesIO(contents)) as image:
            width, height = image.size
            if width <= 0 or height <= 0 or width * height > MAX_SCAN_PIXELS:
                raise HTTPException(
                    status_code=413,
                    detail={"code": "scan_pixel_limit", "message": "Scan dimensions exceed the configured safety limit"},
                )
            if getattr(image, "is_animated", False):
                raise HTTPException(
                    status_code=415,
                    detail={"code": "animated_scan_rejected", "message": "Animated images are not supported"},
                )
            image.verify()
            image_format = image.format
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(
            status_code=415,
            detail={"code": "invalid_scan_image", "message": "Upload must be a valid JPEG, PNG or WebP image"},
        ) from exc
    if image_format not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=415,
            detail={"code": "unsupported_scan_image", "message": "Upload must be JPEG, PNG or WebP"},
        )

    digest = hashlib.sha256(contents).hexdigest()
    key = f"{uuid.uuid4().hex}{EXTENSIONS[image_format]}"
    root = settings.private_storage_dir.resolve()
    root.mkdir(parents=True, exist_ok=True)
    destination = (root / key).resolve()
    if destination.parent != root:
        raise HTTPException(status_code=500, detail={"code": "storage_path_invalid"})
    destination.write_bytes(contents)
    return key, digest, ALLOWED_FORMATS[image_format], len(contents), image_format


def resolve_storage_key(storage_key: str) -> Path:
    if Path(storage_key).name != storage_key:
        raise HTTPException(status_code=404, detail={"code": "scan_file_not_found"})
    root = settings.private_storage_dir.resolve()
    path = (root / storage_key).resolve()
    if path.parent != root or not path.is_file():
        raise HTTPException(status_code=404, detail={"code": "scan_file_not_found"})
    return path


def remove_storage_key(storage_key: str) -> None:
    try:
        resolve_storage_key(storage_key).unlink(missing_ok=True)
    except HTTPException:
        return
