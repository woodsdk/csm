"""
Google OAuth 2.0 — Token lifecycle for shared Gmail + Calendar account.

Handles credential storage, auto-refresh, and Google API service builders.
Single-row table: only one Google account connected at a time.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from .config import settings
from .database import query, execute

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
]


def get_stored_credentials() -> Optional[Credentials]:
    """Load credentials from DB. Auto-refresh if expired. Returns None if not connected."""
    rows = query("SELECT * FROM google_oauth_tokens WHERE id = 'shared'")
    if not rows:
        return None

    row = rows[0]
    creds = Credentials(
        token=row["access_token"],
        refresh_token=row["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_oauth_client_id,
        client_secret=settings.google_oauth_client_secret,
        scopes=row["scopes"].split(" ") if row["scopes"] else SCOPES,
    )

    # Check if expired and refresh
    if creds.expired or not creds.valid:
        try:
            creds.refresh(Request())
            # Save refreshed token
            execute(
                """UPDATE google_oauth_tokens
                   SET access_token = %s, token_expiry = %s, updated_at = NOW()
                   WHERE id = 'shared'""",
                (creds.token, creds.expiry.isoformat() if creds.expiry else datetime.now(timezone.utc).isoformat()),
            )
            logger.info("Google OAuth token refreshed successfully")
        except Exception as e:
            logger.error(f"Failed to refresh Google OAuth token: {e}")
            # Token revoked or invalid — disconnect
            disconnect()
            return None

    return creds


def save_credentials(creds: Credentials, email: str) -> None:
    """Upsert OAuth credentials to DB."""
    expiry = creds.expiry.isoformat() if creds.expiry else datetime.now(timezone.utc).isoformat()
    scopes = " ".join(creds.scopes) if creds.scopes else " ".join(SCOPES)

    execute(
        """INSERT INTO google_oauth_tokens (id, account_email, access_token, refresh_token, token_expiry, scopes)
           VALUES ('shared', %s, %s, %s, %s, %s)
           ON CONFLICT (id) DO UPDATE SET
               account_email = EXCLUDED.account_email,
               access_token = EXCLUDED.access_token,
               refresh_token = EXCLUDED.refresh_token,
               token_expiry = EXCLUDED.token_expiry,
               scopes = EXCLUDED.scopes,
               connected_at = NOW(),
               updated_at = NOW()""",
        (email, creds.token, creds.refresh_token, expiry, scopes),
    )
    logger.info(f"Google OAuth credentials saved for {email}")


def is_connected() -> bool:
    """Check if valid OAuth tokens exist."""
    rows = query("SELECT id FROM google_oauth_tokens WHERE id = 'shared'")
    return len(rows) > 0


def get_connected_email() -> Optional[str]:
    """Return the connected account email, or None."""
    rows = query("SELECT account_email FROM google_oauth_tokens WHERE id = 'shared'")
    return rows[0]["account_email"] if rows else None


def get_connection_status() -> dict:
    """Return full connection status for the frontend."""
    rows = query("SELECT * FROM google_oauth_tokens WHERE id = 'shared'")
    if not rows:
        return {"connected": False}
    row = rows[0]
    return {
        "connected": True,
        "email": row["account_email"],
        "scopes": row["scopes"].split(" ") if row["scopes"] else [],
        "connected_at": row["connected_at"],
    }


def disconnect() -> None:
    """Remove stored tokens."""
    execute("DELETE FROM google_oauth_tokens WHERE id = 'shared'")
    # Reset cached calendar service
    try:
        from . import google_calendar
        google_calendar._service = None
    except Exception:
        pass
    logger.info("Google OAuth disconnected")


def get_gmail_service():
    """Build and return Gmail API v1 service, or None."""
    creds = get_stored_credentials()
    if not creds:
        return None
    try:
        return build("gmail", "v1", credentials=creds, cache_discovery=False)
    except Exception as e:
        logger.error(f"Failed to build Gmail service: {e}")
        return None


def get_calendar_service():
    """Build and return Calendar API v3 service via OAuth, or None."""
    creds = get_stored_credentials()
    if not creds:
        return None
    try:
        return build("calendar", "v3", credentials=creds, cache_discovery=False)
    except Exception as e:
        logger.error(f"Failed to build Calendar service via OAuth: {e}")
        return None
