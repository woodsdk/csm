"""
Google Calendar integration via service account with domain-wide delegation.

Creates calendar events with Google Meet links, adds attendees, and handles
cancellations. Falls back gracefully when not configured.
"""

import json
import os
import logging
from typing import Optional
from .config import settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
_service = None


def _get_calendar_id() -> str:
    """Return 'primary' for OAuth, or the impersonate email for service account."""
    try:
        from .google_oauth import is_connected
        if is_connected():
            return "primary"
    except Exception:
        pass
    return settings.google_impersonate_email


def _get_service():
    """Build and cache the Calendar API service. Prefers OAuth, falls back to service account."""
    global _service
    if _service is not None:
        return _service

    # Strategy 1: Try OAuth tokens (preferred)
    try:
        from .google_oauth import get_calendar_service
        oauth_service = get_calendar_service()
        if oauth_service:
            _service = oauth_service
            logger.info("Google Calendar service initialized via OAuth")
            return _service
    except Exception as e:
        logger.debug(f"OAuth calendar not available: {e}")

    # Strategy 2: Fall back to service account (legacy)
    if not settings.google_calendar_enabled or not settings.google_service_account_json:
        return None

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        sa_json = settings.google_service_account_json

        # Support both file path and raw JSON string
        if os.path.isfile(sa_json):
            credentials = service_account.Credentials.from_service_account_file(
                sa_json, scopes=SCOPES
            )
        else:
            info = json.loads(sa_json)
            credentials = service_account.Credentials.from_service_account_info(
                info, scopes=SCOPES
            )

        # Impersonate the org user via domain-wide delegation
        delegated = credentials.with_subject(settings.google_impersonate_email)
        _service = build("calendar", "v3", credentials=delegated)
        logger.info("Google Calendar service initialized")
        return _service
    except Exception as e:
        logger.error(f"Failed to initialize Google Calendar service: {e}")
        return None


def create_event(
    date: str,
    start_time: str,
    end_time: str,
    summary: str,
    description: str,
    attendee_emails: list[str],
) -> Optional[dict]:
    """
    Create a Google Calendar event with auto-generated Google Meet link.

    Returns dict with 'event_id', 'meet_link', 'html_link' on success.
    Returns None on failure (caller should fall back to Jitsi).
    """
    service = _get_service()
    if not service:
        return None

    timezone = "Europe/Copenhagen"
    start_dt = f"{date}T{start_time}:00"
    end_dt = f"{date}T{end_time}:00"

    event_body = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_dt, "timeZone": timezone},
        "end": {"dateTime": end_dt, "timeZone": timezone},
        "attendees": [{"email": email} for email in attendee_emails],
        "conferenceData": {
            "createRequest": {
                "requestId": f"demo-{date}-{start_time}-{os.urandom(4).hex()}",
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email", "minutes": 60},
                {"method": "popup", "minutes": 15},
            ],
        },
    }

    try:
        from googleapiclient.errors import HttpError

        event = (
            service.events()
            .insert(
                calendarId=_get_calendar_id(),
                body=event_body,
                conferenceDataVersion=1,
                sendUpdates="all",
            )
            .execute()
        )

        meet_link = ""
        entry_points = event.get("conferenceData", {}).get("entryPoints", [])
        for ep in entry_points:
            if ep.get("entryPointType") == "video":
                meet_link = ep["uri"]
                break

        logger.info(f"Created calendar event {event['id']} with Meet link")
        return {
            "event_id": event["id"],
            "meet_link": meet_link,
            "html_link": event.get("htmlLink", ""),
        }
    except Exception as e:
        logger.error(f"Google Calendar API error creating event: {e}")
        return None


def add_attendee(event_id: str, email: str, name: str = "") -> bool:
    """
    Add an attendee to an existing calendar event.
    Google automatically sends them an invite with the Meet link.

    Returns True on success, False on failure.
    """
    service = _get_service()
    if not service:
        return False

    try:
        # Fetch current event
        event = (
            service.events()
            .get(
                calendarId=_get_calendar_id(),
                eventId=event_id,
            )
            .execute()
        )

        # Check if already attending
        existing_emails = {a["email"].lower() for a in event.get("attendees", [])}
        if email.lower() in existing_emails:
            return True

        # Add new attendee
        attendees = event.get("attendees", [])
        new_attendee = {"email": email}
        if name:
            new_attendee["displayName"] = name
        attendees.append(new_attendee)

        service.events().patch(
            calendarId=_get_calendar_id(),
            eventId=event_id,
            body={"attendees": attendees},
            sendUpdates="all",
        ).execute()

        logger.info(f"Added attendee {email} to event {event_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to add attendee to event {event_id}: {e}")
        return False


def delete_event(event_id: str) -> bool:
    """Cancel/delete a calendar event. Sends cancellation to attendees."""
    service = _get_service()
    if not service:
        return False

    try:
        service.events().delete(
            calendarId=_get_calendar_id(),
            eventId=event_id,
            sendUpdates="all",
        ).execute()
        logger.info(f"Deleted calendar event {event_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete event {event_id}: {e}")
        return False
