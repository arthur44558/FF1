from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import require_permission
from app.db import get_db
from app.models import FollowupOrder, ReminderJob, ScanDocument, User

router = APIRouter(prefix="/api/v1/operations", tags=["operations"])


@router.get("/summary")
def operations_summary(
    user: Annotated[User, Depends(require_permission("operations:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    followups_by_status = dict(
        db.execute(
            select(FollowupOrder.status, func.count(FollowupOrder.id))
            .where(FollowupOrder.facility_id == user.facility_id)
            .group_by(FollowupOrder.status)
        ).all()
    )
    followups_by_severity = dict(
        db.execute(
            select(FollowupOrder.severity, func.count(FollowupOrder.id))
            .where(
                FollowupOrder.facility_id == user.facility_id,
                FollowupOrder.followup_required.is_(True),
            )
            .group_by(FollowupOrder.severity)
        ).all()
    )
    jobs_by_status = dict(
        db.execute(
            select(ReminderJob.status, func.count(ReminderJob.id))
            .where(ReminderJob.facility_id == user.facility_id)
            .group_by(ReminderJob.status)
        ).all()
    )
    scan_counts = dict(
        db.execute(
            select(ScanDocument.processing_status, func.count(ScanDocument.id))
            .where(ScanDocument.facility_id == user.facility_id)
            .group_by(ScanDocument.processing_status)
        ).all()
    )
    overdue_count = db.scalar(
        select(func.count(FollowupOrder.id)).where(
            FollowupOrder.facility_id == user.facility_id,
            FollowupOrder.status.in_(["active", "contact_resolution_required"]),
            FollowupOrder.scheduled_at < now,
        )
    ) or 0
    return {
        "generated_at": now.isoformat(),
        "followups_by_status": followups_by_status,
        "followups_by_severity": followups_by_severity,
        "overdue_followups": overdue_count,
        "reminder_jobs_by_status": jobs_by_status,
        "scans_by_processing_status": scan_counts,
    }
