"""Onboarding & Retention Dashboard — Analytics API."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, gen_id

router = APIRouter()


class ContactRequest(BaseModel):
    user_id: str
    channel: str = "email"
    subject: str
    body: str
    assignee_id: Optional[str] = None


class GenerateDraftRequest(BaseModel):
    user_id: str
    feedback_id: Optional[str] = None
    prompt: str = ""


def _health_sql() -> str:
    """Computed health score SQL snippet (replaces static pu.health_score).
    Weighted formula: recency 35%, frequency 30%, satisfaction 20%, support 15%.
    Returns integer 0-100."""
    return """
    GREATEST(0, LEAST(100, (
        35 * GREATEST(0, LEAST(100,
            CASE WHEN pu.last_active_at IS NULL THEN 0
                 ELSE 100.0 - EXTRACT(EPOCH FROM (NOW() - pu.last_active_at)) / 86400 * 100.0 / 30
            END
        )) / 100.0 +
        30 * LEAST(100,
            (SELECT COUNT(*) FROM platform_consultations pc2
             WHERE pc2.user_id = pu.id
             AND pc2.consultation_date >= CURRENT_DATE - INTERVAL '30 days') * 100.0 / 9
        ) / 100.0 +
        20 * COALESCE(
            (SELECT LEAST(100, AVG(pr2.rating) * 10)
             FROM platform_reviews pr2 WHERE pr2.user_id = pu.id), 50
        ) / 100.0 +
        15 * GREATEST(0,
            100.0 - (SELECT COUNT(*) FROM tickets tk2
                   WHERE tk2.platform_user_id = pu.id
                   AND tk2.status IN ('open', 'in_progress')) * 33.0
        ) / 100.0
    )))::integer"""


def _health_breakdown_sql() -> dict[str, str]:
    """Individual health factor SQL snippets for detail view."""
    return {
        "recency": """GREATEST(0, LEAST(100,
            CASE WHEN pu.last_active_at IS NULL THEN 0
                 ELSE 100.0 - EXTRACT(EPOCH FROM (NOW() - pu.last_active_at)) / 86400 * 100.0 / 30
            END
        ))::integer""",
        "frequency": """LEAST(100,
            (SELECT COUNT(*) FROM platform_consultations pc2
             WHERE pc2.user_id = pu.id
             AND pc2.consultation_date >= CURRENT_DATE - INTERVAL '30 days') * 100.0 / 9
        )::integer""",
        "satisfaction": """COALESCE(
            (SELECT LEAST(100, AVG(pr2.rating) * 10)
             FROM platform_reviews pr2 WHERE pr2.user_id = pu.id), 50
        )::integer""",
        "support": """GREATEST(0,
            100.0 - (SELECT COUNT(*) FROM tickets tk2
                   WHERE tk2.platform_user_id = pu.id
                   AND tk2.status IN ('open', 'in_progress')) * 33.0
        )::integer""",
    }


@router.get("/overview")
def get_overview(period: int = 30):
    """Dashboard overview: KPIs, funnel, daily charts."""
    # KPIs
    total = query("SELECT COUNT(*) as cnt FROM platform_users")[0]["cnt"]
    active = query("SELECT COUNT(*) as cnt FROM platform_users WHERE status = 'active'")[0]["cnt"]
    inactive = query("SELECT COUNT(*) as cnt FROM platform_users WHERE status = 'inactive'")[0]["cnt"]
    churned = query("SELECT COUNT(*) as cnt FROM platform_users WHERE status = 'churned'")[0]["cnt"]
    onboarding = query("SELECT COUNT(*) as cnt FROM platform_users WHERE status = 'onboarding'")[0]["cnt"]

    new_period = query(
        "SELECT COUNT(*) as cnt FROM platform_users WHERE signup_at >= NOW() - %s * INTERVAL '1 day'",
        (period,),
    )[0]["cnt"]

    churned_period = query(
        "SELECT COUNT(*) as cnt FROM platform_users WHERE churned_at >= NOW() - %s * INTERVAL '1 day'",
        (period,),
    )[0]["cnt"]

    clinics = query("SELECT COUNT(DISTINCT clinic_name) as cnt FROM platform_users")[0]["cnt"]

    # Average time-to-value (days from signup to first consultation)
    ttv = query("""
        SELECT AVG(EXTRACT(EPOCH FROM (first_consultation_at - signup_at)) / 86400) as avg_days
        FROM platform_users
        WHERE first_consultation_at IS NOT NULL
    """)
    avg_ttv = round(float(ttv[0]["avg_days"] or 0), 1)

    # MRR at risk
    mrr_at_risk = query(
        "SELECT COALESCE(SUM(mrr), 0) as total FROM platform_users WHERE status = 'inactive'"
    )[0]["total"]

    # Net retention (active / (total - onboarding))
    base = total - onboarding
    nrr = round((active / base * 100) if base > 0 else 100, 1)

    # Funnel data
    funnel_stages = [
        ("signup", "MitID Signup"),
        ("mitid_verified", "MitID verificeret"),
        ("email_verified", "Email verificeret"),
        ("speciale_set", "Speciale valgt"),
        ("clinic_created", "Klinik oprettet"),
        ("first_consultation", "1. konsultation"),
        ("second_consultation", "2. konsultation"),
    ]
    funnel = []
    for event_type, label in funnel_stages:
        row = query(
            "SELECT COUNT(DISTINCT user_id) as cnt FROM platform_events WHERE event_type = %s",
            (event_type,),
        )
        funnel.append({"stage": event_type, "label": label, "count": row[0]["cnt"]})

    # Daily onboarded (last 14 days)
    daily_signups = query("""
        SELECT DATE(signup_at) as date, COUNT(*) as count
        FROM platform_users
        WHERE signup_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(signup_at)
        ORDER BY date
    """)

    # Daily consultations (last 14 days)
    daily_consults = query("""
        SELECT consultation_date as date, COUNT(*) as count
        FROM platform_consultations
        WHERE consultation_date >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY consultation_date
        ORDER BY consultation_date
    """)

    return {
        "kpis": {
            "total_users": total,
            "active_users": active,
            "inactive_users": inactive,
            "churned_users": churned,
            "onboarding_users": onboarding,
            "new_this_period": new_period,
            "churned_this_period": churned_period,
            "total_clinics": clinics,
            "avg_time_to_value": avg_ttv,
            "mrr_at_risk": float(mrr_at_risk),
            "net_retention_rate": nrr,
        },
        "funnel": funnel,
        "daily_signups": [{"date": str(r["date"]), "count": r["count"]} for r in daily_signups],
        "daily_consultations": [{"date": str(r["date"]), "count": r["count"]} for r in daily_consults],
    }


@router.get("/users")
def get_users(status: Optional[str] = None, search: Optional[str] = None):
    """List platform users with computed fields."""
    conditions = []
    params = []

    if status and status != "all":
        conditions.append("pu.status = %s")
        params.append(status)

    if search:
        conditions.append("(pu.name ILIKE %s OR pu.clinic_name ILIKE %s OR pu.email ILIKE %s)")
        s = f"%{search}%"
        params.extend([s, s, s])

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    health = _health_sql()
    rows = query(f"""
        SELECT pu.*,
            ({health}) as health_score,
            EXTRACT(EPOCH FROM (NOW() - pu.signup_at)) / 86400 as days_since_signup,
            (SELECT COUNT(*) FROM platform_consultations pc WHERE pc.user_id = pu.id) as consultation_count,
            (SELECT ROUND(AVG(pc.rating)::numeric, 1) FROM platform_consultations pc WHERE pc.user_id = pu.id) as avg_rating,
            (SELECT COUNT(*) FROM platform_reviews pr WHERE pr.user_id = pu.id) as review_count,
            (SELECT pr.comment FROM platform_reviews pr WHERE pr.user_id = pu.id
             AND pr.sentiment = 'kritisk' ORDER BY pr.created_at DESC LIMIT 1) as latest_issue,
            (SELECT COUNT(*) FROM tickets tk WHERE tk.platform_user_id = pu.id) as ticket_count,
            (SELECT COUNT(*) FROM tickets tk WHERE tk.platform_user_id = pu.id AND tk.status IN ('open', 'in_progress')) as open_ticket_count
        FROM platform_users pu
        {where}
        ORDER BY pu.signup_at DESC
    """, tuple(params) if params else None)

    return [{
        **r,
        "days_since_signup": round(float(r["days_since_signup"] or 0)),
        "avg_rating": float(r["avg_rating"]) if r["avg_rating"] else None,
        "mrr": float(r["mrr"]),
    } for r in rows]


@router.get("/feedback")
def get_feedback(period: int = 30):
    """Feedback analytics: ratings, NPS, themes, recent reviews."""
    # Rating distribution (1-10 in buckets)
    dist = query("""
        SELECT
            CASE
                WHEN rating >= 9 THEN '9-10'
                WHEN rating >= 7 THEN '7-8'
                WHEN rating >= 5 THEN '5-6'
                WHEN rating >= 3 THEN '3-4'
                ELSE '1-2'
            END as bucket,
            COUNT(*) as count
        FROM platform_reviews
        WHERE created_at >= NOW() - %s * INTERVAL '1 day'
        GROUP BY bucket
        ORDER BY bucket DESC
    """, (period,))

    # Average rating
    avg = query(
        "SELECT AVG(rating) as avg, COUNT(*) as cnt FROM platform_reviews WHERE created_at >= NOW() - %s * INTERVAL '1 day'",
        (period,),
    )
    avg_rating = round(float(avg[0]["avg"] or 0), 1)
    review_count = avg[0]["cnt"]

    # NPS (estimated from ratings: 9-10=promoter, 7-8=passive, 1-6=detractor)
    nps_data = query("""
        SELECT
            COUNT(*) FILTER (WHERE rating >= 9) as promoters,
            COUNT(*) FILTER (WHERE rating >= 7 AND rating < 9) as passives,
            COUNT(*) FILTER (WHERE rating < 7) as detractors,
            COUNT(*) as total
        FROM platform_reviews
        WHERE created_at >= NOW() - %s * INTERVAL '1 day'
    """, (period,))
    nd = nps_data[0]
    total_nps = nd["total"] or 1
    nps_score = round(((nd["promoters"] - nd["detractors"]) / total_nps) * 100)

    # Sentiment breakdown
    sentiments = query("""
        SELECT sentiment, COUNT(*) as count
        FROM platform_reviews
        WHERE created_at >= NOW() - %s * INTERVAL '1 day'
        GROUP BY sentiment
        ORDER BY count DESC
    """, (period,))

    # Top feedback themes (from comments — keyword frequency)
    themes = query("""
        SELECT comment, COUNT(*) as count
        FROM platform_reviews
        WHERE created_at >= NOW() - %s * INTERVAL '1 day' AND comment != ''
        GROUP BY comment
        ORDER BY count DESC
        LIMIT 10
    """, (period,))

    # Recent reviews
    recent = query("""
        SELECT pr.*, pu.name as user_name, pu.clinic_name
        FROM platform_reviews pr
        JOIN platform_users pu ON pr.user_id = pu.id
        ORDER BY pr.created_at DESC
        LIMIT 15
    """)

    return {
        "avg_rating": avg_rating,
        "review_count": review_count,
        "nps_score": nps_score,
        "nps_breakdown": {
            "promoters": nd["promoters"],
            "passives": nd["passives"],
            "detractors": nd["detractors"],
        },
        "rating_distribution": [{"bucket": r["bucket"], "count": r["count"]} for r in dist],
        "sentiments": [{"sentiment": r["sentiment"], "count": r["count"]} for r in sentiments],
        "top_themes": [{"theme": r["comment"], "count": r["count"]} for r in themes],
        "recent_reviews": [{
            **r,
            "rating": float(r["rating"]),
        } for r in recent],
    }


@router.get("/churn")
def get_churn(period: int = 90):
    """Churn analytics: rates, reasons, timing, at-risk users."""
    # Churn rate
    total_base = query(
        "SELECT COUNT(*) as cnt FROM platform_users WHERE status != 'onboarding'"
    )[0]["cnt"]
    churned_period = query(
        "SELECT COUNT(*) as cnt FROM platform_users WHERE churned_at >= NOW() - %s * INTERVAL '1 day'",
        (period,),
    )[0]["cnt"]
    churn_rate = round((churned_period / total_base * 100) if total_base > 0 else 0, 1)

    # Average lifetime before churn
    avg_lifetime = query("""
        SELECT AVG(EXTRACT(EPOCH FROM (churned_at - signup_at)) / 86400) as avg_days
        FROM platform_users WHERE status = 'churned' AND churned_at IS NOT NULL
    """)
    avg_days = round(float(avg_lifetime[0]["avg_days"] or 0))

    # At-risk count & MRR
    at_risk = query(
        "SELECT COUNT(*) as cnt, COALESCE(SUM(mrr), 0) as mrr FROM platform_users WHERE status = 'inactive'"
    )[0]

    # Churn reasons
    reasons = query("""
        SELECT churn_reason, COUNT(*) as count
        FROM platform_users
        WHERE status = 'churned' AND churn_reason IS NOT NULL
        GROUP BY churn_reason
        ORDER BY count DESC
    """)

    reason_labels = {
        "technical": "Tekniske problemer (lyd/mikrofon)",
        "price": "Manglende værdi / kvalitet",
        "complexity": "For komplekst / manglende tid",
        "competitor": "Skiftet til konkurrent",
        "no_need": "Ukendt / ingen feedback",
    }

    # Churn timing (weeks after signup)
    timing = query("""
        SELECT
            CASE
                WHEN EXTRACT(EPOCH FROM (churned_at - signup_at)) / 86400 <= 7 THEN 'Uge 1'
                WHEN EXTRACT(EPOCH FROM (churned_at - signup_at)) / 86400 <= 14 THEN 'Uge 2'
                WHEN EXTRACT(EPOCH FROM (churned_at - signup_at)) / 86400 <= 21 THEN 'Uge 3'
                WHEN EXTRACT(EPOCH FROM (churned_at - signup_at)) / 86400 <= 28 THEN 'Uge 4'
                ELSE 'Uge 5+'
            END as week,
            COUNT(*) as count
        FROM platform_users
        WHERE status = 'churned' AND churned_at IS NOT NULL
        GROUP BY week
        ORDER BY week
    """)

    # Top at-risk users (sorted by computed health)
    health = _health_sql()
    at_risk_users = query(f"""
        SELECT pu.*,
            ({health}) as health_score,
            EXTRACT(EPOCH FROM (NOW() - pu.last_active_at)) / 86400 as days_inactive,
            (SELECT COUNT(*) FROM platform_consultations pc WHERE pc.user_id = pu.id) as consultation_count,
            (SELECT ROUND(AVG(pc.rating)::numeric, 1) FROM platform_consultations pc WHERE pc.user_id = pu.id) as avg_rating
        FROM platform_users pu
        WHERE pu.status = 'inactive'
        ORDER BY ({health}) ASC
        LIMIT 10
    """)

    return {
        "churn_rate": churn_rate,
        "avg_lifetime_days": avg_days,
        "at_risk_count": at_risk["cnt"],
        "at_risk_mrr": float(at_risk["mrr"]),
        "churn_reasons": [{
            "reason": r["churn_reason"],
            "label": reason_labels.get(r["churn_reason"], r["churn_reason"]),
            "count": r["count"],
        } for r in reasons],
        "churn_timing": [{"week": r["week"], "count": r["count"]} for r in timing],
        "at_risk_users": [{
            **r,
            "days_inactive": round(float(r["days_inactive"] or 0)),
            "avg_rating": float(r["avg_rating"]) if r["avg_rating"] else None,
            "mrr": float(r["mrr"]),
        } for r in at_risk_users],
    }


@router.post("/contact")
def contact_user(data: ContactRequest):
    """Create an outbound ticket + first message from the dashboard."""
    # Look up the platform user
    users = query("SELECT id, name, email FROM platform_users WHERE id = %s", (data.user_id,))
    if not users:
        return {"error": "Bruger ikke fundet"}
    user = users[0]

    source = "outbound_email" if data.channel == "email" else "outbound_message"

    # Create ticket linked to platform user
    ticket_id = gen_id("tk_")
    ticket = query(
        """INSERT INTO tickets (id, subject, description, status, priority, category,
           source, requester_name, requester_email, assignee_id, platform_user_id)
           VALUES (%s, %s, %s, 'open', 'medium', 'onboarding', %s, %s, %s, %s, %s)
           RETURNING *""",
        (ticket_id, data.subject, data.body, source, user["name"], user["email"],
         data.assignee_id, data.user_id),
    )

    # Create first message
    msg_id = gen_id("msg_")
    query(
        """INSERT INTO ticket_messages (id, ticket_id, sender_type, sender_name, sender_email, body, is_internal)
           VALUES (%s, %s, 'agent', 'CS Team', '', %s, false)
           RETURNING *""",
        (msg_id, ticket_id, data.body),
    )

    return {"ok": True, "ticket_id": ticket_id, "ticket": ticket[0] if ticket else None}


@router.get("/users/{user_id}/tickets")
def get_user_tickets(user_id: str):
    """Get all tickets for a specific platform user."""
    tickets = query(
        """SELECT t.*, tm.name as assignee_name
           FROM tickets t
           LEFT JOIN team_members tm ON t.assignee_id = tm.id
           WHERE t.platform_user_id = %s
           ORDER BY t.created_at DESC""",
        (user_id,),
    )
    return tickets


@router.post("/generate-draft")
def generate_draft(data: GenerateDraftRequest):
    """Generate an AI contact draft using full user context, feedback, and tickets."""
    from ..openai_helper import generate_contact_draft, is_configured

    if not is_configured():
        return {"error": "OpenAI API-nøgle ikke konfigureret"}

    # Fetch user with computed health
    health = _health_sql()
    users = query(f"""
        SELECT pu.*,
            ({health}) as health_score,
            EXTRACT(EPOCH FROM (NOW() - pu.signup_at)) / 86400 as days_since_signup,
            (SELECT COUNT(*) FROM platform_consultations pc WHERE pc.user_id = pu.id) as consultation_count,
            (SELECT ROUND(AVG(pc.rating)::numeric, 1) FROM platform_consultations pc WHERE pc.user_id = pu.id) as avg_rating,
            (SELECT COUNT(*) FROM platform_reviews pr WHERE pr.user_id = pu.id) as review_count
        FROM platform_users pu
        WHERE pu.id = %s
    """, (data.user_id,))

    if not users:
        return {"error": "Bruger ikke fundet"}
    user = users[0]

    user_context = {
        "name": user["name"],
        "email": user["email"],
        "clinic_name": user["clinic_name"],
        "speciale": user.get("speciale", ""),
        "status": user["status"],
        "plan": user.get("plan", ""),
        "health_score": user.get("health_score", 0),
        "consultation_count": user["consultation_count"],
        "avg_rating": float(user["avg_rating"]) if user["avg_rating"] else None,
        "days_since_signup": round(float(user["days_since_signup"] or 0)),
        "last_active_at": str(user.get("last_active_at", "")) if user.get("last_active_at") else None,
    }

    # Fetch recent feedback
    feedback = query("""
        SELECT id, rating, comment, sentiment, created_at
        FROM platform_reviews
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 10
    """, (data.user_id,))
    feedback_list = [{
        "id": f["id"],
        "rating": float(f["rating"]),
        "comment": f["comment"],
        "sentiment": f["sentiment"],
        "created_at": str(f["created_at"]),
    } for f in feedback]

    # Fetch recent tickets
    tickets = query("""
        SELECT id, subject, status, created_at
        FROM tickets
        WHERE platform_user_id = %s
        ORDER BY created_at DESC
        LIMIT 5
    """, (data.user_id,))
    tickets_list = [{
        "id": t["id"],
        "subject": t["subject"],
        "status": t["status"],
        "created_at": str(t["created_at"]),
    } for t in tickets]

    # Fetch specific feedback if feedback_id provided
    target_feedback = None
    if data.feedback_id:
        target = query(
            "SELECT id, rating, comment, sentiment, created_at FROM platform_reviews WHERE id = %s",
            (data.feedback_id,),
        )
        if target:
            t = target[0]
            target_feedback = {
                "id": t["id"],
                "rating": float(t["rating"]),
                "comment": t["comment"],
                "sentiment": t["sentiment"],
                "created_at": str(t["created_at"]),
            }

    result = generate_contact_draft(
        user_context=user_context,
        feedback=feedback_list,
        tickets=tickets_list,
        prompt=data.prompt,
        target_feedback=target_feedback,
    )

    if result:
        return result
    return {"error": "Kunne ikke generere udkast — prøv igen"}


@router.get("/signals")
def get_signals():
    """Actionable signals for CS team — things that need attention now."""
    signals = []

    # 1. Declining activity: active users not seen in 10+ days
    declining = query("""
        SELECT id, name, clinic_name, last_active_at,
            EXTRACT(EPOCH FROM (NOW() - last_active_at)) / 86400 as days_inactive
        FROM platform_users
        WHERE status = 'active'
          AND last_active_at < NOW() - INTERVAL '10 days'
        ORDER BY last_active_at ASC
        LIMIT 5
    """)
    for u in declining:
        days = round(float(u["days_inactive"] or 0))
        signals.append({
            "type": "declining_activity",
            "severity": "high" if days > 20 else "medium",
            "user_id": u["id"],
            "user_name": u["name"],
            "clinic_name": u["clinic_name"],
            "message": f"Aktivitet faldende: {days} dage siden sidst aktiv",
            "created_at": str(u["last_active_at"] or ""),
        })

    # 2. Stuck onboarding: signup 7+ days ago, no consultation
    stuck = query("""
        SELECT id, name, clinic_name, signup_at,
            EXTRACT(EPOCH FROM (NOW() - signup_at)) / 86400 as days_since_signup
        FROM platform_users
        WHERE status = 'onboarding'
          AND first_consultation_at IS NULL
          AND signup_at < NOW() - INTERVAL '7 days'
        ORDER BY signup_at ASC
        LIMIT 5
    """)
    for u in stuck:
        days = round(float(u["days_since_signup"] or 0))
        signals.append({
            "type": "stuck_onboarding",
            "severity": "high" if days > 14 else "medium",
            "user_id": u["id"],
            "user_name": u["name"],
            "clinic_name": u["clinic_name"],
            "message": f"Stuck i onboarding: {days} dage uden konsultation",
            "created_at": str(u["signup_at"] or ""),
        })

    # 3. Negative feedback: kritisk reviews in last 14 days without follow-up ticket
    neg_feedback = query("""
        SELECT pr.id as review_id, pr.comment, pr.rating, pr.created_at,
            pu.id as user_id, pu.name as user_name, pu.clinic_name
        FROM platform_reviews pr
        JOIN platform_users pu ON pr.user_id = pu.id
        WHERE pr.sentiment = 'kritisk'
          AND pr.created_at >= NOW() - INTERVAL '14 days'
          AND NOT EXISTS (
              SELECT 1 FROM tickets tk
              WHERE tk.platform_user_id = pu.id
              AND tk.created_at >= pr.created_at
          )
        ORDER BY pr.created_at DESC
        LIMIT 5
    """)
    for r in neg_feedback:
        snippet = r["comment"][:50] + "..." if len(r["comment"] or "") > 50 else r["comment"]
        signals.append({
            "type": "negative_feedback",
            "severity": "high",
            "user_id": r["user_id"],
            "user_name": r["user_name"],
            "clinic_name": r["clinic_name"],
            "message": f"Kritisk feedback: \"{snippet}\"",
            "created_at": str(r["created_at"]),
            "feedback_id": r["review_id"],
        })

    # 4. Critical health: users with very low computed health
    health = _health_sql()
    critical = query(f"""
        SELECT pu.id, pu.name, pu.clinic_name,
            ({health}) as health_score
        FROM platform_users pu
        WHERE pu.status IN ('active', 'onboarding', 'inactive')
          AND ({health}) < 30
        ORDER BY ({health}) ASC
        LIMIT 5
    """)
    for u in critical:
        signals.append({
            "type": "critical_health",
            "severity": "high",
            "user_id": u["id"],
            "user_name": u["name"],
            "clinic_name": u["clinic_name"],
            "message": f"Kritisk health score: {u['health_score']}/100",
            "created_at": "",
        })

    # Sort: high severity first, then by type priority
    type_order = {"negative_feedback": 0, "critical_health": 1, "declining_activity": 2, "stuck_onboarding": 3}
    signals.sort(key=lambda s: (0 if s["severity"] == "high" else 1, type_order.get(s["type"], 9)))

    # Filter out dismissed signals
    dismissed = query("SELECT signal_type, user_id FROM dismissed_signals")
    dismissed_set = {(d["signal_type"], d["user_id"]) for d in dismissed}
    signals = [s for s in signals if (s["type"], s["user_id"]) not in dismissed_set]

    return signals


@router.post("/signals/{signal_type}/{user_id}/dismiss")
def dismiss_signal(signal_type: str, user_id: str):
    """Dismiss a signal so it no longer appears."""
    existing = query("SELECT id FROM dismissed_signals WHERE signal_type = %s AND user_id = %s", (signal_type, user_id))
    if not existing:
        execute(
            "INSERT INTO dismissed_signals (id, signal_type, user_id) VALUES (%s, %s, %s)",
            (gen_id("ds_"), signal_type, user_id)
        )
    return {"ok": True}


@router.post("/signals/{signal_type}/{user_id}/restore")
def restore_signal(signal_type: str, user_id: str):
    """Restore a previously dismissed signal."""
    execute("DELETE FROM dismissed_signals WHERE signal_type = %s AND user_id = %s", (signal_type, user_id))
    return {"ok": True}


@router.get("/users/{user_id}/detail")
def get_user_detail(user_id: str):
    """Full user profile with health breakdown, activity, feedback, tickets, and comms log."""
    health = _health_sql()
    bd = _health_breakdown_sql()

    users = query(f"""
        SELECT pu.*,
            ({health}) as health_score,
            ({bd['recency']}) as health_recency,
            ({bd['frequency']}) as health_frequency,
            ({bd['satisfaction']}) as health_satisfaction,
            ({bd['support']}) as health_support,
            EXTRACT(EPOCH FROM (NOW() - pu.signup_at)) / 86400 as days_since_signup,
            (SELECT COUNT(*) FROM platform_consultations pc WHERE pc.user_id = pu.id) as consultation_count,
            (SELECT ROUND(AVG(pc.rating)::numeric, 1) FROM platform_consultations pc WHERE pc.user_id = pu.id) as avg_rating,
            (SELECT COUNT(*) FROM platform_reviews pr WHERE pr.user_id = pu.id) as review_count,
            (SELECT pr.comment FROM platform_reviews pr WHERE pr.user_id = pu.id
             AND pr.sentiment = 'kritisk' ORDER BY pr.created_at DESC LIMIT 1) as latest_issue,
            (SELECT COUNT(*) FROM tickets tk WHERE tk.platform_user_id = pu.id) as ticket_count,
            (SELECT COUNT(*) FROM tickets tk WHERE tk.platform_user_id = pu.id AND tk.status IN ('open', 'in_progress')) as open_ticket_count
        FROM platform_users pu
        WHERE pu.id = %s
    """, (user_id,))

    if not users:
        return {"error": "Bruger ikke fundet"}

    user = users[0]

    # Profile with health breakdown
    profile = {
        **user,
        "days_since_signup": round(float(user["days_since_signup"] or 0)),
        "avg_rating": float(user["avg_rating"]) if user["avg_rating"] else None,
        "mrr": float(user["mrr"]),
        "health_breakdown": {
            "total": user["health_score"],
            "recency": user["health_recency"],
            "frequency": user["health_frequency"],
            "satisfaction": user["health_satisfaction"],
            "support": user["health_support"],
        },
    }

    # Last 20 consultations
    consultations = query("""
        SELECT consultation_date as date, duration_minutes, rating
        FROM platform_consultations
        WHERE user_id = %s
        ORDER BY consultation_date DESC
        LIMIT 20
    """, (user_id,))
    consultations = [{
        "date": str(c["date"]),
        "duration_minutes": c["duration_minutes"],
        "rating": float(c["rating"]) if c["rating"] else None,
    } for c in consultations]

    # Weekly consultation counts (last 8 weeks)
    weekly = query("""
        SELECT DATE_TRUNC('week', consultation_date)::date as week, COUNT(*) as count
        FROM platform_consultations
        WHERE user_id = %s
          AND consultation_date >= CURRENT_DATE - INTERVAL '8 weeks'
        GROUP BY DATE_TRUNC('week', consultation_date)
        ORDER BY week
    """, (user_id,))
    weekly_consultations = [{"week": str(w["week"]), "count": w["count"]} for w in weekly]

    # All reviews
    reviews = query("""
        SELECT id, rating, comment, sentiment, created_at
        FROM platform_reviews
        WHERE user_id = %s
        ORDER BY created_at DESC
    """, (user_id,))
    reviews = [{
        "id": r["id"],
        "rating": float(r["rating"]),
        "comment": r["comment"],
        "sentiment": r["sentiment"],
        "created_at": str(r["created_at"]),
    } for r in reviews]

    # All tickets
    tickets = query("""
        SELECT t.*, tm.name as assignee_name
        FROM tickets t
        LEFT JOIN team_members tm ON t.assignee_id = tm.id
        WHERE t.platform_user_id = %s
        ORDER BY t.created_at DESC
    """, (user_id,))

    # Onboarding events
    events = query("""
        SELECT event_type, created_at
        FROM platform_events
        WHERE user_id = %s
        ORDER BY created_at ASC
    """, (user_id,))
    events = [{"event_type": e["event_type"], "created_at": str(e["created_at"])} for e in events]

    # Communication log (ticket messages sent by agents to this user)
    comms = query("""
        SELECT tm.id, t.subject as ticket_subject, tm.body, tm.sender_name, tm.created_at
        FROM ticket_messages tm
        JOIN tickets t ON tm.ticket_id = t.id
        WHERE t.platform_user_id = %s
          AND tm.sender_type = 'agent'
        ORDER BY tm.created_at DESC
        LIMIT 20
    """, (user_id,))
    communication_log = [{
        "id": c["id"],
        "ticket_subject": c["ticket_subject"],
        "body": c["body"],
        "sender_name": c["sender_name"],
        "created_at": str(c["created_at"]),
    } for c in comms]

    return {
        "profile": profile,
        "consultations": consultations,
        "weekly_consultations": weekly_consultations,
        "reviews": reviews,
        "tickets": tickets,
        "events": events,
        "communication_log": communication_log,
    }
