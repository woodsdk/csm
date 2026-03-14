"""Shift Routes — Vagtplan for med-studerende. 2-hour shifts."""

from datetime import datetime, timedelta
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id

router = APIRouter()

SHIFT_SLOTS = [
    {"start_time": "08:00", "end_time": "10:00"},
    {"start_time": "10:00", "end_time": "12:00"},
    {"start_time": "12:00", "end_time": "14:00"},
    {"start_time": "14:00", "end_time": "16:00"},
]


class ShiftCreate(BaseModel):
    date: str
    start_time: str
    staff_name: str
    staff_email: str
    staff_phone: str = ""


class ListenerCreate(BaseModel):
    listener_name: str
    listener_email: str
    listener_phone: str = ""


@router.get("")
def list_shifts(date: Optional[str] = None, from_date: Optional[str] = None, to_date: Optional[str] = None):
    sql = "SELECT * FROM shifts WHERE status != 'cancelled'"
    params = []

    if date:
        sql += " AND date = %s"
        params.append(date)
    if from_date and to_date:
        sql += " AND date >= %s AND date <= %s"
        params.extend([from_date, to_date])

    sql += " ORDER BY date ASC, start_time ASC"
    shifts = query(sql, tuple(params))

    # Attach listeners to each shift
    if shifts:
        shift_ids = [s["id"] for s in shifts]
        placeholders = ", ".join(["%s"] * len(shift_ids))
        listeners = query(
            f"SELECT * FROM shift_listeners WHERE shift_id IN ({placeholders}) ORDER BY created_at ASC",
            tuple(shift_ids),
        )

        listener_map: dict[str, list] = {}
        for lis in listeners:
            sid = lis["shift_id"]
            if sid not in listener_map:
                listener_map[sid] = []
            listener_map[sid].append(lis)

        for shift in shifts:
            shift["listeners"] = listener_map.get(shift["id"], [])

    return shifts


@router.get("/available")
def get_available(date: str):
    existing = query(
        "SELECT start_time FROM shifts WHERE date = %s AND status != 'cancelled'",
        (date,),
    )
    taken = [s["start_time"] for s in existing]
    return [slot for slot in SHIFT_SLOTS if slot["start_time"] not in taken]


@router.get("/calendar")
def get_calendar():
    today = datetime.now()
    dates = []

    for i in range(31):
        d = today + timedelta(days=i)
        if d.weekday() < 5:  # Mon-Fri
            dates.append(d.strftime("%Y-%m-%d"))

    if not dates:
        return []

    shifts = query(
        "SELECT date, start_time, end_time, staff_name FROM shifts "
        "WHERE date >= %s AND date <= %s AND status != 'cancelled' ORDER BY start_time",
        (dates[0], dates[-1]),
    )

    # Convert date objects to strings for comparison
    return [
        {
            "date": date,
            "shifts": [s for s in shifts if s["date"] == date],
            "total_slots": len(SHIFT_SLOTS),
            "filled_slots": len([s for s in shifts if s["date"] == date]),
        }
        for date in dates
    ]


@router.post("", status_code=201)
def create_shift(data: ShiftCreate):
    shift_id = gen_id("sh_")

    # Validate slot
    valid_slot = next((s for s in SHIFT_SLOTS if s["start_time"] == data.start_time), None)
    if not valid_slot:
        return {"error": "Ugyldigt vagtinterval"}

    # Check not already taken
    existing = query(
        "SELECT id FROM shifts WHERE date = %s AND start_time = %s AND status != 'cancelled'",
        (data.date, data.start_time),
    )
    if existing:
        return {"error": "Denne vagt er allerede taget"}

    # Resolve staff_id from email
    resolved_staff_id = None
    if data.staff_email:
        match = query(
            "SELECT id FROM team_members WHERE LOWER(email) = LOWER(%s) AND is_active = true",
            (data.staff_email,),
        )
        if match:
            resolved_staff_id = match[0]["id"]

    rows = query(
        """INSERT INTO shifts (id, date, start_time, end_time, staff_name, staff_email, staff_phone, staff_id, status)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'confirmed')
           RETURNING *""",
        (shift_id, data.date, data.start_time, valid_slot["end_time"],
         data.staff_name, data.staff_email, data.staff_phone, resolved_staff_id),
    )
    shift = rows[0]
    shift["listeners"] = []
    return shift


@router.post("/{shift_id}/cancel")
def cancel_shift(shift_id: str):
    rows = query(
        "UPDATE shifts SET status = 'cancelled' WHERE id = %s RETURNING *",
        (shift_id,),
    )
    return rows[0] if rows else None


@router.post("/{shift_id}/listeners", status_code=201)
def add_listener(shift_id: str, data: ListenerCreate):
    # Verify shift exists
    shift_rows = query("SELECT id FROM shifts WHERE id = %s AND status != 'cancelled'", (shift_id,))
    if not shift_rows:
        return {"error": "Vagt ikke fundet"}

    listener_id = gen_id("sl_")
    rows = query(
        """INSERT INTO shift_listeners (id, shift_id, listener_name, listener_email, listener_phone)
           VALUES (%s, %s, %s, %s, %s)
           RETURNING *""",
        (listener_id, shift_id, data.listener_name, data.listener_email, data.listener_phone),
    )
    return rows[0]


@router.delete("/{shift_id}/listeners/{listener_id}")
def remove_listener(shift_id: str, listener_id: str):
    execute(
        "DELETE FROM shift_listeners WHERE id = %s AND shift_id = %s",
        (listener_id, shift_id),
    )
    return {"ok": True}
