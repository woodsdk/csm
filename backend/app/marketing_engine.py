"""Marketing Engine — Trigger detection, step processing, AI email generation."""

import json
import logging
from datetime import datetime, timedelta
from .database import query, execute, gen_id

logger = logging.getLogger(__name__)


# ── User Context Builder ─────────────────────────────────────────────

def _build_user_context(user: dict) -> dict:
    """Build rich user context for AI email generation."""
    uid = user["id"]

    # Consultation stats
    consult_stats = query(
        """SELECT COUNT(*) as cnt, ROUND(AVG(rating)::numeric, 1) as avg_rating
           FROM platform_consultations WHERE user_id = %s""",
        (uid,),
    )
    stats = consult_stats[0] if consult_stats else {"cnt": 0, "avg_rating": None}

    # Latest feedback
    latest_review = query(
        """SELECT rating, comment, sentiment, created_at FROM platform_reviews
           WHERE user_id = %s ORDER BY created_at DESC LIMIT 1""",
        (uid,),
    )
    feedback_str = "Ingen"
    if latest_review:
        r = latest_review[0]
        feedback_str = f"Rating {r['rating']}, {r['sentiment']}: \"{r['comment'][:80]}\""

    # Onboarding stages
    events = query(
        "SELECT event_type FROM platform_events WHERE user_id = %s ORDER BY created_at",
        (uid,),
    )
    stages = [e["event_type"] for e in events] if events else []

    # Days since signup
    days_since = 0
    if user.get("signup_at"):
        try:
            signup = user["signup_at"] if isinstance(user["signup_at"], datetime) else datetime.fromisoformat(str(user["signup_at"]))
            days_since = (datetime.now(signup.tzinfo) - signup).days
        except Exception:
            pass

    return {
        "name": user.get("name", ""),
        "clinic_name": user.get("clinic_name", ""),
        "speciale": user.get("speciale", ""),
        "status": user.get("status", ""),
        "plan": user.get("plan", ""),
        "health_score": user.get("health_score", "N/A"),
        "consultation_count": stats["cnt"],
        "avg_rating": stats["avg_rating"] or "N/A",
        "days_since_signup": days_since,
        "last_active_at": str(user.get("last_active_at", ""))[:10] or "Ukendt",
        "latest_feedback": feedback_str,
        "onboarding_stages": ", ".join(stages) if stages else "Ingen",
    }


# ── Trigger Detection ─────────────────────────────────────────────────

def detect_triggers():
    """Scan for users matching active flow triggers and enroll them."""
    active_flows = query(
        "SELECT * FROM marketing_flows WHERE status = 'active' AND trigger_type != 'manual'"
    )
    if not active_flows:
        return

    for flow in active_flows:
        trigger = flow["trigger_type"]
        config = flow.get("trigger_config") or {}
        if isinstance(config, str):
            config = json.loads(config)

        users = _find_trigger_matches(trigger, config)
        for user in users:
            _enroll_user(flow["id"], user["id"])


def _find_trigger_matches(trigger: str, config: dict) -> list:
    """Find users matching a specific trigger type."""
    if trigger == "signup":
        return query("""
            SELECT * FROM platform_users
            WHERE created_at > NOW() - INTERVAL '48 hours'
            AND status IN ('onboarding', 'active')
        """)

    elif trigger == "inactive_14d":
        return query("""
            SELECT * FROM platform_users
            WHERE status = 'active'
            AND last_active_at < NOW() - INTERVAL '14 days'
            AND last_active_at IS NOT NULL
        """)

    elif trigger == "inactive_30d":
        return query("""
            SELECT * FROM platform_users
            WHERE status IN ('active', 'inactive')
            AND last_active_at < NOW() - INTERVAL '30 days'
            AND last_active_at IS NOT NULL
        """)

    elif trigger == "negative_feedback":
        return query("""
            SELECT DISTINCT pu.* FROM platform_users pu
            JOIN platform_reviews pr ON pr.user_id = pu.id
            WHERE pr.sentiment = 'kritisk'
            AND pr.created_at > NOW() - INTERVAL '48 hours'
            AND pu.status != 'churned'
        """)

    elif trigger == "stuck_onboarding":
        return query("""
            SELECT * FROM platform_users
            WHERE status = 'onboarding'
            AND first_consultation_at IS NULL
            AND signup_at < NOW() - INTERVAL '7 days'
        """)

    elif trigger == "health_drop":
        threshold = config.get("threshold", 30)
        return query(
            """SELECT * FROM platform_users
               WHERE status IN ('active', 'inactive')
               AND health_score <= %s""",
            (threshold,),
        )

    return []


def _enroll_user(flow_id: str, user_id: str):
    """Enroll a user in a flow if not already enrolled."""
    existing = query(
        "SELECT id FROM marketing_enrollments WHERE flow_id = %s AND user_id = %s",
        (flow_id, user_id),
    )
    if existing:
        return  # Already enrolled

    enrollment_id = gen_id("me_")
    execute(
        """INSERT INTO marketing_enrollments (id, flow_id, user_id, current_step, status, next_action_at)
           VALUES (%s, %s, %s, 0, 'active', NOW())""",
        (enrollment_id, flow_id, user_id),
    )
    logger.info(f"Enrolled user {user_id} in flow {flow_id}")


# ── Step Processor ────────────────────────────────────────────────────

def process_pending_steps():
    """Process enrollments where next_action_at <= NOW()."""
    pending = query("""
        SELECT me.*, mf.name as flow_name
        FROM marketing_enrollments me
        JOIN marketing_flows mf ON mf.id = me.flow_id
        WHERE me.status = 'active'
        AND me.next_action_at IS NOT NULL
        AND me.next_action_at <= NOW()
        ORDER BY me.next_action_at ASC
        LIMIT 20
    """)

    if not pending:
        return

    for enrollment in pending:
        try:
            _process_enrollment(enrollment)
        except Exception as e:
            logger.error(f"Error processing enrollment {enrollment['id']}: {e}")


def _process_enrollment(enrollment: dict):
    """Process a single enrollment's current step."""
    flow_id = enrollment["flow_id"]
    current_step = enrollment["current_step"]

    # Get the current step
    steps = query(
        """SELECT * FROM marketing_flow_steps
           WHERE flow_id = %s AND step_order = %s""",
        (flow_id, current_step),
    )

    if not steps:
        # No more steps — mark as completed
        execute(
            """UPDATE marketing_enrollments
               SET status = 'completed', completed_at = NOW(), next_action_at = NULL
               WHERE id = %s""",
            (enrollment["id"],),
        )
        return

    step = steps[0]
    config = step.get("config") or {}
    if isinstance(config, str):
        config = json.loads(config)

    step_type = step["step_type"]

    if step_type == "email":
        _execute_email_step(enrollment, step, config)
    elif step_type == "wait":
        _execute_wait_step(enrollment, step, config)
    elif step_type == "condition":
        _execute_condition_step(enrollment, step, config)

    # Advance to next step (unless wait set its own next_action_at)
    if step_type != "wait":
        _advance_enrollment(enrollment)


def _execute_email_step(enrollment: dict, step: dict, config: dict):
    """Generate and send an AI-personalized email."""
    user_id = enrollment["user_id"]

    # Check for duplicates
    existing = query(
        "SELECT id FROM marketing_emails_sent WHERE enrollment_id = %s AND step_id = %s",
        (enrollment["id"], step["id"]),
    )
    if existing:
        return  # Already sent

    # Get user
    users = query("SELECT * FROM platform_users WHERE id = %s", (user_id,))
    if not users:
        return
    user = users[0]

    # Build context and generate email
    context = _build_user_context(user)
    brief = config.get("brief", "")
    subject_hint = config.get("subject_hint", "")

    from .openai_helper import generate_marketing_email
    result = generate_marketing_email(context, brief, subject_hint)

    if not result:
        logger.error(f"AI generation failed for enrollment {enrollment['id']}")
        return

    subject = result["subject"]
    body_html = result["body_html"]

    # Wrap in email template
    full_html = _wrap_email_template(body_html)

    # Send via Gmail
    gmail_result = None
    try:
        from .google_oauth import is_connected as gmail_connected
        if gmail_connected():
            from .gmail import send_email
            gmail_result = send_email(
                to=user["email"],
                subject=subject,
                body_html=full_html,
            )
    except Exception as e:
        logger.error(f"Gmail send failed for enrollment {enrollment['id']}: {e}")

    # Log the sent email
    execute(
        """INSERT INTO marketing_emails_sent
           (id, enrollment_id, flow_id, step_id, user_id, to_email, subject, body_html, brief, gmail_message_id, gmail_thread_id)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            gen_id("mes_"),
            enrollment["id"],
            enrollment["flow_id"],
            step["id"],
            user_id,
            user["email"],
            subject,
            full_html,
            brief,
            gmail_result.get("message_id") if gmail_result else None,
            gmail_result.get("thread_id") if gmail_result else None,
        ),
    )
    logger.info(f"Marketing email sent to {user['email']} (flow: {enrollment.get('flow_name', '')})")


def _execute_wait_step(enrollment: dict, step: dict, config: dict):
    """Set next_action_at to NOW() + wait days and advance step."""
    days = config.get("days", 1)
    next_at = datetime.now() + timedelta(days=days)
    next_step = enrollment["current_step"] + 1

    execute(
        """UPDATE marketing_enrollments
           SET current_step = %s, next_action_at = %s
           WHERE id = %s""",
        (next_step, next_at.isoformat(), enrollment["id"]),
    )


def _execute_condition_step(enrollment: dict, step: dict, config: dict):
    """Evaluate a condition and decide whether to continue or skip."""
    check = config.get("check", "")
    if_false = config.get("if_false", "continue")
    user_id = enrollment["user_id"]

    met = False

    if check == "has_consultation":
        result = query(
            "SELECT COUNT(*) as cnt FROM platform_consultations WHERE user_id = %s",
            (user_id,),
        )
        met = result[0]["cnt"] > 0 if result else False

    elif check == "health_above":
        threshold = config.get("threshold", 50)
        result = query(
            "SELECT health_score FROM platform_users WHERE id = %s",
            (user_id,),
        )
        met = result[0]["health_score"] >= threshold if result else False

    if not met and if_false == "skip_rest":
        execute(
            """UPDATE marketing_enrollments
               SET status = 'completed', completed_at = NOW(), next_action_at = NULL
               WHERE id = %s""",
            (enrollment["id"],),
        )
        return

    # Continue to next step
    _advance_enrollment(enrollment)


def _advance_enrollment(enrollment: dict):
    """Move enrollment to the next step."""
    next_step = enrollment["current_step"] + 1

    # Check if next step exists
    steps = query(
        "SELECT id FROM marketing_flow_steps WHERE flow_id = %s AND step_order = %s",
        (enrollment["flow_id"], next_step),
    )

    if not steps:
        execute(
            """UPDATE marketing_enrollments
               SET status = 'completed', completed_at = NOW(), next_action_at = NULL
               WHERE id = %s""",
            (enrollment["id"],),
        )
    else:
        execute(
            """UPDATE marketing_enrollments
               SET current_step = %s, next_action_at = NOW()
               WHERE id = %s""",
            (next_step, enrollment["id"]),
        )


def _wrap_email_template(body_html: str) -> str:
    """Wrap AI-generated body in the People's Clinic email template."""
    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
        <div style="text-align: center; padding: 24px 0 16px;">
            <img src="https://csm-production.up.railway.app/assets/peoplesclinic.png" alt="People's Clinic" width="180" style="display: inline-block; max-width: 180px; height: auto;">
        </div>
        <div style="padding: 0 8px;">
            {body_html}
        </div>
        <div style="text-align: center; padding: 24px 0 8px; border-top: 1px solid #e2e8f0; margin-top: 24px;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                People's Clinic — Digital sundhedsplatform
            </p>
        </div>
    </div>
    """


# ── Segment Query Builder ─────────────────────────────────────────────

def query_segment_users(filter_rules: dict) -> list:
    """Query platform_users matching segment filter rules."""
    sql = "SELECT * FROM platform_users WHERE 1=1"
    params: list = []

    if "status" in filter_rules:
        statuses = filter_rules["status"]
        if isinstance(statuses, list) and statuses:
            placeholders = ",".join(["%s"] * len(statuses))
            sql += f" AND status IN ({placeholders})"
            params.extend(statuses)

    if "health_score_min" in filter_rules:
        sql += " AND health_score >= %s"
        params.append(filter_rules["health_score_min"])

    if "health_score_max" in filter_rules:
        sql += " AND health_score <= %s"
        params.append(filter_rules["health_score_max"])

    if "days_inactive_min" in filter_rules:
        sql += " AND last_active_at < NOW() - INTERVAL '%s days'"
        params.append(filter_rules["days_inactive_min"])

    if "signup_days_ago_min" in filter_rules:
        sql += " AND signup_at < NOW() - INTERVAL '%s days'"
        params.append(filter_rules["signup_days_ago_min"])

    if "signup_days_ago_max" in filter_rules:
        sql += " AND signup_at > NOW() - INTERVAL '%s days'"
        params.append(filter_rules["signup_days_ago_max"])

    if "plan" in filter_rules:
        plans = filter_rules["plan"]
        if isinstance(plans, list) and plans:
            placeholders = ",".join(["%s"] * len(plans))
            sql += f" AND plan IN ({placeholders})"
            params.extend(plans)

    if "has_consultation" in filter_rules:
        if filter_rules["has_consultation"]:
            sql += " AND first_consultation_at IS NOT NULL"
        else:
            sql += " AND first_consultation_at IS NULL"

    sql += " ORDER BY name ASC"
    return query(sql, tuple(params))


# ── Campaign Sender ───────────────────────────────────────────────────

def send_campaign(segment_id: str, brief: str, subject_hint: str = "") -> dict:
    """Send an AI-personalized email to all users in a segment."""
    from .openai_helper import generate_marketing_email

    # Get segment
    segments = query("SELECT * FROM marketing_segments WHERE id = %s", (segment_id,))
    if not segments:
        return {"error": "Segment not found", "sent_count": 0}

    segment = segments[0]
    rules = segment.get("filter_rules") or {}
    if isinstance(rules, str):
        rules = json.loads(rules)

    users = query_segment_users(rules)
    sent_count = 0
    errors = []

    for user in users:
        try:
            context = _build_user_context(user)
            result = generate_marketing_email(context, brief, subject_hint)
            if not result:
                errors.append(f"AI generation failed for {user['email']}")
                continue

            full_html = _wrap_email_template(result["body_html"])

            # Send via Gmail
            gmail_result = None
            try:
                from .google_oauth import is_connected as gmail_connected
                if gmail_connected():
                    from .gmail import send_email
                    gmail_result = send_email(
                        to=user["email"],
                        subject=result["subject"],
                        body_html=full_html,
                    )
            except Exception as e:
                errors.append(f"Gmail failed for {user['email']}: {e}")

            # Log
            execute(
                """INSERT INTO marketing_emails_sent
                   (id, flow_id, user_id, to_email, subject, body_html, brief, gmail_message_id)
                   VALUES (%s, NULL, %s, %s, %s, %s, %s, %s)""",
                (
                    gen_id("mes_"),
                    user["id"],
                    user["email"],
                    result["subject"],
                    full_html,
                    brief,
                    gmail_result.get("message_id") if gmail_result else None,
                ),
            )
            sent_count += 1

        except Exception as e:
            errors.append(f"Error for {user.get('email', '?')}: {e}")

    return {"sent_count": sent_count, "total_users": len(users), "errors": errors[:5]}
