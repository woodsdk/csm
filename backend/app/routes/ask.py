"""Ask SynergyHub — AI Knowledge Assistant for CS Team."""

from fastapi import APIRouter
from pydantic import BaseModel
from ..database import query
from ..openai_helper import generate_ask_response, is_configured as openai_configured

router = APIRouter()


class AskRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("")
def ask_question(data: AskRequest):
    """Send a question to the SynergyHub AI knowledge assistant."""
    if not data.message.strip():
        return {"error": "Besked kan ikke være tom."}

    # Get FAQ items for context
    faq_items = query("SELECT question, answer, category FROM faq_items ORDER BY sort_order ASC")

    # Generate response
    response = generate_ask_response(
        message=data.message.strip(),
        history=data.history,
        faq_items=faq_items,
    )

    if response is None:
        if not openai_configured():
            return {"error": "OPENAI_API_KEY er ikke sat i miljøvariablerne."}
        return {"error": "Kunne ikke generere et svar. Prøv igen."}

    return {"response": response}
