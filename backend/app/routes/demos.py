"""Demo Booking Routes — Public booking system for video demos."""

from datetime import datetime, timedelta
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id
from ..google_calendar import create_event as gcal_create_event, add_attendee as gcal_add_attendee, delete_event as gcal_delete_event

router = APIRouter()

DEMO_SLOTS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30",
]
DEMO_DURATION = 30  # minutes


class DemoBookingCreate(BaseModel):
    date: str
    start_time: str
    client_name: str
    client_email: str
    client_phone: str = ""
    client_clinic: str = ""
    notes: str = ""


class ParticipantJoin(BaseModel):
    name: str
    email: str
    role: str = ""


def _min_to_time(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _time_to_min(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _get_on_shift_demo_staff(date: str) -> list[dict]:
    """Get confirmed shifts for this date where staff can give demos.

    Returns list of {staff_id, staff_email, shift_start, shift_end}.
    Handles both staff_id FK and email-fallback for legacy shifts.
    """
    # Shifts with staff_id linked to demo-capable team members
    linked = query(
        """SELECT s.start_time as shift_start, s.end_time as shift_end,
                  tm.id as staff_id, tm.name, tm.email
           FROM shifts s
           JOIN team_members tm ON s.staff_id = tm.id
           WHERE s.date = %s AND s.status = 'confirmed'
             AND tm.can_give_demos = true AND tm.is_active = true""",
        (date,),
    )

    # Fallback: shifts without staff_id — match by email
    unlinked = query(
        """SELECT s.start_time as shift_start, s.end_time as shift_end, s.staff_email
           FROM shifts s
           WHERE s.date = %s AND s.status = 'confirmed' AND s.staff_id IS NULL""",
        (date,),
    )
    for row in unlinked:
        match = query(
            "SELECT id, name, email FROM team_members WHERE LOWER(email) = LOWER(%s) AND can_give_demos = true AND is_active = true",
            (row["staff_email"],),
        )
        if match:
            linked.append({
                "shift_start": row["shift_start"],
                "shift_end": row["shift_end"],
                "staff_id": match[0]["id"],
                "name": match[0]["name"],
                "email": match[0]["email"],
            })

    return linked


def _get_available_slots(date: str) -> list[dict]:
    """Get available 30-min demo slots for a given date.

    Strict mode: only show slots when demo-capable staff are on shift.
    No shifts = no demo slots. Prevents overbooking.
    """
    on_shift = _get_on_shift_demo_staff(date)

    if not on_shift:
        return []

    # Get existing demo bookings for this date
    existing = query(
        "SELECT start_time, staff_id FROM demo_bookings WHERE date = %s AND status != 'cancelled'",
        (date,),
    )

    # Only show slots where a demo-capable staff member is on shift
    slots = []
    for start in DEMO_SLOTS:
        start_min = _time_to_min(start)
        end_min = start_min + DEMO_DURATION

        # Find demo-capable staff on shift during this 30-min window
        covering_ids = set()
        for s in on_shift:
            if _time_to_min(s["shift_start"]) <= start_min and _time_to_min(s["shift_end"]) >= end_min:
                covering_ids.add(s["staff_id"])

        if not covering_ids:
            continue

        # Subtract staff already booked at this time
        booked_ids = {b["staff_id"] for b in existing if b["start_time"] == start}
        if covering_ids - booked_ids:
            slots.append({"start_time": start, "end_time": _min_to_time(end_min)})

    return slots


def _assign_staff(date: str, start_time: str) -> dict | None:
    """Assign a demo-capable staff member for this time slot.

    Strict: only picks from on-shift demo-capable staff.
    No shifts = no assignment. Load-balances by fewest demos that week.
    """
    start_min = _time_to_min(start_time)
    end_min = start_min + DEMO_DURATION

    # Find on-shift demo-capable staff covering this window
    on_shift = _get_on_shift_demo_staff(date)
    covering = []
    seen_ids = set()
    for s in on_shift:
        if _time_to_min(s["shift_start"]) <= start_min and _time_to_min(s["shift_end"]) >= end_min:
            if s["staff_id"] not in seen_ids:
                covering.append({"id": s["staff_id"], "name": s["name"], "email": s["email"]})
                seen_ids.add(s["staff_id"])

    if not covering:
        return None

    # Exclude staff already booked for a demo at this exact time
    busy = query(
        "SELECT staff_id FROM demo_bookings WHERE date = %s AND start_time = %s AND status != 'cancelled'",
        (date, start_time),
    )
    busy_ids = {b["staff_id"] for b in busy}
    available = [s for s in covering if s["id"] not in busy_ids]

    if not available:
        return None

    # Load-balance: pick the one with fewest demos this week
    d = datetime.strptime(date, "%Y-%m-%d")
    week_start = d - timedelta(days=d.weekday())
    week_end = week_start + timedelta(days=6)

    week_counts = query(
        "SELECT staff_id, COUNT(*) as cnt FROM demo_bookings "
        "WHERE date >= %s AND date <= %s AND status != 'cancelled' "
        "GROUP BY staff_id",
        (week_start.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d")),
    )
    count_map = {r["staff_id"]: r["cnt"] for r in week_counts}

    available.sort(key=lambda s: count_map.get(s["id"], 0))
    return available[0]


# ── Public endpoints ──────────────────────────────────────────────

@router.get("/available-dates")
def get_available_dates():
    """Return weekdays with available demo slots (next 21 weekdays)."""
    today = datetime.now()
    dates = []

    day = today + timedelta(days=1)  # Start from tomorrow
    count = 0
    while count < 21:
        if day.weekday() < 5:  # Mon-Fri
            date_str = day.strftime("%Y-%m-%d")
            slots = _get_available_slots(date_str)
            if slots:
                dates.append(date_str)
            count += 1
        day += timedelta(days=1)

    return dates


@router.get("/available-slots")
def get_available_slots(date: str):
    """Return available 30-min slots for a specific date."""
    return _get_available_slots(date)


@router.post("/book", status_code=201)
def create_demo_booking(data: DemoBookingCreate):
    """Book a demo — assigns staff, creates calendar event with Meet link, creates internal task."""
    booking_id = gen_id("dm_")

    # Validate date is a weekday
    try:
        d = datetime.strptime(data.date, "%Y-%m-%d")
        if d.weekday() >= 5:
            return {"error": "Demos kan kun bookes på hverdage"}
    except ValueError:
        return {"error": "Ugyldig dato"}

    # Validate slot is available
    slots = _get_available_slots(data.date)
    slot = next((s for s in slots if s["start_time"] == data.start_time), None)
    if not slot:
        return {"error": "Tidspunktet er ikke længere ledigt"}

    # Assign staff member (round-robin)
    assigned = _assign_staff(data.date, data.start_time)

    # Build task description
    clinic_suffix = f" ({data.client_clinic})" if data.client_clinic else ""
    task_title = f"Demo: {data.client_name}{clinic_suffix}"

    desc_parts = [
        f"Video-demo booking",
        f"Dato: {data.date} kl. {data.start_time}-{slot['end_time']}",
        f"Navn: {data.client_name}",
        f"Email: {data.client_email}",
    ]
    if data.client_phone:
        desc_parts.append(f"Tlf: {data.client_phone}")
    if data.client_clinic:
        desc_parts.append(f"Klinik: {data.client_clinic}")
    if assigned:
        desc_parts.append(f"Demo-giver: {assigned['name']}")
    if data.notes:
        desc_parts.append(f"Note: {data.notes}")

    # Try Google Calendar + Meet
    calendar_event_id = None
    meet_link = None

    attendee_emails = [data.client_email]
    if assigned:
        attendee_emails.append(assigned["email"])

    gcal_result = gcal_create_event(
        date=data.date,
        start_time=data.start_time,
        end_time=slot["end_time"],
        summary=f"People's Clinic Demo \u2014 {data.client_name}{clinic_suffix}",
        description="\n".join(desc_parts),
        attendee_emails=attendee_emails,
    )

    if gcal_result:
        meet_link = gcal_result["meet_link"]
        calendar_event_id = gcal_result["event_id"]
    else:
        # Fallback to Jitsi
        meet_link = f"https://meet.jit.si/peoples-demo-{booking_id}"

    # Add meet link to task description
    desc_parts.append(f"Meet: {meet_link}")
    task_desc = "\n".join(desc_parts)

    # Auto-create internal task (with assigned demo-giver as assignee)
    task_id = gen_id("t_")
    assigned_id = assigned["id"] if assigned else None
    execute(
        """INSERT INTO tasks (id, title, description, status, priority, type, tags, deadline,
           created_at, updated_at, sort_order, is_archived, tab, calendar_event_id, assignee_id)
           VALUES (%s, %s, %s, 'todo', 'high', 'onboarding', '["demo"]', %s, NOW(), NOW(),
           (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks), false, 'csm', %s, %s)""",
        (task_id, task_title, task_desc, data.date, calendar_event_id, assigned_id),
    )

    # Create demo booking
    rows = query(
        """INSERT INTO demo_bookings (id, date, start_time, end_time, client_name, client_email,
           client_phone, client_clinic, staff_id, meet_link, status, task_id, notes, calendar_event_id)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'confirmed', %s, %s, %s)
           RETURNING *""",
        (
            booking_id, data.date, data.start_time, slot["end_time"],
            data.client_name, data.client_email, data.client_phone,
            data.client_clinic, assigned["id"] if assigned else None,
            meet_link, task_id, data.notes, calendar_event_id,
        ),
    )

    # Create primary participant record
    participant_id = gen_id("dp_")
    execute(
        """INSERT INTO demo_participants (id, booking_id, name, email, role, is_primary)
           VALUES (%s, %s, %s, %s, '', true)""",
        (participant_id, booking_id, data.client_name, data.client_email),
    )

    result = rows[0]
    if assigned:
        result["staff_name"] = assigned["name"]
    return result


@router.get("/{booking_id}/info")
def get_demo_info(booking_id: str):
    """Public info for the participant join page — no sensitive data exposed."""
    rows = query(
        """SELECT id, date, start_time, end_time, client_clinic, status, calendar_event_id
           FROM demo_bookings WHERE id = %s""",
        (booking_id,),
    )
    if not rows:
        return {"error": "Booking ikke fundet"}

    booking = rows[0]
    if booking["status"] == "cancelled":
        return {"error": "Denne demo er aflyst"}

    # Get existing participants (names + roles only, no emails)
    participants = query(
        "SELECT name, role, is_primary FROM demo_participants WHERE booking_id = %s ORDER BY created_at",
        (booking_id,),
    )

    return {
        "id": booking["id"],
        "date": str(booking["date"]),
        "start_time": booking["start_time"],
        "end_time": booking["end_time"],
        "clinic": booking["client_clinic"],
        "status": booking["status"],
        "has_calendar_event": bool(booking["calendar_event_id"]),
        "participants": participants,
    }


@router.post("/{booking_id}/join", status_code=201)
def join_demo(booking_id: str, data: ParticipantJoin):
    """A colleague joins an existing demo booking. Adds them to the Calendar event."""
    # Fetch booking
    rows = query(
        "SELECT * FROM demo_bookings WHERE id = %s AND status != 'cancelled'",
        (booking_id,),
    )
    if not rows:
        return {"error": "Booking ikke fundet eller er aflyst"}

    booking = rows[0]

    # Check for duplicate email
    existing = query(
        "SELECT id FROM demo_participants WHERE booking_id = %s AND LOWER(email) = LOWER(%s)",
        (booking_id, data.email),
    )
    if existing:
        return {"error": "Denne email er allerede tilmeldt"}

    # Save participant
    participant_id = gen_id("dp_")
    execute(
        """INSERT INTO demo_participants (id, booking_id, name, email, role, is_primary)
           VALUES (%s, %s, %s, %s, %s, false)""",
        (participant_id, booking_id, data.name, data.email, data.role),
    )

    # Add to Google Calendar event (if one exists)
    calendar_added = False
    if booking.get("calendar_event_id"):
        calendar_added = gcal_add_attendee(
            event_id=booking["calendar_event_id"],
            email=data.email,
            name=data.name,
        )

    return {
        "ok": True,
        "participant_id": participant_id,
        "calendar_invite_sent": calendar_added,
        # Only expose meet link directly if Calendar didn't send an invite
        "meet_link": booking["meet_link"] if not calendar_added else "",
    }


# ── Internal endpoints ────────────────────────────────────────────

@router.get("")
def list_demo_bookings(status: Optional[str] = None, date: Optional[str] = None):
    """List demo bookings (internal use)."""
    sql = "SELECT db.*, tm.name as staff_name FROM demo_bookings db LEFT JOIN team_members tm ON db.staff_id = tm.id WHERE 1=1"
    params: list = []

    if status:
        sql += " AND db.status = %s"
        params.append(status)
    if date:
        sql += " AND db.date = %s"
        params.append(date)

    sql += " ORDER BY db.date ASC, db.start_time ASC"
    return query(sql, tuple(params))


@router.post("/{booking_id}/cancel")
def cancel_demo_booking(booking_id: str):
    """Cancel a demo booking and remove calendar event."""
    rows = query(
        "UPDATE demo_bookings SET status = 'cancelled' WHERE id = %s RETURNING *",
        (booking_id,),
    )
    if not rows:
        return {"error": "Booking ikke fundet"}

    booking = rows[0]

    # Delete calendar event if it exists (sends cancellation to attendees)
    if booking.get("calendar_event_id"):
        gcal_delete_event(booking["calendar_event_id"])

    return booking
