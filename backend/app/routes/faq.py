"""FAQ Routes — Editable Q&A for training / onboarding."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id

router = APIRouter()


class FaqItemCreate(BaseModel):
    question: str
    answer: str
    category: str = ""
    sort_order: int = 0


class FaqItemUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None


@router.get("")
def list_faq_items(category: Optional[str] = None):
    """List all FAQ items, optionally filtered by category."""
    if category:
        return query(
            "SELECT * FROM faq_items ORDER BY sort_order ASC, created_at ASC"
        )
    return query("SELECT * FROM faq_items ORDER BY sort_order ASC, created_at ASC")


@router.post("", status_code=201)
def create_faq_item(data: FaqItemCreate):
    """Create a new FAQ item."""
    item_id = gen_id("faq_")
    rows = query(
        """INSERT INTO faq_items (id, question, answer, category, sort_order)
           VALUES (%s, %s, %s, %s, %s)
           RETURNING *""",
        (item_id, data.question, data.answer, data.category, data.sort_order),
    )
    return rows[0]


@router.patch("/{item_id}")
def update_faq_item(item_id: str, data: FaqItemUpdate):
    """Update a FAQ item."""
    current = query("SELECT * FROM faq_items WHERE id = %s", (item_id,))
    if not current:
        return {"error": "FAQ item ikke fundet"}

    fields = []
    params = []
    data_dict = data.model_dump(exclude_unset=True)

    for key in ["question", "answer", "category", "sort_order"]:
        if key in data_dict:
            fields.append(f"{key} = %s")
            params.append(data_dict[key])

    if not fields:
        return current[0]

    params.append(item_id)
    sql = f"UPDATE faq_items SET {', '.join(fields)} WHERE id = %s RETURNING *"
    rows = query(sql, tuple(params))
    return rows[0]


@router.delete("/{item_id}")
def delete_faq_item(item_id: str):
    """Delete a FAQ item."""
    execute("DELETE FROM faq_items WHERE id = %s", (item_id,))
    return {"ok": True}
