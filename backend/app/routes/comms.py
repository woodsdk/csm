"""Comms Routes — Internal announcement management for SynergyHub."""

import json
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id

router = APIRouter()


# ── Models ──

class AnnouncementCreate(BaseModel):
    title: str
    body: str = ""
    type: str = "modal"  # modal | banner
    audience_type: str = "all"  # all | segment
    segment_id: Optional[str] = None
    publish_at: Optional[str] = None
    expires_at: Optional[str] = None
    created_by: str = ""


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    type: Optional[str] = None
    audience_type: Optional[str] = None
    segment_id: Optional[str] = None
    publish_at: Optional[str] = None
    expires_at: Optional[str] = None


# ── CRUD ──

@router.get("/announcements")
def list_announcements():
    """List all announcements with delivery/read counts."""
    results = query("""
        SELECT a.*,
            (SELECT COUNT(*) FROM announcement_deliveries ad WHERE ad.announcement_id = a.id) as delivery_count,
            (SELECT COUNT(*) FROM announcement_deliveries ad WHERE ad.announcement_id = a.id AND ad.read_at IS NOT NULL) as read_count,
            ms.name as segment_name
        FROM announcements a
        LEFT JOIN marketing_segments ms ON a.segment_id = ms.id
        ORDER BY a.created_at DESC
    """)
    return results


@router.post("/announcements")
def create_announcement(data: AnnouncementCreate):
    """Create a new announcement (draft)."""
    ann_id = gen_id("ann_")

    status = "draft"
    if data.publish_at:
        status = "scheduled"

    execute("""
        INSERT INTO announcements (id, title, body, type, audience_type, segment_id, status, publish_at, expires_at, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (ann_id, data.title, data.body, data.type, data.audience_type,
          data.segment_id, status,
          data.publish_at or None, data.expires_at or None,
          data.created_by))

    return {"ok": True, "id": ann_id}


@router.patch("/announcements/{ann_id}")
def update_announcement(ann_id: str, data: AnnouncementUpdate):
    """Update a draft or scheduled announcement."""
    existing = query("SELECT status FROM announcements WHERE id = %s", (ann_id,))
    if not existing:
        return {"error": "Announcement ikke fundet"}
    if existing[0]["status"] == "published":
        return {"error": "Kan ikke redigere en publiceret announcement"}

    updates = []
    params = []
    if data.title is not None:
        updates.append("title = %s")
        params.append(data.title)
    if data.body is not None:
        updates.append("body = %s")
        params.append(data.body)
    if data.type is not None:
        updates.append("type = %s")
        params.append(data.type)
    if data.audience_type is not None:
        updates.append("audience_type = %s")
        params.append(data.audience_type)
    if data.segment_id is not None:
        updates.append("segment_id = %s")
        params.append(data.segment_id if data.segment_id else None)
    if data.publish_at is not None:
        updates.append("publish_at = %s")
        params.append(data.publish_at if data.publish_at else None)
    if data.expires_at is not None:
        updates.append("expires_at = %s")
        params.append(data.expires_at if data.expires_at else None)

    if not updates:
        return {"ok": True}

    updates.append("updated_at = NOW()")
    params.append(ann_id)
    execute(f"UPDATE announcements SET {', '.join(updates)} WHERE id = %s", tuple(params))

    return {"ok": True}


@router.delete("/announcements/{ann_id}")
def delete_announcement(ann_id: str):
    """Delete a draft announcement."""
    existing = query("SELECT status FROM announcements WHERE id = %s", (ann_id,))
    if not existing:
        return {"error": "Announcement ikke fundet"}
    if existing[0]["status"] == "published":
        return {"error": "Kan ikke slette en publiceret announcement"}

    execute("DELETE FROM announcements WHERE id = %s", (ann_id,))
    return {"ok": True}


@router.post("/announcements/{ann_id}/publish")
def publish_announcement(ann_id: str):
    """Publish an announcement and generate delivery rows for target users."""
    existing = query("SELECT * FROM announcements WHERE id = %s", (ann_id,))
    if not existing:
        return {"error": "Announcement ikke fundet"}

    ann = existing[0]
    if ann["status"] == "published":
        return {"error": "Allerede publiceret"}

    # Update status
    execute("""
        UPDATE announcements SET status = 'published', published_at = NOW(), updated_at = NOW()
        WHERE id = %s
    """, (ann_id,))

    # Resolve target users
    if ann["audience_type"] == "segment" and ann.get("segment_id"):
        # Use marketing engine segment query
        segments = query("SELECT filter_rules FROM marketing_segments WHERE id = %s", (ann["segment_id"],))
        if segments:
            rules = segments[0].get("filter_rules") or {}
            if isinstance(rules, str):
                rules = json.loads(rules)
            from ..marketing_engine import query_segment_users
            users = query_segment_users(rules)
        else:
            users = []
    else:
        # All active platform users
        users = query("SELECT id FROM platform_users WHERE status IN ('active', 'onboarding')")

    # Generate delivery rows
    delivered = 0
    for u in users:
        try:
            del_id = gen_id("ad_")
            execute("""
                INSERT INTO announcement_deliveries (id, announcement_id, user_id)
                VALUES (%s, %s, %s)
                ON CONFLICT (announcement_id, user_id) DO NOTHING
            """, (del_id, ann_id, u["id"]))
            delivered += 1
        except Exception:
            pass

    return {"ok": True, "delivered_to": delivered}


@router.get("/announcements/{ann_id}/stats")
def get_announcement_stats(ann_id: str):
    """Get detailed delivery stats for an announcement."""
    deliveries = query("""
        SELECT ad.user_id, ad.delivered_at, ad.read_at,
               pu.name as user_name, pu.clinic_name, pu.email
        FROM announcement_deliveries ad
        LEFT JOIN platform_users pu ON ad.user_id = pu.id
        WHERE ad.announcement_id = %s
        ORDER BY ad.read_at DESC NULLS LAST, ad.delivered_at DESC
    """, (ann_id,))

    total = len(deliveries)
    read = sum(1 for d in deliveries if d.get("read_at"))

    return {
        "delivery_count": total,
        "read_count": read,
        "read_pct": round(read / total * 100) if total > 0 else 0,
        "deliveries": deliveries,
    }


@router.get("/stats")
def get_comms_stats():
    """Overall communication stats."""
    ann_stats = query("""
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'published') as published,
            COUNT(*) FILTER (WHERE status = 'draft') as draft,
            COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
            COUNT(*) FILTER (WHERE status = 'expired') as expired
        FROM announcements
    """)

    ticket_stats = query("""
        SELECT
            COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as platform_tickets_open,
            COUNT(*) as platform_tickets_total
        FROM tickets
        WHERE source = 'platform'
    """)

    return {
        "announcements": ann_stats[0] if ann_stats else {},
        "platform_tickets_open": ticket_stats[0]["platform_tickets_open"] if ticket_stats else 0,
        "platform_tickets_total": ticket_stats[0]["platform_tickets_total"] if ticket_stats else 0,
    }
