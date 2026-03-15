"""Marketing Routes — Flow management, segments, campaigns, history."""

import json
import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Pydantic Models ──────────────────────────────────────────────────

class FlowCreate(BaseModel):
    name: str
    description: str = ""
    trigger_type: str = "manual"
    trigger_config: dict = {}
    segment_id: Optional[str] = None

class FlowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[dict] = None
    segment_id: Optional[str] = None

class StepCreate(BaseModel):
    step_type: str = "email"
    config: dict = {}

class StepUpdate(BaseModel):
    step_type: Optional[str] = None
    config: Optional[dict] = None

class SegmentCreate(BaseModel):
    name: str
    description: str = ""
    filter_rules: dict = {}

class SegmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    filter_rules: Optional[dict] = None

class EnrollRequest(BaseModel):
    user_ids: list[str]

class CampaignRequest(BaseModel):
    segment_id: str
    brief: str
    subject_hint: str = ""


# ── Stats ────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats():
    """Dashboard stats for marketing."""
    total_sent = query("SELECT COUNT(*) as cnt FROM marketing_emails_sent")
    sent_week = query(
        "SELECT COUNT(*) as cnt FROM marketing_emails_sent WHERE sent_at > NOW() - INTERVAL '7 days'"
    )
    active_flows = query("SELECT COUNT(*) as cnt FROM marketing_flows WHERE status = 'active'")
    active_enrollments = query(
        "SELECT COUNT(*) as cnt FROM marketing_enrollments WHERE status = 'active'"
    )

    per_flow = query("""
        SELECT mf.id as flow_id, mf.name as flow_name,
               COUNT(mes.id) as sent_count,
               (SELECT COUNT(*) FROM marketing_enrollments me WHERE me.flow_id = mf.id) as enrollment_count,
               (SELECT COUNT(*) FROM marketing_enrollments me WHERE me.flow_id = mf.id AND me.status = 'completed') as completed_count
        FROM marketing_flows mf
        LEFT JOIN marketing_emails_sent mes ON mes.flow_id = mf.id
        WHERE mf.is_template = false
        GROUP BY mf.id, mf.name
        ORDER BY sent_count DESC
    """)

    failed_count = query(
        "SELECT COUNT(*) as cnt FROM marketing_emails_sent WHERE send_error IS NOT NULL"
    )

    return {
        "total_sent": total_sent[0]["cnt"] if total_sent else 0,
        "sent_this_week": sent_week[0]["cnt"] if sent_week else 0,
        "active_flows": active_flows[0]["cnt"] if active_flows else 0,
        "active_enrollments": active_enrollments[0]["cnt"] if active_enrollments else 0,
        "failed_count": failed_count[0]["cnt"] if failed_count else 0,
        "per_flow": per_flow or [],
    }


# ── Flows CRUD ───────────────────────────────────────────────────────

@router.get("/flows")
def list_flows():
    """List all flows with stats."""
    flows = query("""
        SELECT mf.*,
               (SELECT COUNT(*) FROM marketing_flow_steps WHERE flow_id = mf.id) as step_count,
               (SELECT COUNT(*) FROM marketing_enrollments WHERE flow_id = mf.id) as enrollment_count,
               (SELECT COUNT(*) FROM marketing_emails_sent WHERE flow_id = mf.id) as sent_count
        FROM marketing_flows mf
        WHERE mf.is_template = false
        ORDER BY mf.updated_at DESC
    """)
    return flows or []


@router.get("/templates")
def list_templates():
    """List pre-built flow templates."""
    templates = query("""
        SELECT mf.*,
               (SELECT COUNT(*) FROM marketing_flow_steps WHERE flow_id = mf.id) as step_count
        FROM marketing_flows mf
        WHERE mf.is_template = true
        ORDER BY mf.name
    """)
    return templates or []


@router.get("/flows/{flow_id}")
def get_flow(flow_id: str):
    """Get flow detail with steps and enrollments."""
    flows = query("SELECT * FROM marketing_flows WHERE id = %s", (flow_id,))
    if not flows:
        return {"error": "Flow not found"}

    flow = flows[0]
    flow["steps"] = query(
        "SELECT * FROM marketing_flow_steps WHERE flow_id = %s ORDER BY step_order",
        (flow_id,),
    ) or []
    flow["enrollments"] = query(
        """SELECT me.*, pu.name as user_name, pu.clinic_name, pu.email as user_email
           FROM marketing_enrollments me
           JOIN platform_users pu ON pu.id = me.user_id
           WHERE me.flow_id = %s
           ORDER BY me.enrolled_at DESC
           LIMIT 50""",
        (flow_id,),
    ) or []
    return flow


@router.post("/flows", status_code=201)
def create_flow(data: FlowCreate):
    """Create a new flow."""
    flow_id = gen_id("mf_")
    execute(
        """INSERT INTO marketing_flows (id, name, description, trigger_type, trigger_config, segment_id)
           VALUES (%s, %s, %s, %s, %s::jsonb, %s)""",
        (flow_id, data.name, data.description, data.trigger_type,
         json.dumps(data.trigger_config), data.segment_id),
    )
    return {"id": flow_id}


@router.post("/flows/clone/{template_id}", status_code=201)
def clone_template(template_id: str):
    """Clone a template into a new editable flow."""
    templates = query("SELECT * FROM marketing_flows WHERE id = %s AND is_template = true", (template_id,))
    if not templates:
        return {"error": "Template not found"}

    tpl = templates[0]
    flow_id = gen_id("mf_")
    config = tpl.get("trigger_config") or "{}"
    if isinstance(config, dict):
        config = json.dumps(config)
    execute(
        """INSERT INTO marketing_flows (id, name, description, trigger_type, trigger_config, segment_id, status)
           VALUES (%s, %s, %s, %s, %s::jsonb, %s, 'draft')""",
        (flow_id, tpl["name"], tpl["description"], tpl["trigger_type"], config, tpl.get("segment_id")),
    )

    # Clone steps
    steps = query("SELECT * FROM marketing_flow_steps WHERE flow_id = %s ORDER BY step_order", (template_id,))
    for step in (steps or []):
        step_config = step.get("config") or "{}"
        if isinstance(step_config, dict):
            step_config = json.dumps(step_config)
        execute(
            """INSERT INTO marketing_flow_steps (id, flow_id, step_order, step_type, config)
               VALUES (%s, %s, %s, %s, %s::jsonb)""",
            (gen_id("mfs_"), flow_id, step["step_order"], step["step_type"], step_config),
        )

    return {"id": flow_id}


@router.patch("/flows/{flow_id}")
def update_flow(flow_id: str, data: FlowUpdate):
    """Update a flow."""
    updates = []
    params = []
    if data.name is not None:
        updates.append("name = %s")
        params.append(data.name)
    if data.description is not None:
        updates.append("description = %s")
        params.append(data.description)
    if data.trigger_type is not None:
        updates.append("trigger_type = %s")
        params.append(data.trigger_type)
    if data.trigger_config is not None:
        updates.append("trigger_config = %s::jsonb")
        params.append(json.dumps(data.trigger_config))
    if data.segment_id is not None:
        updates.append("segment_id = %s")
        params.append(data.segment_id if data.segment_id else None)

    if updates:
        updates.append("updated_at = NOW()")
        params.append(flow_id)
        execute(f"UPDATE marketing_flows SET {', '.join(updates)} WHERE id = %s", tuple(params))

    return {"ok": True}


@router.delete("/flows/{flow_id}")
def delete_flow(flow_id: str):
    """Delete a flow with all related data (steps, enrollments, sent emails)."""
    # Check flow exists
    flows = query("SELECT id, is_template FROM marketing_flows WHERE id = %s", (flow_id,))
    if not flows:
        return {"error": "Flow not found"}
    if flows[0].get("is_template"):
        return {"error": "Skabeloner kan ikke slettes"}

    # Cascade delete related data
    execute("DELETE FROM marketing_emails_sent WHERE flow_id = %s", (flow_id,))
    execute("DELETE FROM marketing_enrollments WHERE flow_id = %s", (flow_id,))
    execute("DELETE FROM marketing_flow_steps WHERE flow_id = %s", (flow_id,))
    execute("DELETE FROM marketing_flows WHERE id = %s", (flow_id,))
    return {"ok": True}


@router.post("/flows/{flow_id}/activate")
def activate_flow(flow_id: str):
    """Activate a flow."""
    steps = query("SELECT COUNT(*) as cnt FROM marketing_flow_steps WHERE flow_id = %s", (flow_id,))
    if not steps or steps[0]["cnt"] == 0:
        return {"error": "Flow har ingen trin — tilfoej mindst ét trin foerst"}
    execute("UPDATE marketing_flows SET status = 'active', updated_at = NOW() WHERE id = %s", (flow_id,))
    return {"ok": True}


@router.post("/flows/{flow_id}/pause")
def pause_flow(flow_id: str):
    """Pause a flow."""
    execute("UPDATE marketing_flows SET status = 'paused', updated_at = NOW() WHERE id = %s", (flow_id,))
    return {"ok": True}


# ── Steps ────────────────────────────────────────────────────────────

@router.post("/flows/{flow_id}/steps", status_code=201)
def add_step(flow_id: str, data: StepCreate):
    """Add a step to a flow."""
    # Get next order
    max_order = query(
        "SELECT COALESCE(MAX(step_order), -1) as mx FROM marketing_flow_steps WHERE flow_id = %s",
        (flow_id,),
    )
    order = (max_order[0]["mx"] + 1) if max_order else 0

    step_id = gen_id("mfs_")
    execute(
        """INSERT INTO marketing_flow_steps (id, flow_id, step_order, step_type, config)
           VALUES (%s, %s, %s, %s, %s::jsonb)""",
        (step_id, flow_id, order, data.step_type, json.dumps(data.config)),
    )
    return {"id": step_id, "step_order": order}


@router.patch("/flows/{flow_id}/steps/{step_id}")
def update_step(flow_id: str, step_id: str, data: StepUpdate):
    """Update a step."""
    updates = []
    params = []
    if data.step_type is not None:
        updates.append("step_type = %s")
        params.append(data.step_type)
    if data.config is not None:
        updates.append("config = %s::jsonb")
        params.append(json.dumps(data.config))

    if updates:
        params.append(step_id)
        execute(f"UPDATE marketing_flow_steps SET {', '.join(updates)} WHERE id = %s", tuple(params))

    return {"ok": True}


@router.delete("/flows/{flow_id}/steps/{step_id}")
def delete_step(flow_id: str, step_id: str):
    """Delete a step and re-order remaining steps."""
    execute("DELETE FROM marketing_flow_steps WHERE id = %s", (step_id,))
    # Re-order remaining steps
    steps = query(
        "SELECT id FROM marketing_flow_steps WHERE flow_id = %s ORDER BY step_order",
        (flow_id,),
    )
    for i, step in enumerate(steps or []):
        execute("UPDATE marketing_flow_steps SET step_order = %s WHERE id = %s", (i, step["id"]))
    return {"ok": True}


@router.post("/flows/{flow_id}/preview-step/{step_id}")
def preview_step(flow_id: str, step_id: str):
    """Generate AI preview for an email step using a sample user."""
    from ..marketing_engine import _build_user_context
    from ..openai_helper import generate_marketing_email
    from ..email_template import wrap_email

    steps = query("SELECT * FROM marketing_flow_steps WHERE id = %s", (step_id,))
    if not steps:
        return {"error": "Step not found"}

    step = steps[0]
    config = step.get("config") or {}
    if isinstance(config, str):
        config = json.loads(config)

    if step["step_type"] != "email":
        return {"error": "Only email steps can be previewed"}

    # Pick a sample user
    users = query("SELECT * FROM platform_users WHERE status = 'active' ORDER BY RANDOM() LIMIT 1")
    if not users:
        users = query("SELECT * FROM platform_users LIMIT 1")
    if not users:
        return {"error": "No users found for preview"}

    user = users[0]
    context = _build_user_context(user)
    result = generate_marketing_email(
        context,
        config.get("brief", ""),
        config.get("subject_hint", ""),
    )

    if not result:
        return {"error": "AI generation failed"}

    return {
        "subject": result["subject"],
        "body_html": result["body_html"],
        "template_html": wrap_email(result["body_html"]),
        "preview_user": {"name": user["name"], "clinic_name": user["clinic_name"]},
    }


@router.post("/flows/{flow_id}/reorder-steps")
def reorder_steps(flow_id: str, data: dict):
    """Reorder steps by providing an ordered list of step IDs."""
    step_ids = data.get("step_ids", [])
    for i, step_id in enumerate(step_ids):
        execute(
            "UPDATE marketing_flow_steps SET step_order = %s WHERE id = %s AND flow_id = %s",
            (i, step_id, flow_id),
        )
    return {"ok": True}


class CampaignPreviewRequest(BaseModel):
    segment_id: str
    brief: str
    subject_hint: str = ""


@router.post("/preview-campaign")
def preview_campaign(data: CampaignPreviewRequest):
    """Generate a preview for a campaign email using a sample user from the segment."""
    from ..marketing_engine import _build_user_context, query_segment_users
    from ..openai_helper import generate_marketing_email
    from ..email_template import wrap_email

    # Get segment
    segments = query("SELECT * FROM marketing_segments WHERE id = %s", (data.segment_id,))
    if not segments:
        return {"error": "Segment not found"}

    rules = segments[0].get("filter_rules") or {}
    if isinstance(rules, str):
        rules = json.loads(rules)

    users = query_segment_users(rules)
    if not users:
        return {"error": "No users in this segment"}

    # Pick sample user
    import random as rnd
    user = rnd.choice(users)
    context = _build_user_context(user)
    result = generate_marketing_email(context, data.brief, data.subject_hint)

    if not result:
        return {"error": "AI generation failed"}

    return {
        "subject": result["subject"],
        "body_html": result["body_html"],
        "template_html": wrap_email(result["body_html"]),
        "preview_user": {"name": user["name"], "clinic_name": user.get("clinic_name", "")},
        "segment_user_count": len(users),
    }


# ── Enrollments ──────────────────────────────────────────────────────

@router.post("/flows/{flow_id}/enroll")
def enroll_users(flow_id: str, data: EnrollRequest):
    """Manually enroll users in a flow."""
    from ..marketing_engine import _enroll_user
    count = 0
    for uid in data.user_ids:
        try:
            _enroll_user(flow_id, uid)
            count += 1
        except Exception:
            pass
    return {"ok": True, "enrolled": count}


@router.post("/enrollments/{enrollment_id}/cancel")
def cancel_enrollment(enrollment_id: str):
    """Cancel an enrollment."""
    execute(
        "UPDATE marketing_enrollments SET status = 'cancelled', next_action_at = NULL WHERE id = %s",
        (enrollment_id,),
    )
    return {"ok": True}


# ── Segments CRUD ────────────────────────────────────────────────────

@router.get("/segments")
def list_segments():
    """List all segments with user counts."""
    segments = query("SELECT * FROM marketing_segments ORDER BY is_preset DESC, name")
    # Refresh counts
    from ..marketing_engine import query_segment_users
    for seg in (segments or []):
        rules = seg.get("filter_rules") or {}
        if isinstance(rules, str):
            rules = json.loads(rules)
        users = query_segment_users(rules)
        seg["user_count"] = len(users)
    return segments or []


@router.get("/segments/{segment_id}")
def get_segment(segment_id: str):
    """Get segment with preview users."""
    segments = query("SELECT * FROM marketing_segments WHERE id = %s", (segment_id,))
    if not segments:
        return {"error": "Segment not found"}

    segment = segments[0]
    rules = segment.get("filter_rules") or {}
    if isinstance(rules, str):
        rules = json.loads(rules)

    from ..marketing_engine import query_segment_users
    users = query_segment_users(rules)
    segment["users"] = users[:50]  # Preview max 50
    segment["user_count"] = len(users)
    return segment


@router.post("/segments", status_code=201)
def create_segment(data: SegmentCreate):
    """Create a segment."""
    seg_id = gen_id("ms_")
    execute(
        """INSERT INTO marketing_segments (id, name, description, filter_rules)
           VALUES (%s, %s, %s, %s::jsonb)""",
        (seg_id, data.name, data.description, json.dumps(data.filter_rules)),
    )
    return {"id": seg_id}


@router.patch("/segments/{segment_id}")
def update_segment(segment_id: str, data: SegmentUpdate):
    """Update a segment."""
    updates = []
    params = []
    if data.name is not None:
        updates.append("name = %s")
        params.append(data.name)
    if data.description is not None:
        updates.append("description = %s")
        params.append(data.description)
    if data.filter_rules is not None:
        updates.append("filter_rules = %s::jsonb")
        params.append(json.dumps(data.filter_rules))

    if updates:
        updates.append("updated_at = NOW()")
        params.append(segment_id)
        execute(f"UPDATE marketing_segments SET {', '.join(updates)} WHERE id = %s", tuple(params))

    return {"ok": True}


@router.delete("/segments/{segment_id}")
def delete_segment(segment_id: str):
    """Delete a segment."""
    execute("DELETE FROM marketing_segments WHERE id = %s AND is_preset = false", (segment_id,))
    return {"ok": True}


# ── History ──────────────────────────────────────────────────────────

@router.get("/history")
def get_history(flow_id: str = "", limit: int = 50, offset: int = 0):
    """Get sent marketing emails."""
    sql = """
        SELECT mes.id, mes.user_id, mes.to_email, mes.subject, mes.brief,
               mes.gmail_message_id, mes.send_error, mes.campaign_batch, mes.sent_at,
               mes.flow_id, mes.step_id,
               pu.name as user_name, pu.clinic_name,
               mf.name as flow_name
        FROM marketing_emails_sent mes
        JOIN platform_users pu ON pu.id = mes.user_id
        LEFT JOIN marketing_flows mf ON mf.id = mes.flow_id
        WHERE 1=1
    """
    params: list = []
    if flow_id:
        sql += " AND mes.flow_id = %s"
        params.append(flow_id)
    sql += " ORDER BY mes.sent_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])
    return query(sql, tuple(params)) or []


# ── Campaign ─────────────────────────────────────────────────────────

@router.post("/send-campaign")
def send_campaign_route(data: CampaignRequest):
    """Send AI-personalized email to all users in a segment."""
    from ..marketing_engine import send_campaign
    result = send_campaign(data.segment_id, data.brief, data.subject_hint)
    return result


# ── Engine Status ────────────────────────────────────────────────────

@router.get("/engine-status")
def engine_status():
    """Check if the marketing engine is running."""
    from ..scheduler import _running
    pending = query(
        "SELECT COUNT(*) as cnt FROM marketing_enrollments WHERE status = 'active' AND next_action_at IS NOT NULL"
    )
    return {
        "running": _running,
        "pending_enrollments": pending[0]["cnt"] if pending else 0,
    }
