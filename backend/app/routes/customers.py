"""Customer Routes — CRUD."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, gen_id

router = APIRouter()


class CustomerCreate(BaseModel):
    name: str = ""
    segment: str = "direct"
    lifecycle: str = "lead"
    contact_name: str = ""
    contact_email: str = ""
    plan: str = "freemium"
    licenses_total: int = 0
    licenses_used: int = 0
    mrr: float = 0
    dpa_signed: bool = False
    notes: str = ""


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    segment: Optional[str] = None
    lifecycle: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    plan: Optional[str] = None
    licenses_total: Optional[int] = None
    licenses_used: Optional[int] = None
    mrr: Optional[float] = None
    dpa_signed: Optional[bool] = None
    dpa_signed_at: Optional[str] = None
    onboarding_started_at: Optional[str] = None
    go_live_at: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
def list_customers():
    return query("SELECT * FROM customers ORDER BY created_at DESC")


@router.get("/{customer_id}")
def get_customer(customer_id: str):
    rows = query("SELECT * FROM customers WHERE id = %s", (customer_id,))
    if not rows:
        return {"error": "Not found"}
    return rows[0]


@router.post("", status_code=201)
def create_customer(data: CustomerCreate):
    cust_id = gen_id("cust_")
    rows = query(
        """INSERT INTO customers (id, name, segment, lifecycle, contact_name, contact_email,
           plan, licenses_total, licenses_used, mrr, dpa_signed, notes)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
           RETURNING *""",
        (
            cust_id, data.name, data.segment, data.lifecycle,
            data.contact_name, data.contact_email, data.plan,
            data.licenses_total, data.licenses_used, data.mrr,
            data.dpa_signed, data.notes,
        ),
    )
    return rows[0]


@router.patch("/{customer_id}")
def update_customer(customer_id: str, data: CustomerUpdate):
    current_rows = query("SELECT * FROM customers WHERE id = %s", (customer_id,))
    if not current_rows:
        return {"error": "Not found"}

    fields = []
    params = []
    data_dict = data.model_dump(exclude_unset=True)

    allowed = [
        "name", "segment", "lifecycle", "contact_name", "contact_email",
        "plan", "licenses_total", "licenses_used", "mrr", "dpa_signed",
        "dpa_signed_at", "onboarding_started_at", "go_live_at", "notes",
    ]

    for key in allowed:
        if key in data_dict:
            fields.append(f"{key} = %s")
            params.append(data_dict[key])

    if not fields:
        return current_rows[0]

    params.append(customer_id)
    sql = f"UPDATE customers SET {', '.join(fields)} WHERE id = %s RETURNING *"
    rows = query(sql, tuple(params))
    return rows[0]
