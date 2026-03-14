"""OpenAI Integration — AI-powered reply suggestions for helpdesk."""

import os
import json
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

_client = None
_client_checked = False


def _get_client() -> OpenAI | None:
    """Lazy-init OpenAI client."""
    global _client, _client_checked
    if _client is not None:
        return _client
    if _client_checked:
        return None

    api_key = os.environ.get("OPENAI_API_KEY", "")
    _client_checked = True
    if not api_key:
        logger.warning("OPENAI_API_KEY not set — AI features disabled")
        return None

    logger.info(f"OpenAI client initialized (key: {api_key[:8]}...)")
    _client = OpenAI(api_key=api_key)
    return _client


def is_configured() -> bool:
    """Check if OpenAI API key is configured."""
    return bool(os.environ.get("OPENAI_API_KEY", ""))


def generate_reply_suggestion(
    ticket_subject: str,
    ticket_description: str,
    messages: list[dict],
    faq_items: list[dict],
) -> str | None:
    """Generate an AI reply suggestion for a helpdesk ticket.

    Uses GPT-4o-mini with FAQ context to produce helpful, on-brand replies.
    Returns the suggested reply text, or None if AI is unavailable.
    """
    client = _get_client()
    if not client:
        return None

    # Build FAQ context (max 15 most relevant items)
    faq_context = ""
    if faq_items:
        faq_lines = []
        for item in faq_items[:15]:
            faq_lines.append(f"Q: {item.get('question', '')}\nA: {item.get('answer', '')}")
        faq_context = "\n\n".join(faq_lines)

    # Build conversation history
    conversation = ""
    for msg in messages[-10:]:  # Last 10 messages max
        sender = msg.get("sender_name", "Ukendt")
        body = msg.get("body", "")
        msg_type = "INTERN NOTE" if msg.get("is_internal") else ""
        conversation += f"\n[{sender}] {msg_type}: {body}\n"

    system_prompt = """Du er en venlig og professionel kundesupport-medarbejder for People's Clinic (tidligere People's Doctor), en dansk sundhedstech-virksomhed.

Regler:
- Svar ALTID på dansk
- Vær venlig, professionel og hjælpsom
- Hold svaret kort og præcist (2-4 sætninger normalt)
- Brug FAQ-databasen til at give korrekte svar når relevant
- Sig aldrig noget du ikke er sikker på — henvis til en kollega i stedet
- Afslut med en venlig hilsen som "Med venlig hilsen" eller "Bedste hilsner"
- Underskiv IKKE med et navn — det tilføjer agenten selv"""

    user_prompt = f"""Generer et svarforslag til denne helpdesk-ticket:

EMNE: {ticket_subject}
BESKRIVELSE: {ticket_description}

SAMTALEHISTORIK:
{conversation if conversation.strip() else "(Ingen beskeder endnu)"}

FAQ-DATABASE (brug dette som vidensbase):
{faq_context if faq_context else "(Ingen FAQ tilgængelig)"}

Skriv et professionelt svarforslag på dansk:"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=500,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
        return None
