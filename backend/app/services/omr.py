import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageOps
from pytesseract import Output

PROCESSING_VERSION = "omr-fixed-layout-1"


def _crop(gray: np.ndarray, rect: list[float]) -> np.ndarray:
    height, width = gray.shape[:2]
    if (
        len(rect) != 4
        or any(not 0 <= float(value) <= 1 for value in rect)
        or float(rect[0]) + float(rect[2]) > 1
        or float(rect[1]) + float(rect[3]) > 1
    ):
        raise ValueError("Template regions must contain four normalized coordinates")
    x, y, w, h = (float(value) for value in rect)
    left = max(0, int(x * width))
    top = max(0, int(y * height))
    right = min(width, int((x + w) * width))
    bottom = min(height, int((y + h) * height))
    if right <= left or bottom <= top:
        raise ValueError("Template region is outside the image")
    return gray[top:bottom, left:right]


def _read_template(path: Path, form_version: str) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError("form_template_unconfigured")
    templates = json.loads(path.read_text(encoding="utf-8"))
    template = templates.get(form_version)
    if not template:
        raise FileNotFoundError("form_version_unconfigured")
    return template


def _checkbox_ratio(gray: np.ndarray, rect: list[float]) -> float:
    crop = _crop(gray, rect)
    margin_x = max(1, int(crop.shape[1] * 0.12))
    margin_y = max(1, int(crop.shape[0] * 0.12))
    inner = crop[margin_y:-margin_y or None, margin_x:-margin_x or None]
    if inner.size == 0:
        inner = crop
    binary = cv2.threshold(inner, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    return float(np.count_nonzero(binary) / binary.size)


def _classify_group(
    gray: np.ndarray,
    options: dict[str, list[float]],
    config: dict[str, Any],
) -> tuple[str | None, dict[str, Any]]:
    threshold = float(config.get("marked_ratio_threshold", 0.18))
    if not 0.02 <= threshold <= 0.8:
        raise ValueError("Invalid OMR marked-ratio threshold")
    ratios = {
        name: _checkbox_ratio(gray, rect) for name, rect in options.items()
    }
    marked = [name for name, ratio in ratios.items() if ratio >= threshold]
    if len(marked) == 1:
        value, state = marked[0], "single_mark"
    elif len(marked) == 0:
        value, state = None, "blank"
    else:
        value, state = None, "multiple_marks"
    confidence = max(
        (min(abs(ratio - threshold) / max(threshold, 1 - threshold), 1.0) for ratio in ratios.values()),
        default=0.0,
    )
    return value, {"state": state, "ratios": ratios, "confidence": confidence}


def _extract_text(
    gray: np.ndarray, rect: list[float], kind: str, appointment_time: str | None
) -> tuple[str | None, float]:
    crop = _crop(gray, rect)
    enlarged = cv2.resize(crop, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    thresholded = cv2.threshold(enlarged, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    whitelist = "0123456789/-" if kind == "appointment_date" else "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/"
    data = pytesseract.image_to_data(
        thresholded,
        config=f"--psm 7 -c tessedit_char_whitelist={whitelist}",
        output_type=Output.DICT,
    )
    tokens: list[str] = []
    confidences: list[float] = []
    for token, confidence in zip(data["text"], data["conf"], strict=False):
        cleaned = re.sub(r"[^A-Za-z0-9/-]", "", token)
        try:
            score = float(confidence)
        except (TypeError, ValueError):
            score = -1
        if cleaned:
            tokens.append(cleaned)
            if score >= 0:
                confidences.append(score / 100)
    raw_value = "".join(tokens).strip()
    confidence = sum(confidences) / len(confidences) if confidences else 0.0
    if not raw_value:
        return None, confidence
    if kind == "appointment_date":
        for pattern in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
            try:
                parsed = datetime.strptime(raw_value, pattern).date()
                if appointment_time:
                    return f"{parsed.isoformat()}T{appointment_time}", confidence
                return parsed.isoformat(), confidence
            except ValueError:
                continue
        return None, 0.0
    return raw_value[:120], confidence


def extract_scan(image_path: Path, templates_path: Path, form_version: str) -> dict[str, Any]:
    try:
        template = _read_template(templates_path, form_version)
        with Image.open(image_path) as source_image:
            normalized_image = ImageOps.exif_transpose(source_image).convert("RGB")
            image = cv2.cvtColor(np.asarray(normalized_image), cv2.COLOR_RGB2BGR)
        target_width, target_height = (int(value) for value in template["image_size"])
        if (
            target_width < 100
            or target_height < 100
            or target_width > 8000
            or target_height > 8000
            or target_width * target_height > 40_000_000
        ):
            raise ValueError("invalid_template_dimensions")
        source_ratio = image.shape[1] / image.shape[0]
        target_ratio = target_width / target_height
        if abs(source_ratio - target_ratio) > target_ratio * 0.06:
            if abs((1 / source_ratio) - target_ratio) <= target_ratio * 0.06:
                image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
            else:
                raise ValueError("form_layout_mismatch")
        normalized = cv2.resize(image, (target_width, target_height), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(normalized, cv2.COLOR_BGR2GRAY)

        fields: dict[str, Any] = {}
        confidence: dict[str, Any] = {}
        for group, options in template.get("checkbox_groups", {}).items():
            selected, result = _classify_group(gray, options, template)
            fields[group] = selected
            confidence[group] = result
        for field_name, definition in template.get("text_regions", {}).items():
            value, score = _extract_text(
                gray,
                definition["rect"],
                definition["type"],
                template.get("default_appointment_time"),
            )
            fields[field_name] = value
            confidence[field_name] = {"confidence": score, "state": "extracted" if value else "ambiguous"}
        fields["form_version"] = form_version
        return {
            "fields": fields,
            "confidence": confidence,
            "processing_version": PROCESSING_VERSION,
            "status": "needs_review",
            "failure_code": None,
        }
    except FileNotFoundError as exc:
        return {
            "fields": {},
            "confidence": {},
            "processing_version": PROCESSING_VERSION,
            "status": "processing_failed",
            "failure_code": str(exc) or "form_template_unconfigured",
        }
    except (KeyError, ValueError, cv2.error, pytesseract.TesseractNotFoundError) as exc:
        code = str(exc) if str(exc) in {"form_layout_mismatch", "invalid_image"} else "omr_processing_failed"
        return {
            "fields": {},
            "confidence": {},
            "processing_version": PROCESSING_VERSION,
            "status": "processing_failed",
            "failure_code": code,
        }
