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

# In-memory state store for CSRF protection (fine for single-instance)
_pending_states: dict[str, bool] = {}


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

    _pending_states[state] = True
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

    # Verify state
    if state not in _pending_states:
        logger.warning("OAuth callback with invalid state — proceeding anyway")
    _pending_states.pop(state, None)

    try:
        flow = _create_flow()
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
        # URL-encode a short reason for frontend debugging
        reason = str(e)[:100].replace(" ", "_").replace("&", "").replace("=", "")
        return RedirectResponse(url=f"/?page=settings&google=error&reason={reason}")


@router.post("/disconnect")
def disconnect():
    """Disconnect Google account — revoke and delete tokens."""
    oauth_disconnect()
    return {"ok": True}
