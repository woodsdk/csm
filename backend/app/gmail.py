"""
Gmail API integration — send, read, list, sync emails via OAuth credentials.
"""

import base64
import logging
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from .google_oauth import get_gmail_service, get_connected_email
from .email_template import wrap_email

logger = logging.getLogger(__name__)


def _parse_email_address(raw: str) -> tuple[str, str]:
    """Extract name and email from 'Name <email@example.com>' format."""
    match = re.match(r'^"?([^"<]*)"?\s*<?([^>]+)>?$', raw.strip())
    if match:
        name = match.group(1).strip().strip('"')
        email = match.group(2).strip()
        return name, email
    return "", raw.strip()


def send_email(
    to: str,
    subject: str,
    body_html: str,
    reply_to_message_id: Optional[str] = None,
    thread_id: Optional[str] = None,
    use_template: bool = False,
) -> Optional[dict]:
    """
    Send an email via Gmail API.
    If use_template=True, wraps content in the branded People's Clinic template.
    Returns {'message_id': ..., 'thread_id': ...} on success, None on failure.
    """
    service = get_gmail_service()
    if not service:
        logger.warning("Gmail not connected — cannot send email")
        return None

    try:
        # Wrap in branded template if requested
        final_html = wrap_email(body_html) if use_template else body_html

        message = MIMEMultipart("alternative")
        message["to"] = to
        message["subject"] = subject

        if reply_to_message_id:
            message["In-Reply-To"] = reply_to_message_id
            message["References"] = reply_to_message_id

        message.attach(MIMEText(final_html, "html"))

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        body = {"raw": raw}
        if thread_id:
            body["threadId"] = thread_id

        result = service.users().messages().send(userId="me", body=body).execute()
        logger.info(f"Email sent to {to}, message_id={result['id']}")
        return {
            "message_id": result["id"],
            "thread_id": result.get("threadId", ""),
        }
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return None


def list_inbox(
    max_results: int = 20,
    page_token: Optional[str] = None,
    q: Optional[str] = None,
) -> Optional[dict]:
    """
    List inbox messages with metadata.
    Returns {'messages': [...], 'next_page_token': ..., 'unread_count': ...}.
    """
    service = get_gmail_service()
    if not service:
        return None

    try:
        params = {
            "userId": "me",
            "labelIds": ["INBOX"],
            "maxResults": max_results,
        }
        if page_token:
            params["pageToken"] = page_token
        if q:
            params["q"] = q

        result = service.users().messages().list(**params).execute()
        message_ids = result.get("messages", [])
        next_token = result.get("nextPageToken")

        messages = []
        for msg_ref in message_ids:
            msg = service.users().messages().get(
                userId="me", id=msg_ref["id"], format="metadata",
                metadataHeaders=["Subject", "From", "To", "Date"],
            ).execute()

            headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
            messages.append({
                "id": msg["id"],
                "thread_id": msg.get("threadId", ""),
                "subject": headers.get("subject", "(ingen emne)"),
                "from_raw": headers.get("from", ""),
                "to": headers.get("to", ""),
                "snippet": msg.get("snippet", ""),
                "date": headers.get("date", ""),
                "is_unread": "UNREAD" in msg.get("labelIds", []),
                "labels": msg.get("labelIds", []),
            })

        # Get unread count
        unread_count = 0
        try:
            label = service.users().labels().get(userId="me", id="INBOX").execute()
            unread_count = label.get("messagesUnread", 0)
        except Exception:
            pass

        return {
            "messages": messages,
            "next_page_token": next_token,
            "unread_count": unread_count,
        }
    except Exception as e:
        logger.error(f"Failed to list inbox: {e}")
        return None


def get_message(message_id: str) -> Optional[dict]:
    """Get a single message with full content."""
    service = get_gmail_service()
    if not service:
        return None

    try:
        msg = service.users().messages().get(userId="me", id=message_id, format="full").execute()
        headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}

        # Extract body
        body_html = ""
        body_text = ""
        payload = msg.get("payload", {})

        def _extract_body(part):
            nonlocal body_html, body_text
            mime = part.get("mimeType", "")
            data = part.get("body", {}).get("data")
            if data:
                decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                if "html" in mime:
                    body_html = decoded
                elif "plain" in mime:
                    body_text = decoded
            for sub in part.get("parts", []):
                _extract_body(sub)

        _extract_body(payload)

        return {
            "id": msg["id"],
            "thread_id": msg.get("threadId", ""),
            "subject": headers.get("subject", ""),
            "from_raw": headers.get("from", ""),
            "to": headers.get("to", ""),
            "date": headers.get("date", ""),
            "body_html": body_html or body_text,
            "snippet": msg.get("snippet", ""),
            "is_unread": "UNREAD" in msg.get("labelIds", []),
            "labels": msg.get("labelIds", []),
        }
    except Exception as e:
        logger.error(f"Failed to get message {message_id}: {e}")
        return None


def mark_as_read(message_id: str) -> bool:
    """Remove UNREAD label from a message."""
    service = get_gmail_service()
    if not service:
        return False
    try:
        service.users().messages().modify(
            userId="me", id=message_id,
            body={"removeLabelIds": ["UNREAD"]},
        ).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to mark message as read: {e}")
        return False


def sync_inbox(max_results: int = 20) -> dict:
    """
    Sync Gmail inbox → create/update helpdesk tickets.

    - New emails from external senders → new ticket
    - Replies in existing threads → new message on existing ticket
    - Skips emails sent by us (outgoing)
    - Skips already-processed messages

    Returns {'synced': N, 'created': N, 'updated': N, 'errors': [...]}.
    """
    from .database import query, execute, gen_id

    service = get_gmail_service()
    if not service:
        return {"synced": 0, "created": 0, "updated": 0, "errors": ["Gmail not connected"]}

    our_email = (get_connected_email() or "").lower()
    if not our_email:
        return {"synced": 0, "created": 0, "updated": 0, "errors": ["No connected email"]}

    created = 0
    updated = 0
    errors = []

    try:
        # List recent inbox messages
        result = service.users().messages().list(
            userId="me", labelIds=["INBOX"], maxResults=max_results,
        ).execute()
        message_refs = result.get("messages", [])

        if not message_refs:
            return {"synced": 0, "created": 0, "updated": 0, "errors": []}

        # Get all gmail_message_ids we've already processed
        existing_msg_ids = set()
        rows = query("SELECT gmail_message_id FROM ticket_messages WHERE gmail_message_id IS NOT NULL")
        for r in rows:
            existing_msg_ids.add(r["gmail_message_id"])

        # Also get message IDs from tickets table (the ones we sent)
        sent_rows = query("SELECT gmail_thread_id FROM tickets WHERE gmail_thread_id IS NOT NULL")
        existing_thread_ids = {r["gmail_thread_id"] for r in sent_rows}

        for msg_ref in message_refs:
            msg_id = msg_ref["id"]

            # Skip already processed
            if msg_id in existing_msg_ids:
                continue

            try:
                # Fetch full message
                msg = service.users().messages().get(
                    userId="me", id=msg_id, format="full",
                ).execute()

                headers = {
                    h["name"].lower(): h["value"]
                    for h in msg.get("payload", {}).get("headers", [])
                }

                from_raw = headers.get("from", "")
                _, from_email = _parse_email_address(from_raw)
                from_name, _ = _parse_email_address(from_raw)

                # Skip emails sent by us
                if from_email.lower() == our_email:
                    continue

                subject = headers.get("subject", "(Ingen emne)")
                thread_id = msg.get("threadId", "")

                # Extract body
                body_html = ""
                body_text = ""

                def _extract(part):
                    nonlocal body_html, body_text
                    mime = part.get("mimeType", "")
                    data = part.get("body", {}).get("data")
                    if data:
                        decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                        if "html" in mime:
                            body_html = decoded
                        elif "plain" in mime:
                            body_text = decoded
                    for sub in part.get("parts", []):
                        _extract(sub)

                _extract(msg.get("payload", {}))
                body = body_text or body_html or msg.get("snippet", "")

                # Strip HTML tags for plain text storage
                if body and "<" in body and ">" in body and not body_text:
                    body = re.sub(r"<[^>]+>", "", body).strip()

                # Check if this thread already has a ticket
                existing_ticket = None
                if thread_id:
                    ticket_rows = query(
                        "SELECT id, subject FROM tickets WHERE gmail_thread_id = %s",
                        (thread_id,),
                    )
                    if ticket_rows:
                        existing_ticket = ticket_rows[0]

                if existing_ticket:
                    # Add as reply to existing ticket
                    new_msg_id = gen_id("msg_")
                    query(
                        """INSERT INTO ticket_messages
                           (id, ticket_id, sender_type, sender_name, sender_email, body, is_internal, gmail_message_id)
                           VALUES (%s, %s, 'requester', %s, %s, %s, false, %s)
                           RETURNING id""",
                        (new_msg_id, existing_ticket["id"], from_name, from_email, body, msg_id),
                    )
                    # Reopen ticket if it was resolved/closed
                    execute(
                        """UPDATE tickets SET status = 'open', updated_at = NOW()
                           WHERE id = %s AND status IN ('resolved', 'closed')""",
                        (existing_ticket["id"],),
                    )
                    mark_as_read(msg_id)
                    updated += 1
                else:
                    # Create new ticket
                    ticket_id = gen_id("tk_")
                    # Clean subject (remove Re:/Fwd: prefixes for ticket subject)
                    clean_subject = re.sub(r"^(Re|Fwd|Sv|Vs):\s*", "", subject, flags=re.IGNORECASE).strip()

                    # AI-classify priority and category
                    from .openai_helper import classify_ticket_priority
                    classification = classify_ticket_priority(
                        subject=clean_subject or subject,
                        body=body[:500] if body else "",
                    )
                    ai_priority = classification["priority"]
                    ai_category = classification["category"]

                    query(
                        """INSERT INTO tickets
                           (id, subject, description, status, priority, category, source,
                            requester_name, requester_email, gmail_thread_id, priority_source)
                           VALUES (%s, %s, '', 'open', %s, %s, 'email', %s, %s, %s, 'ai')
                           RETURNING id""",
                        (ticket_id, clean_subject or subject, ai_priority, ai_category, from_name, from_email, thread_id),
                    )

                    # Add the email body as first message
                    new_msg_id = gen_id("msg_")
                    query(
                        """INSERT INTO ticket_messages
                           (id, ticket_id, sender_type, sender_name, sender_email, body, is_internal, gmail_message_id)
                           VALUES (%s, %s, 'requester', %s, %s, %s, false, %s)
                           RETURNING id""",
                        (new_msg_id, ticket_id, from_name, from_email, body, msg_id),
                    )

                    mark_as_read(msg_id)
                    created += 1

            except Exception as e:
                logger.error(f"Failed to process message {msg_id}: {e}")
                errors.append(str(e))

    except Exception as e:
        logger.error(f"Failed to sync inbox: {e}")
        errors.append(str(e))

    logger.info(f"Gmail sync: created={created}, updated={updated}, errors={len(errors)}")
    return {
        "synced": created + updated,
        "created": created,
        "updated": updated,
        "errors": errors,
    }
