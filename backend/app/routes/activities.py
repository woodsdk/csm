"""Activity Routes — Task activity log."""

from fastapi import APIRouter
from ..database import query

router = APIRouter()


@router.get("/{task_id}")
def list_for_task(task_id: str):
    return query(
        "SELECT * FROM activity_log WHERE task_id = %s ORDER BY created_at DESC LIMIT 50",
        (task_id,),
    )
