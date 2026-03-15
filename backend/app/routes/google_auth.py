"""Google OAuth 2.0 routes — connect, callback, disconnect, status."""

import logging
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, JSONResponse
from google_auth_oauthlib.flow import Flow

from ..config import settings
from ..google_oauth import (
    save_credentials,
    get_connection_status,
    disconnect as oauth_disconnect,
    SCOPES,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory store: state → code_verifier (for PKCE support)
_pending_states: dict[str, str] = {}


def _create_flow() -> Flow:
    """Create a Google OAuth flow from config."""
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.google_oauth_redirect_uri,
    )


@router.get("/status")
def get_status():
    """Return current Google OAuth connection status."""
    return get_connection_status()


@router.get("/debug")
def debug_config():
    """Debug endpoint — shows config (no secrets)."""
    return {
        "client_id_set": bool(settings.google_oauth_client_id),
        "client_id_prefix": settings.google_oauth_client_id[:20] + "..." if settings.google_oauth_client_id else "",
        "client_secret_set": bool(settings.google_oauth_client_secret),
        "redirect_uri": settings.google_oauth_redirect_uri,
        "scopes": SCOPES,
    }


@router.get("/connect")
def connect():
    """Generate Google OAuth authorization URL."""
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        return JSONResponse(
            {"error": "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET."},
            status_code=400,
        )

    flow = _create_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
    )

    # Store the PKCE code_verifier so we can pass it to the callback flow
    _pending_states[state] = getattr(flow, "code_verifier", "") or ""
    return {"auth_url": auth_url}


@router.get("/callback")
def callback(request: Request, code: str = "", state: str = "", error: str = ""):
    """Handle Google OAuth redirect after user consent."""
    if error:
        logger.error(f"Google OAuth error from Google: {error}")
        return RedirectResponse(url=f"/?page=settings&google=error&reason={error}")

    if not code:
        logger.error("Google OAuth callback: no code received")
        return RedirectResponse(url="/?page=settings&google=error&reason=no_code")

    # Retrieve the PKCE code_verifier that was stored during /connect
    code_verifier = _pending_states.pop(state, None)
    if code_verifier is None:
        logger.warning("OAuth callback with unknown state — proceeding without PKCE verifier")
        code_verifier = ""

    try:
        flow = _create_flow()

        # Restore the PKCE code_verifier so fetch_token can complete the exchange
        if code_verifier:
            flow.code_verifier = code_verifier

        flow.fetch_token(code=code)
        creds = flow.credentials

        if not creds or not creds.refresh_token:
            logger.error("No refresh token received — user may need to re-consent")
            return RedirectResponse(url="/?page=settings&google=error&reason=no_refresh_token")

        # Get the authenticated user's email
        from googleapiclient.discovery import build
        gmail = build("gmail", "v1", credentials=creds, cache_discovery=False)
        profile = gmail.users().getProfile(userId="me").execute()
        email = profile.get("emailAddress", "unknown")

        # Save credentials
        save_credentials(creds, email)

        # Reset cached calendar service so it picks up OAuth
        try:
            from .. import google_calendar
            google_calendar._service = None
        except Exception:
            pass

        logger.info(f"Google OAuth connected: {email}")
        return RedirectResponse(url="/?page=settings&google=connected")

    except Exception as e:
        import traceback
        logger.error(f"Google OAuth callback failed: {e}\n{traceback.format_exc()}")
        reason = str(e)[:100].replace(" ", "_").replace("&", "").replace("=", "")
        return RedirectResponse(url=f"/?page=settings&google=error&reason={reason}")


@router.get("/test-calendar")
def test_calendar():
    """Test Google Calendar access — returns detailed diagnostics."""
    from ..google_oauth import is_connected, get_stored_credentials, get_connected_email
    import traceback

    result = {
        "oauth_connected": is_connected(),
        "email": get_connected_email(),
        "calendar_service": False,
        "can_list_events": False,
        "can_create_event": False,
        "errors": [],
    }

    if not result["oauth_connected"]:
        result["errors"].append("OAuth not connected")
        return result

    # Test building calendar service
    try:
        from ..google_oauth import get_calendar_service
        service = get_calendar_service()
        if service:
            result["calendar_service"] = True
        else:
            result["errors"].append("get_calendar_service() returned None")
            return result
    except Exception as e:
        result["errors"].append(f"Build service failed: {e}\n{traceback.format_exc()}")
        return result

    # Test listing events
    try:
        events = service.events().list(
            calendarId="primary", maxResults=1, singleEvents=True,
        ).execute()
        result["can_list_events"] = True
        result["events_found"] = len(events.get("items", []))
    except Exception as e:
        result["errors"].append(f"List events failed: {e}")

    # Test creating a test event (dry run — we'll delete it immediately)
    try:
        import os
        test_event = {
            "summary": "SynergyHub Calendar Test — auto-delete",
            "start": {"dateTime": "2026-03-20T10:00:00", "timeZone": "Europe/Copenhagen"},
            "end": {"dateTime": "2026-03-20T10:30:00", "timeZone": "Europe/Copenhagen"},
            "conferenceData": {
                "createRequest": {
                    "requestId": f"test-{os.urandom(4).hex()}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
        }
        created = service.events().insert(
            calendarId="primary", body=test_event, conferenceDataVersion=1,
        ).execute()

        meet_link = ""
        for ep in created.get("conferenceData", {}).get("entryPoints", []):
            if ep.get("entryPointType") == "video":
                meet_link = ep["uri"]
                break

        result["can_create_event"] = True
        result["test_event_id"] = created["id"]
        result["test_meet_link"] = meet_link

        # Clean up — delete the test event
        service.events().delete(calendarId="primary", eventId=created["id"]).execute()
        result["test_cleaned_up"] = True

    except Exception as e:
        result["errors"].append(f"Create event failed: {e}\n{traceback.format_exc()}")

    return result


@router.post("/disconnect")
def disconnect():
    """Disconnect Google account — revoke and delete tokens."""
    oauth_disconnect()
    return {"ok": True}
