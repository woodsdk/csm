"""Booking Routes — 30-min onboarding sessions driven by shifts."""

import json
from datetime import datetime, timedelta
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id
from ..utils import time_to_min, min_to_time

router = APIRouter()

BOOKING_DURATION = 30  # minutes


class BookingCreate(BaseModel):
    date: str
    start_time: str
    guest_name: str
    guest_email: str
    guest_phone: str = ""
    guest_company: str = ""
    notes: str = ""


class BookingUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


def _get_available_slots(date: str) -> list[dict]:
    """Calculate free 30-min slots based on confirmed shifts minus existing bookings."""
    shifts = query(
        "SELECT start_time, end_time FROM shifts WHERE date = %s AND status = 'confirmed'",
        (date,),
    )
    if not shifts:
        return []

    existing_bookings = query(
        "SELECT start_time, end_time FROM bookings WHERE date = %s AND status != 'cancelled'",
        (date,),
    )

    slots = []
    for shift in shifts:
        shift_start = time_to_min(shift["start_time"])
        shift_end = time_to_min(shift["end_time"])

        start_min = shift_start
        while start_min + BOOKING_DURATION <= shift_end:
            end_min = start_min + BOOKING_DURATION
            start_time = min_to_time(start_min)
            end_time = min_to_time(end_min)

            # Check if slot is already booked
            is_booked = any(
                start_min < time_to_min(b["end_time"]) and end_min > time_to_min(b["start_time"])
                for b in existing_bookings
            )

            if not is_booked:
                slots.append({"start_time": start_time, "end_time": end_time})

            start_min += 30

    return slots


@router.get("/available")
def get_available(date: str):
    return _get_available_slots(date)


@router.get("/dates")
def get_available_dates():
    today = datetime.now()
    from_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
    to_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")

    rows = query(
        "SELECT DISTINCT date FROM shifts WHERE date >= %s AND date <= %s AND status = 'confirmed' ORDER BY date",
        (from_date, to_date),
    )

    dates = []
    for row in rows:
        slots = _get_available_slots(row["date"])
        if slots:
            dates.append(row["date"])

    return dates


@router.post("", status_code=201)
def create_booking(data: BookingCreate):
    booking_id = gen_id("bk_")

    # Validate slot is available
    slots = _get_available_slots(data.date)
    slot = next((s for s in slots if s["start_time"] == data.start_time), None)
    if not slot:
        return {"error": "Tidspunktet er ikke længere ledigt"}

    # Find which shift covers this slot
    shift_rows = query(
        "SELECT id, staff_name FROM shifts WHERE date = %s AND status = 'confirmed' "
        "AND start_time <= %s AND end_time >= %s",
        (data.date, data.start_time, slot["end_time"]),
    )
    shift = shift_rows[0] if shift_rows else None

    # Auto-create task
    task_id = gen_id("t_")
    company_suffix = f" ({data.guest_company})" if data.guest_company else ""
    task_title = f"Onboarding: {data.guest_name}{company_suffix}"

    desc_parts = [
        f"Booking: {data.date} kl. {data.start_time}-{slot['end_time']}",
        f"Navn: {data.guest_name}",
        f"Email: {data.guest_email}",
    ]
    if data.guest_phone:
        desc_parts.append(f"Tlf: {data.guest_phone}")
    if data.guest_company:
        desc_parts.append(f"Klinik: {data.guest_company}")
    if shift:
        desc_parts.append(f"Vagt: {shift['staff_name']}")
    if data.notes:
        desc_parts.append(f"Note: {data.notes}")
    task_desc = "\n".join(desc_parts)

    execute(
        """INSERT INTO tasks (id, title, description, status, priority, type, tags, deadline,
           created_at, updated_at, sort_order, is_archived)
           VALUES (%s, %s, %s, 'todo', 'high', 'onboarding', '["booking"]', %s, NOW(), NOW(),
           (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks), false)""",
        (task_id, task_title, task_desc, data.date),
    )

    # Create booking
    rows = query(
        """INSERT INTO bookings (id, date, start_time, end_time, shift_id,
           guest_name, guest_email, guest_phone, guest_company, notes, status, task_id)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'confirmed', %s)
           RETURNING *""",
        (
            booking_id, data.date, data.start_time, slot["end_time"],
            shift["id"] if shift else None,
            data.guest_name, data.guest_email, data.guest_phone,
            data.guest_company, data.notes, task_id,
        ),
    )
    return rows[0]


@router.get("")
def list_bookings(status: Optional[str] = None, date: Optional[str] = None):
    sql = "SELECT * FROM bookings WHERE 1=1"
    params = []

    if status:
        sql += " AND status = %s"
        params.append(status)
    if date:
        sql += " AND date = %s"
        params.append(date)

    sql += " ORDER BY date ASC, start_time ASC"
    return query(sql, tuple(params))


@router.patch("/{booking_id}")
def update_booking(booking_id: str, data: BookingUpdate):
    fields = []
    params = []
    data_dict = data.model_dump(exclude_unset=True)

    for key in ["status", "notes"]:
        if key in data_dict:
            fields.append(f"{key} = %s")
            params.append(data_dict[key])

    if not fields:
        return None

    params.append(booking_id)
    sql = f"UPDATE bookings SET {', '.join(fields)} WHERE id = %s RETURNING *"
    rows = query(sql, tuple(params))
    return rows[0] if rows else None
