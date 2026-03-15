"""
Gmail API integration — send, read, list emails via OAuth credentials.
"""

import base64
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from .google_oauth import get_gmail_service

logger = logging.getLogger(__name__)


def send_email(
    to: str,
    subject: str,
    body_html: str,
    reply_to_message_id: Optional[str] = None,
    thread_id: Optional[str] = None,
) -> Optional[dict]:
    """
    Send an email via Gmail API.
    Returns {'message_id': ..., 'thread_id': ...} on success, None on failure.
    """
    service = get_gmail_service()
    if not service:
        logger.warning("Gmail not connected — cannot send email")
        return None

    try:
        message = MIMEMultipart("alternative")
        message["to"] = to
        message["subject"] = subject

        if reply_to_message_id:
            message["In-Reply-To"] = reply_to_message_id
            message["References"] = reply_to_message_id

        message.attach(MIMEText(body_html, "html"))

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
