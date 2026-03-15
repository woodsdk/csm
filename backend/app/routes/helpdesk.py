"""Helpdesk Routes — Ticket management system."""

from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id
from ..openai_helper import generate_reply_suggestion, classify_ticket_priority, is_configured as openai_configured

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
    platform_user_id: Optional[str] = None


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    assignee_id: Optional[str] = None
    platform_user_id: Optional[str] = None


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
    source: Optional[str] = None,
):
    """List tickets with optional filters."""
    sql = """SELECT t.*, tm.name as assignee_name,
                    pu.name as platform_user_name, pu.health_score as platform_user_health
             FROM tickets t
             LEFT JOIN team_members tm ON t.assignee_id = tm.id
             LEFT JOIN platform_users pu ON t.platform_user_id = pu.id
             WHERE 1=1"""
    params: list = []

    if status:
        # Support comma-separated statuses (e.g. "open,in_progress")
        statuses = [s.strip() for s in status.split(',')]
        if len(statuses) == 1:
            sql += " AND t.status = %s"
            params.append(statuses[0])
        else:
            placeholders = ','.join(['%s'] * len(statuses))
            sql += f" AND t.status IN ({placeholders})"
            params.extend(statuses)
    if priority:
        sql += " AND t.priority = %s"
        params.append(priority)
    if assignee_id:
        sql += " AND t.assignee_id = %s"
        params.append(assignee_id)
    if category:
        sql += " AND t.category = %s"
        params.append(category)
    if source:
        sql += " AND t.source = %s"
        params.append(source)

    # Smart sort: priority first (urgent → low), then newest first
    sql += """ ORDER BY
        CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
        t.created_at DESC"""
    return query(sql, tuple(params))


@router.get("/{ticket_id}")
def get_ticket(ticket_id: str):
    """Get ticket with all messages."""
    rows = query(
        """SELECT t.*, tm.name as assignee_name,
                  pu.name as platform_user_name, pu.email as platform_user_email,
                  pu.clinic_name as platform_user_clinic, pu.health_score as platform_user_health,
                  pu.status as platform_user_status,
                  (SELECT COUNT(*) FROM platform_consultations pc WHERE pc.user_id = pu.id) as platform_user_consultations,
                  (SELECT ROUND(AVG(pc.rating)::numeric, 1) FROM platform_consultations pc WHERE pc.user_id = pu.id) as platform_user_avg_rating,
                  EXTRACT(EPOCH FROM (NOW() - pu.signup_at)) / 86400 as platform_user_days_since_signup
           FROM tickets t
           LEFT JOIN team_members tm ON t.assignee_id = tm.id
           LEFT JOIN platform_users pu ON t.platform_user_id = pu.id
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
    """Create a new ticket. Uses AI to classify priority if not explicitly set."""
    ticket_id = gen_id("tk_")

    priority = data.priority
    category = data.category
    priority_source = "manual"

    # If priority is default 'medium' and no explicit override, let AI classify
    if data.priority == "medium":
        classification = classify_ticket_priority(
            subject=data.subject,
            body=data.description,
        )
        priority = classification["priority"]
        priority_source = "ai"
        # Also auto-set category if none chosen
        if not data.category:
            category = classification["category"]

    rows = query(
        """INSERT INTO tickets (id, subject, description, status, priority, category,
           source, requester_name, requester_email, assignee_id, platform_user_id, priority_source)
           VALUES (%s, %s, %s, 'open', %s, %s, %s, %s, %s, %s, %s, %s)
           RETURNING *""",
        (
            ticket_id, data.subject, data.description, priority,
            category, data.source, data.requester_name,
            data.requester_email, data.assignee_id, data.platform_user_id,
            priority_source,
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

    for key in ["subject", "description", "status", "priority", "category", "assignee_id", "platform_user_id"]:
        if key in data_dict:
            fields.append(f"{key} = %s")
            params.append(data_dict[key])

    # If priority is manually changed, update source to 'manual'
    if "priority" in data_dict:
        fields.append("priority_source = 'manual'")

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

    # Auto-send email via Gmail if agent reply (not internal) and requester has email
    if data.sender_type == "agent" and not data.is_internal:
        try:
            from ..google_oauth import is_connected as gmail_connected
            from ..gmail import send_email

            if gmail_connected():
                ticket_data = query("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
                if ticket_data and ticket_data[0].get("requester_email"):
                    t = ticket_data[0]
                    result = send_email(
                        to=t["requester_email"],
                        subject=f"Re: {t['subject']}",
                        body_html=data.body,
                        thread_id=t.get("gmail_thread_id"),
                        use_template=True,
                    )
                    if result:
                        # Store gmail references
                        execute(
                            "UPDATE ticket_messages SET gmail_message_id = %s WHERE id = %s",
                            (result["message_id"], msg_id),
                        )
                        if result.get("thread_id") and not t.get("gmail_thread_id"):
                            execute(
                                "UPDATE tickets SET gmail_thread_id = %s WHERE id = %s",
                                (result["thread_id"], ticket_id),
                            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Gmail auto-send failed: {e}")

    return rows[0]


# ── AI Suggest ────────────────────────────────────────────────────

class AiSuggestRequest(BaseModel):
    prompt: str = ""


@router.post("/{ticket_id}/ai-suggest")
def ai_suggest_reply(ticket_id: str, data: AiSuggestRequest = None):
    """Generate an AI reply suggestion using OpenAI + FAQ context."""
    if data is None:
        data = AiSuggestRequest()

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
        user_instruction=data.prompt,
    )

    if suggestion is None:
        if not openai_configured():
            return {"error": "OPENAI_API_KEY er ikke sat i miljøvariablerne."}
        return {"error": "AI kunne ikke generere et svar. Prøv igen."}

    return {"suggestion": suggestion}
