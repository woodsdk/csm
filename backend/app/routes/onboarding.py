"""Onboarding & Retention Dashboard — Analytics API."""

from fastapi import APIRouter
from typing import Optional
from ..database import query

router = APIRouter()


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
        "SELECT COUNT(*) as cnt FROM platform_users WHERE signup_at >= NOW() - INTERVAL '%s days'",
        (period,),
    )[0]["cnt"]

    churned_period = query(
        "SELECT COUNT(*) as cnt FROM platform_users WHERE churned_at >= NOW() - INTERVAL '%s days'",
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

    rows = query(f"""
        SELECT pu.*,
            EXTRACT(EPOCH FROM (NOW() - pu.signup_at)) / 86400 as days_since_signup,
            (SELECT COUNT(*) FROM platform_consultations pc WHERE pc.user_id = pu.id) as consultation_count,
            (SELECT ROUND(AVG(pc.rating)::numeric, 1) FROM platform_consultations pc WHERE pc.user_id = pu.id) as avg_rating,
            (SELECT COUNT(*) FROM platform_reviews pr WHERE pr.user_id = pu.id) as review_count,
            (SELECT pr.comment FROM platform_reviews pr WHERE pr.user_id = pu.id
             AND pr.sentiment = 'kritisk' ORDER BY pr.created_at DESC LIMIT 1) as latest_issue
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
        WHERE created_at >= NOW() - INTERVAL '%s days'
        GROUP BY bucket
        ORDER BY bucket DESC
    """, (period,))

    # Average rating
    avg = query(
        "SELECT AVG(rating) as avg, COUNT(*) as cnt FROM platform_reviews WHERE created_at >= NOW() - INTERVAL '%s days'",
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
        WHERE created_at >= NOW() - INTERVAL '%s days'
    """, (period,))
    nd = nps_data[0]
    total_nps = nd["total"] or 1
    nps_score = round(((nd["promoters"] - nd["detractors"]) / total_nps) * 100)

    # Sentiment breakdown
    sentiments = query("""
        SELECT sentiment, COUNT(*) as count
        FROM platform_reviews
        WHERE created_at >= NOW() - INTERVAL '%s days'
        GROUP BY sentiment
        ORDER BY count DESC
    """, (period,))

    # Top feedback themes (from comments — keyword frequency)
    themes = query("""
        SELECT comment, COUNT(*) as count
        FROM platform_reviews
        WHERE created_at >= NOW() - INTERVAL '%s days' AND comment != ''
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
        "SELECT COUNT(*) as cnt FROM platform_users WHERE churned_at >= NOW() - INTERVAL '%s days'",
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

    # Top at-risk users
    at_risk_users = query("""
        SELECT pu.*,
            EXTRACT(EPOCH FROM (NOW() - pu.last_active_at)) / 86400 as days_inactive,
            (SELECT COUNT(*) FROM platform_consultations pc WHERE pc.user_id = pu.id) as consultation_count,
            (SELECT ROUND(AVG(pc.rating)::numeric, 1) FROM platform_consultations pc WHERE pc.user_id = pu.id) as avg_rating
        FROM platform_users pu
        WHERE pu.status = 'inactive'
        ORDER BY pu.health_score ASC
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
