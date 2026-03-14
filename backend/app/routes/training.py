"""Training Checklist Routes — Onboarding items for new support staff."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id

router = APIRouter()


class TrainingItemCreate(BaseModel):
    title: str
    description: str = ""


class TrainingItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class ReorderRequest(BaseModel):
    ids: list[str]


@router.get("")
def list_training_items():
    """List all training items sorted by sort_order."""
    return query("SELECT * FROM training_items ORDER BY sort_order ASC, created_at ASC")


@router.post("", status_code=201)
def create_training_item(data: TrainingItemCreate):
    """Create a new training item (appended at end)."""
    item_id = gen_id("tr_")
    rows = query(
        """INSERT INTO training_items (id, title, description, sort_order)
           VALUES (%s, %s, %s, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM training_items))
           RETURNING *""",
        (item_id, data.title, data.description),
    )
    return rows[0]


@router.patch("/{item_id}")
def update_training_item(item_id: str, data: TrainingItemUpdate):
    """Update a training item's title or description."""
    current = query("SELECT * FROM training_items WHERE id = %s", (item_id,))
    if not current:
        return {"error": "Item ikke fundet"}

    fields = []
    params = []
    data_dict = data.model_dump(exclude_unset=True)

    for key in ["title", "description"]:
        if key in data_dict:
            fields.append(f"{key} = %s")
            params.append(data_dict[key])

    if not fields:
        return current[0]

    params.append(item_id)
    sql = f"UPDATE training_items SET {', '.join(fields)} WHERE id = %s RETURNING *"
    rows = query(sql, tuple(params))
    return rows[0]


@router.delete("/{item_id}")
def delete_training_item(item_id: str):
    """Delete a training item."""
    execute("DELETE FROM training_items WHERE id = %s", (item_id,))
    return {"ok": True}


@router.post("/reorder")
def reorder_training_items(data: ReorderRequest):
    """Reorder training items by setting sort_order from the array position."""
    for i, item_id in enumerate(data.ids):
        execute(
            "UPDATE training_items SET sort_order = %s WHERE id = %s",
            (i + 1, item_id),
        )
    return {"ok": True}
