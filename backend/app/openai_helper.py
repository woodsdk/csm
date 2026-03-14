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


# ── SynergyHub Knowledge Base (hardcoded platform knowledge) ───────

_SYNERGYHUB_KNOWLEDGE = """
## Om People's Clinic / Lisn Platform

People's Clinic (udviklet af People's Doctor ApS, CVR: 40930809) er en dansk sundhedstech-løsning der bruger AI til at opsummere læge-patient samtaler og reducere dokumentationstid.

**Kernefunktionalitet:**
- Transkriberer live læge-patient samtaler via Speech-to-Text (STT)
- Genererer objektive medicinske opsummeringer via AI (LLM)
- Lægen skal ALTID gennemgå og godkende AI-output (Human-in-the-Loop)
- Klassificeret som et ikke-medicinsk, administrativt værktøj (undgår MDR-klassificering)

**Nøgletal (simulerede):**
- ~120 aktive brugere (læger/klinikker)
- ~15 klinikker onboardet
- Gennemsnitlig tid-til-værdi: ~8 dage fra signup til første konsultation
- NPS-score: ~42
- Gennemsnitlig rating: ~7.8/10
- Churn rate: ~4.2% (90 dage)
- MRR: ~180.000 DKK

**Organisationen:**
- Lars Kensmark: CEO, medstifter
- Anders Hasle Nielsen: CTO, medstifter — ansvarlig for al kode, sikkerhed og AI governance
- Søren Tang Hansen: DPO (ekstern) — juridisk rådgivning GDPR/AI Act
- Morten Knudsen: Compliance Engineer — ejer governance-projektet
- Janos Beaumont: Platform Engineer — IaC og Evidence-as-Code
- Sune Lynnerup: Application Administrator — produktionsdrift

**Teknisk Arkitektur:**
- Backend: FastAPI (Python) med PostgreSQL
- Frontend: TypeScript + Vite (vanilla, ingen framework)
- Hosting: netcup GmbH (Nürnberg, Tyskland) — EU/EØS
- AI: gpt-4o-mini til inference, Temperature 0, ingen training på patientdata
- Sikkerhed: PostgreSQL RLS (Row-Level Security), TLS 1.2+, LUKS disk-kryptering
- Container-baseret arkitektur (Docker), klar til Kubernetes/Gefion migration
- Keycloak til SSO/identity brokering (SAML 2.0 / OIDC)
- FHIR R4-ready JSON strukturer til fremtidig interoperabilitet

**Compliance & Sikkerhed (17 ufravigelige regler):**
- R-01: No Patient Registry — ingen patientdatabase, data linkes til Doctor ID + Timestamp
- R-02: Human-in-the-Loop Gate — AI-output kræver lægegodkendelse før DB-commit
- R-03: Inference Only — ingen training/fine-tuning på patientdata
- R-04: EU/EØS Data Sovereignty — ALLE data processeres og lagres inden for EU/EØS, nul tolerance
- R-05: Tenant Isolation — PostgreSQL RLS på database-niveau
- R-06: Deterministisk AI-Output — Temperature 0, fixed seed, frozen baseline
- R-07: Approval-Locked API — kun "Approved" records eksponeres eksternt
- R-08: Automation Bias Metrics — Time-to-Approval og Edit-Ratio logges
- R-09: AI Container Egress Block — AI-containers har al udgående trafik blokeret
- R-10: Immutable Audit Trail — append-only audit log, daglig SHA-256 hashing
- R-11: Four-Eyes Principle — kode kræver minimum 1 reviewer via MR
- R-12: PII Communication Block — patientdata må aldrig sendes via email/chat
- R-13: EU/EØS Supply Chain — alle sub-processorer skal have domicil i EU/EØS
- R-14: Granulært Brugersamtykke — eksplicit opt-in per datakategori
- R-15: Data Subject Rights — automatiseret self-service (eksport, sletning, portering)
- R-16: Aldersverifikation — brugere under 15 kræver forældresamtykke
- R-17: Ingen Medicinske Diagnoser — AI må aldrig diagnosticere eller anbefale behandling

**Lovgivning:**
- GDPR (alle artikler, særligt Art. 5, 17, 20, 25, 28, 32, 33-34, 44-49)
- EU AI Act (Art. 9, 10, 13, 14)
- NIS2 (Art. 21)
- Sundhedsloven § 42a-42c
- ISAE 3000 Type 1 (Areas A, B, C, J, K)
- Databeskyttelsesloven § 6
- MDR 2017/745 (undgåelse via positionering)

**PLO-tender (Praktiserende Lægers Organisation):**
- Ordregiver: PLAndel A.M.B.A. (Managed Service Provider)
- Scope: 300-600 klinikker
- Evaluering: 70% kvalitet, 30% pris
- Pilotfase: 50 licenser
- Log retention: 730 dage (2 år, overwrite af baseline 185 dage)
- Incident notifikation: 48 timer (strammere end GDPR's 72 timer)
- Gefion migration: Strategisk prioritering af dansk cloud hosting

**Gefion (Danmarks nationale AI-supercomputer):**
- Opereret af DCAI A/S
- NVIDIA DGX SuperPOD
- Migrationsplan: Fase 1 (AI-workloads), Fase 2 (fuld migration)
- Compliance-fordel: Fuld dansk datasuverænitet

**Klinisk forskning (Track 2 — Researcher's Gambit):**
- Partnerskab med Syddansk Universitet (SDU)
- Kliniske funktioner klassificeres som "Investigational Devices" under MDR Art. 62
- Ikke-kommerciel adgang for pilotklinikker
- SDU-forskere udfører uafhængig evaluering

**Planer & Udvikling:**
- Peoples Clinic har en voice-first tilgang (mikrofon-baseret)
- Mobile app til fysiske konsultationer
- GraphQL API-lag planlagt
- Real-time Contextual Agent (roadmap)
- Template-driven prompting med tone, længde og struktur
- Whitelabeling-arkitektur for klinik-branding
- WCAG 2.1 tilgængelighed

**Support & SLA:**
- P1 (kritisk): 15 min responstid
- P2 (høj): 1 time responstid
- P3 (normal): 8 timer responstid
- Oppetidsmål: 99,5%
- RTO: 8-12 timer, RPO: 24 timer
- Level 1-3 supportstruktur

**Sub-processor:**
- netcup GmbH (HRB 26500) — Daimlerstraße 25, 76185 Karlsruhe, Tyskland
- Hosting af self-managed Virtual Root Servers (IaaS)
- ISO/IEC 27001 og ISO/IEC 27701 certificeret
- Processing location: Nürnberg, Tyskland
"""


def generate_ask_response(
    message: str,
    history: list[dict],
    faq_items: list[dict],
) -> str | None:
    """Generate a response for the Ask SynergyHub knowledge assistant.

    Uses GPT-4o-mini with FAQ + platform knowledge to answer CS team questions.
    Returns the response text, or None if AI is unavailable.
    """
    client = _get_client()
    if not client:
        return None

    # Build FAQ context
    faq_context = ""
    if faq_items:
        faq_lines = []
        for item in faq_items[:20]:
            cat = item.get("category", "")
            q = item.get("question", "")
            a = item.get("answer", "")
            faq_lines.append(f"[{cat}] Q: {q}\nA: {a}")
        faq_context = "\n\n".join(faq_lines)

    system_prompt = f"""Du er SynergyHub — en intern AI-vidensassistent for People's Clinic CS-teamet.

Dit formål er at besvare spørgsmål fra Customer Success-medarbejdere om platformen. Du sidder på al viden om People's Clinic og kan hjælpe med:

1. **Platform & funktioner** — hvad kan produktet, hvordan virker det, tekniske detaljer
2. **Compliance & sikkerhed** — GDPR, EU AI Act, de 17 ufravigelige regler, sikkerhedsarkitektur
3. **Kundedata & statistik** — NPS, churn, health scores, onboarding-metrics (simulerede tal)
4. **Udviklingsstatus** — roadmap, planlagte features, tekniske beslutninger
5. **FAQ & kundesvar** — hjælp med at formulere svar til kunder baseret på FAQ-databasen
6. **PLO-tender** — krav, evaluering, Gefion, SDU-forskning

VIGTIGE REGLER:
- Svar ALTID på dansk
- Vær præcis, professionel og hjælpsom
- Brug den vedlagte vidensbase til at give korrekte og detaljerede svar
- Hvis du bruger data/statistik, svar som om det er ægte produktionsdata
- Hvis du ikke ved noget med sikkerhed, sig det ærligt og foreslå hvem i teamet der kan svare
- Hold svarene fokuserede — brug bullet points og struktur når det giver mening
- Du må gerne citere specifikke compliance-regler (R-01 til R-17) og lovhjemler
- Når du svarer på kundevendte spørgsmål, brug FAQ-databasen som udgangspunkt

VIDENSBASE:
{_SYNERGYHUB_KNOWLEDGE}

FAQ-DATABASE:
{faq_context if faq_context else "(Ingen FAQ-items tilgængelige)"}"""

    # Build messages array with history
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history (last 20 messages max)
    for msg in history[-20:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    # Add current message
    messages.append({"role": "user", "content": message})

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=1500,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"OpenAI API error (ask): {e}")
        return None
