"""Task Routes — CRUD + filtering, reorder, duplicate, bulk ops."""

import json
from datetime import datetime
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id

router = APIRouter()


# ── Pydantic models ──

class TaskCreate(BaseModel):
    title: str = ""
    description: str = ""
    status: str = "todo"
    priority: str = "medium"
    type: str = "internal"
    tags: list = []
    checklist: list = []
    assignee_id: Optional[str] = None
    created_by: Optional[str] = None
    deadline: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: str = ""
    tab: str = "csm"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    type: Optional[str] = None
    tags: Optional[list] = None
    checklist: Optional[list] = None
    assignee_id: Optional[str] = None
    created_by: Optional[str] = None
    deadline: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    sort_order: Optional[int] = None
    is_archived: Optional[bool] = None
    ticket_ref: Optional[str] = None
    calendar_event_id: Optional[str] = None
    parent_task_id: Optional[str] = None
    tab: Optional[str] = None


class ReorderRequest(BaseModel):
    ids: list[str] = []


class BulkUpdateRequest(BaseModel):
    ids: list[str] = []
    data: dict = {}


class BulkDeleteRequest(BaseModel):
    ids: list[str] = []


# ── Endpoints ──

@router.get("")
def list_tasks(
    tab: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    type: Optional[str] = None,
    assignee_id: Optional[str] = None,
    search: Optional[str] = None,
):
    conditions = ["is_archived = false"]
    params: list = []

    if tab:
        conditions.append("tab = %s")
        params.append(tab)
    if status:
        conditions.append("status = %s")
        params.append(status)
    if priority:
        conditions.append("priority = %s")
        params.append(priority)
    if type:
        conditions.append("type = %s")
        params.append(type)
    if assignee_id:
        conditions.append("assignee_id = %s")
        params.append(assignee_id)
    if search:
        like = f"%{search}%"
        conditions.append("(title ILIKE %s OR description ILIKE %s OR customer_name ILIKE %s OR tags::text ILIKE %s)")
        params.extend([like, like, like, like])

    sql_where = " AND ".join(conditions)
    sql = f"SELECT * FROM tasks WHERE {sql_where} ORDER BY sort_order ASC, created_at DESC"

    return query(sql, tuple(params))


@router.get("/{task_id}")
def get_task(task_id: str):
    rows = query("SELECT * FROM tasks WHERE id = %s", (task_id,))
    if not rows:
        return {"error": "Not found"}
    return rows[0]


@router.post("", status_code=201)
def create_task(data: TaskCreate):
    task_id = gen_id("t_")
    now = datetime.utcnow().isoformat()

    max_rows = query("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM tasks")
    sort_order = max_rows[0]["next"] if max_rows else 0

    rows = query(
        """INSERT INTO tasks (id, title, description, status, priority, type, tags,
           assignee_id, created_by, deadline, created_at, updated_at,
           customer_id, customer_name, sort_order, is_archived, tab)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, false, %s)
           RETURNING *""",
        (
            task_id, data.title, data.description, data.status, data.priority,
            data.type, json.dumps(data.tags), data.assignee_id, data.created_by,
            data.deadline, now, now, data.customer_id, data.customer_name,
            sort_order, data.tab,
        ),
    )

    # Activity log
    execute(
        "INSERT INTO activity_log (id, task_id, action, actor_id, created_at) VALUES (%s, %s, %s, %s, %s)",
        (gen_id("a_"), task_id, "created", data.created_by, now),
    )

    return rows[0]


@router.patch("/{task_id}")
def update_task(task_id: str, data: TaskUpdate):
    current_rows = query("SELECT * FROM tasks WHERE id = %s", (task_id,))
    if not current_rows:
        return {"error": "Not found"}
    current = current_rows[0]

    fields = []
    params = []

    allowed = [
        "title", "description", "status", "priority", "type", "assignee_id",
        "deadline", "customer_id", "customer_name", "sort_order", "is_archived",
        "created_by", "ticket_ref", "calendar_event_id", "parent_task_id", "tab",
    ]

    data_dict = data.model_dump(exclude_unset=True)

    for key in allowed:
        if key in data_dict:
            fields.append(f"{key} = %s")
            params.append(data_dict[key])

    # Handle JSONB fields
    if "tags" in data_dict:
        fields.append("tags = %s")
        params.append(json.dumps(data_dict["tags"]))
    if "checklist" in data_dict:
        fields.append("checklist = %s")
        params.append(json.dumps(data_dict["checklist"]))

    # Always update updated_at
    now = datetime.utcnow().isoformat()
    fields.append("updated_at = %s")
    params.append(now)

    # Track completion
    if data_dict.get("status") == "done" and current["status"] != "done":
        fields.append("completed_at = %s")
        params.append(now)
    elif data_dict.get("status") and data_dict["status"] != "done":
        fields.append("completed_at = NULL")

    if not fields:
        return current

    params.append(task_id)
    sql = f"UPDATE tasks SET {', '.join(fields)} WHERE id = %s RETURNING *"
    rows = query(sql, tuple(params))

    # Activity logging
    if data_dict.get("status") and data_dict["status"] != current["status"]:
        execute(
            "INSERT INTO activity_log (id, task_id, action, actor_id, old_value, new_value, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (gen_id("a_"), task_id, "status_changed", None, current["status"], data_dict["status"], now),
        )
    if "assignee_id" in data_dict and data_dict["assignee_id"] != current.get("assignee_id"):
        execute(
            "INSERT INTO activity_log (id, task_id, action, actor_id, old_value, new_value, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (gen_id("a_"), task_id, "assigned", None, current.get("assignee_id"), data_dict["assignee_id"], now),
        )

    return rows[0]


@router.delete("/{task_id}")
def delete_task(task_id: str):
    # Guard: onboarding tasks cannot be deleted — they must be cancelled
    rows = query("SELECT type FROM tasks WHERE id = %s", (task_id,))
    if rows and rows[0].get("type") == "onboarding":
        return {"error": "Onboarding-opgaver kan ikke slettes. Brug 'Aflys' i stedet.", "protected": True}
    execute("DELETE FROM tasks WHERE id = %s", (task_id,))
    return {"ok": True}


class CancelRequest(BaseModel):
    reason: str = ""


@router.post("/{task_id}/cancel")
def cancel_task(task_id: str, data: CancelRequest):
    """Cancel a task (primarily for onboarding tasks that cannot be deleted)."""
    rows = query("SELECT * FROM tasks WHERE id = %s", (task_id,))
    if not rows:
        return {"error": "Not found"}

    now = datetime.utcnow().isoformat()
    result = query(
        """UPDATE tasks SET status = 'cancelled', cancel_reason = %s, updated_at = %s
           WHERE id = %s RETURNING *""",
        (data.reason or None, now, task_id),
    )

    # Activity log
    execute(
        "INSERT INTO activity_log (id, task_id, action, actor_id, old_value, new_value, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (gen_id("a_"), task_id, "cancelled", None, rows[0]["status"], "cancelled", now),
    )

    return result[0] if result else {"ok": True}


@router.post("/reorder")
def reorder_tasks(data: ReorderRequest):
    for i, task_id in enumerate(data.ids):
        execute("UPDATE tasks SET sort_order = %s WHERE id = %s", (i, task_id))
    return {"ok": True}


@router.post("/{task_id}/duplicate", status_code=201)
def duplicate_task(task_id: str):
    rows = query("SELECT * FROM tasks WHERE id = %s", (task_id,))
    if not rows:
        return {"error": "Not found"}
    task = rows[0]

    new_data = TaskCreate(
        title=task["title"] + " (kopi)",
        description=task.get("description", ""),
        status="todo",
        priority=task.get("priority", "medium"),
        type=task.get("type", "internal"),
        tags=task.get("tags", []),
        checklist=task.get("checklist", []),
        assignee_id=task.get("assignee_id"),
        deadline=task.get("deadline"),
        customer_id=task.get("customer_id"),
        customer_name=task.get("customer_name", ""),
        tab=task.get("tab", "csm"),
    )
    return create_task(new_data)


@router.post("/bulk-update")
def bulk_update_tasks(data: BulkUpdateRequest):
    results = []
    update_data = TaskUpdate(**data.data)
    for task_id in data.ids:
        result = update_task(task_id, update_data)
        if result and "error" not in result:
            results.append(result)
    return results


@router.post("/bulk-delete")
def bulk_delete_tasks(data: BulkDeleteRequest):
    if not data.ids:
        return {"ok": True, "count": 0}
    # Filter out onboarding tasks — they cannot be deleted
    placeholders = ", ".join(["%s"] * len(data.ids))
    protected = query(
        f"SELECT id FROM tasks WHERE id IN ({placeholders}) AND type = 'onboarding'",
        tuple(data.ids),
    )
    protected_ids = {r["id"] for r in protected}
    deletable_ids = [id for id in data.ids if id not in protected_ids]

    if deletable_ids:
        placeholders2 = ", ".join(["%s"] * len(deletable_ids))
        execute(f"DELETE FROM tasks WHERE id IN ({placeholders2})", tuple(deletable_ids))

    return {
        "ok": True,
        "count": len(deletable_ids),
        "skipped": len(protected_ids),
        "message": f"{len(protected_ids)} onboarding-opgave(r) blev sprunget over (kan ikke slettes)" if protected_ids else None,
    }
