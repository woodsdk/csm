"""Platform API — Public endpoints for People's Doctor platform integration."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id

router = APIRouter()


# ── Models ──

class PlatformTicketCreate(BaseModel):
    subject: str
    description: str = ""
    user_id: str
    requester_name: str = ""
    requester_email: str = ""


class AnnouncementReadRequest(BaseModel):
    user_id: str


# ── Announcements for PD ──

@router.get("/announcements")
def get_user_announcements(user_id: str = ""):
    """Get active, unread announcements for a platform user."""
    if not user_id:
        return []

    # Get published, non-expired announcements that have a delivery row for this user
    results = query("""
        SELECT a.id, a.title, a.body, a.type, a.published_at
        FROM announcements a
        JOIN announcement_deliveries ad ON ad.announcement_id = a.id AND ad.user_id = %s
        WHERE a.status = 'published'
          AND ad.read_at IS NULL
          AND (a.expires_at IS NULL OR a.expires_at > NOW())
        ORDER BY a.published_at DESC
    """, (user_id,))

    return results


@router.post("/announcements/{ann_id}/read")
def mark_announcement_read(ann_id: str, data: AnnouncementReadRequest):
    """Mark an announcement as read by a user."""
    execute("""
        UPDATE announcement_deliveries
        SET read_at = NOW()
        WHERE announcement_id = %s AND user_id = %s AND read_at IS NULL
    """, (ann_id, data.user_id))

    return {"ok": True}


# ── Tickets from PD ──

@router.post("/tickets")
def create_platform_ticket(data: PlatformTicketCreate):
    """Create a support ticket from the People's Doctor platform."""
    ticket_id = gen_id("tk_")

    # Link to platform user
    users = query("SELECT id, name, email FROM platform_users WHERE id = %s", (data.user_id,))
    platform_user_id = users[0]["id"] if users else None
    requester_name = data.requester_name or (users[0]["name"] if users else "")
    requester_email = data.requester_email or (users[0].get("email", "") if users else "")

    execute("""
        INSERT INTO tickets (id, subject, description, status, priority, source, requester_name, requester_email, platform_user_id)
        VALUES (%s, %s, %s, 'open', 'medium', 'platform', %s, %s, %s)
    """, (ticket_id, data.subject, data.description, requester_name, requester_email, platform_user_id))

    # Create initial message
    msg_id = gen_id("tm_")
    execute("""
        INSERT INTO ticket_messages (id, ticket_id, sender_type, sender_name, sender_email, body)
        VALUES (%s, %s, 'user', %s, %s, %s)
    """, (msg_id, ticket_id, requester_name, requester_email, data.description))

    return {"ok": True, "ticket_id": ticket_id}


@router.get("/tickets")
def get_user_tickets(user_id: str = ""):
    """Get tickets for a platform user."""
    if not user_id:
        return []

    results = query("""
        SELECT id, subject, status, priority, created_at, updated_at
        FROM tickets
        WHERE platform_user_id = %s
        ORDER BY created_at DESC
    """, (user_id,))

    return results
