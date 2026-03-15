"""Gmail API routes — inbox, messages, send, reply."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from ..gmail import list_inbox, get_message, send_email, mark_as_read
from ..google_oauth import is_connected

router = APIRouter()


class SendRequest(BaseModel):
    to: str
    subject: str
    body: str


class ReplyRequest(BaseModel):
    to: str
    subject: str
    body: str
    thread_id: str
    in_reply_to: Optional[str] = None


@router.get("/inbox")
def inbox(page_token: Optional[str] = None, q: Optional[str] = None, max_results: int = 20):
    """List inbox messages."""
    if not is_connected():
        return {"error": "Gmail not connected", "messages": [], "unread_count": 0}

    result = list_inbox(max_results=max_results, page_token=page_token, q=q)
    if result is None:
        return {"error": "Failed to fetch inbox", "messages": [], "unread_count": 0}
    return result


@router.get("/messages/{message_id}")
def message_detail(message_id: str):
    """Get a single message with full content."""
    if not is_connected():
        return {"error": "Gmail not connected"}

    result = get_message(message_id)
    if result is None:
        return {"error": "Failed to fetch message"}
    return result


@router.post("/send")
def send(data: SendRequest):
    """Send a new email."""
    if not is_connected():
        return {"error": "Gmail not connected"}

    result = send_email(to=data.to, subject=data.subject, body_html=data.body)
    if result is None:
        return {"error": "Failed to send email"}
    return {"ok": True, **result}


@router.post("/reply")
def reply(data: ReplyRequest):
    """Reply to an existing email thread."""
    if not is_connected():
        return {"error": "Gmail not connected"}

    result = send_email(
        to=data.to,
        subject=data.subject,
        body_html=data.body,
        reply_to_message_id=data.in_reply_to,
        thread_id=data.thread_id,
    )
    if result is None:
        return {"error": "Failed to send reply"}
    return {"ok": True, **result}


@router.post("/mark-read/{message_id}")
def mark_read(message_id: str):
    """Mark a message as read."""
    if not is_connected():
        return {"error": "Gmail not connected"}
    success = mark_as_read(message_id)
    return {"ok": success}
