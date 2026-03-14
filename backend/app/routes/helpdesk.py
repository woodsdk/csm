"""Helpdesk Routes — Ticket management system."""

from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id
from ..openai_helper import generate_reply_suggestion

router = APIRouter()


class TicketCreate(BaseModel):
    subject: str
    description: str = ""
    priority: str = "medium"
    category: str = ""
    source: str = "manual"
    requester_name: str = ""
    requester_email: str = ""
    assignee_id: Optional[str] = None


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    assignee_id: Optional[str] = None


class TicketMessageCreate(BaseModel):
    body: str
    sender_type: str = "agent"
    sender_name: str = ""
    sender_email: str = ""
    is_internal: bool = False


# ── Stats ────────────────────────────────────────────────────────

@router.get("/stats")
def get_helpdesk_stats():
    """Dashboard stats for helpdesk."""
    stats = query("""
        SELECT
            COUNT(*) FILTER (WHERE status = 'open') as open_count,
            COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
            COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
            COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
            COUNT(*) as total
        FROM tickets
    """)
    return stats[0] if stats else {
        "open_count": 0, "in_progress_count": 0,
        "resolved_count": 0, "closed_count": 0, "total": 0
    }


# ── Ticket CRUD ──────────────────────────────────────────────────

@router.get("")
def list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_id: Optional[str] = None,
    category: Optional[str] = None,
):
    """List tickets with optional filters."""
    sql = """SELECT t.*, tm.name as assignee_name
             FROM tickets t
             LEFT JOIN team_members tm ON t.assignee_id = tm.id
             WHERE 1=1"""
    params: list = []

    if status:
        sql += " AND t.status = %s"
        params.append(status)
    if priority:
        sql += " AND t.priority = %s"
        params.append(priority)
    if assignee_id:
        sql += " AND t.assignee_id = %s"
        params.append(assignee_id)
    if category:
        sql += " AND t.category = %s"
        params.append(category)

    sql += " ORDER BY t.created_at DESC"
    return query(sql, tuple(params))


@router.get("/{ticket_id}")
def get_ticket(ticket_id: str):
    """Get ticket with all messages."""
    rows = query(
        """SELECT t.*, tm.name as assignee_name
           FROM tickets t
           LEFT JOIN team_members tm ON t.assignee_id = tm.id
           WHERE t.id = %s""",
        (ticket_id,),
    )
    if not rows:
        return {"error": "Ticket ikke fundet"}

    ticket = rows[0]
    ticket["messages"] = query(
        "SELECT * FROM ticket_messages WHERE ticket_id = %s ORDER BY created_at ASC",
        (ticket_id,),
    )
    return ticket


@router.post("", status_code=201)
def create_ticket(data: TicketCreate):
    """Create a new ticket."""
    ticket_id = gen_id("tk_")
    rows = query(
        """INSERT INTO tickets (id, subject, description, status, priority, category,
           source, requester_name, requester_email, assignee_id)
           VALUES (%s, %s, %s, 'open', %s, %s, %s, %s, %s, %s)
           RETURNING *""",
        (
            ticket_id, data.subject, data.description, data.priority,
            data.category, data.source, data.requester_name,
            data.requester_email, data.assignee_id,
        ),
    )
    return rows[0]


@router.patch("/{ticket_id}")
def update_ticket(ticket_id: str, data: TicketUpdate):
    """Update ticket fields."""
    current = query("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
    if not current:
        return {"error": "Ticket ikke fundet"}

    fields = []
    params = []
    data_dict = data.model_dump(exclude_unset=True)

    for key in ["subject", "description", "status", "priority", "category", "assignee_id"]:
        if key in data_dict:
            fields.append(f"{key} = %s")
            params.append(data_dict[key])

    # Track resolved_at
    if "status" in data_dict:
        if data_dict["status"] == "resolved" and current[0].get("status") != "resolved":
            fields.append("resolved_at = NOW()")
        elif data_dict["status"] != "resolved":
            fields.append("resolved_at = NULL")

    fields.append("updated_at = NOW()")

    params.append(ticket_id)
    sql = f"UPDATE tickets SET {', '.join(fields)} WHERE id = %s RETURNING *"
    rows = query(sql, tuple(params))

    if rows:
        ticket = rows[0]
        # Re-fetch with assignee name
        full = query(
            """SELECT t.*, tm.name as assignee_name
               FROM tickets t LEFT JOIN team_members tm ON t.assignee_id = tm.id
               WHERE t.id = %s""",
            (ticket_id,),
        )
        return full[0] if full else ticket
    return current[0]


# ── Messages ─────────────────────────────────────────────────────

@router.post("/{ticket_id}/messages", status_code=201)
def add_ticket_message(ticket_id: str, data: TicketMessageCreate):
    """Add a message/reply to a ticket."""
    # Verify ticket exists
    ticket = query("SELECT id FROM tickets WHERE id = %s", (ticket_id,))
    if not ticket:
        return {"error": "Ticket ikke fundet"}

    msg_id = gen_id("msg_")
    rows = query(
        """INSERT INTO ticket_messages (id, ticket_id, sender_type, sender_name,
           sender_email, body, is_internal)
           VALUES (%s, %s, %s, %s, %s, %s, %s)
           RETURNING *""",
        (
            msg_id, ticket_id, data.sender_type, data.sender_name,
            data.sender_email, data.body, data.is_internal,
        ),
    )

    # Update ticket's updated_at
    execute("UPDATE tickets SET updated_at = NOW() WHERE id = %s", (ticket_id,))

    return rows[0]


# ── AI Suggest ────────────────────────────────────────────────────

@router.post("/{ticket_id}/ai-suggest")
def ai_suggest_reply(ticket_id: str):
    """Generate an AI reply suggestion using OpenAI + FAQ context."""
    # Get ticket
    ticket = query("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
    if not ticket:
        return {"error": "Ticket ikke fundet"}

    t = ticket[0]

    # Get messages
    messages = query(
        "SELECT * FROM ticket_messages WHERE ticket_id = %s ORDER BY created_at ASC",
        (ticket_id,),
    )

    # Get FAQ items for context
    faq_items = query("SELECT question, answer, category FROM faq_items ORDER BY sort_order ASC")

    # Generate suggestion
    suggestion = generate_reply_suggestion(
        ticket_subject=t["subject"],
        ticket_description=t.get("description", ""),
        messages=messages,
        faq_items=faq_items,
    )

    if suggestion is None:
        return {"error": "AI er ikke tilgængelig. Tjek at OPENAI_API_KEY er konfigureret."}

    return {"suggestion": suggestion}
