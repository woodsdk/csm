"""OpenAI Integration — AI-powered reply suggestions and draft generation."""

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
    user_instruction: str = "",
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

    instruction_block = ""
    if user_instruction and user_instruction.strip():
        instruction_block = f"\n\nAGENTENS INSTRUKTION (følg denne retning i dit svar):\n{user_instruction.strip()}\n"

    user_prompt = f"""Generer et svarforslag til denne helpdesk-ticket:

EMNE: {ticket_subject}
BESKRIVELSE: {ticket_description}

SAMTALEHISTORIK:
{conversation if conversation.strip() else "(Ingen beskeder endnu)"}

FAQ-DATABASE (brug dette som vidensbase):
{faq_context if faq_context else "(Ingen FAQ tilgængelig)"}
{instruction_block}
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


# ── Contact Draft Generation ─────────────────────────────────────────

def generate_contact_draft(
    user_context: dict,
    feedback: list[dict],
    tickets: list[dict],
    prompt: str = "",
    target_feedback: dict | None = None,
) -> dict | None:
    """Generate a contact draft (subject + body) for outbound CS communication.

    Uses user context, feedback history, and ticket history to produce
    a personalized, contextual email/message draft.
    Returns {"subject": "...", "body": "..."} or None if AI unavailable.
    """
    client = _get_client()
    if not client:
        return None

    system_prompt = """Du er en erfaren Customer Success Manager for People's Clinic, en dansk sundhedstech-virksomhed.

Du skriver professionelle, varme og proaktive beskeder til klinikker og læger der bruger platformen.

REGLER:
- Skriv ALTID på dansk
- Vær venlig, empatisk og løsningsorienteret — aldrig sælgende
- Personalisér baseret på brugerens data og situation
- Hold beskeden kort og præcis (3-6 sætninger i body)
- Afslut med "Med venlig hilsen" (uden navn — agenten tilføjer selv)
- Hvis der er feedback at følge op på, anerkend den konkret
- Hvis health score er lav, vær proaktiv og tilbyd hjælp uden at lyde alarmerende
- SVAR KUN med et JSON-objekt: {"subject": "...", "body": "..."}
- Subject skal være kort og relevant (maks 60 tegn)
- Body skal starte med "Hej [fornavn]," og slutte med "Med venlig hilsen"
- Brug IKKE markdown i body — kun ren tekst med linjeskift"""

    # Build user context block
    uc = user_context
    user_block = f"""BRUGER KONTEKST:
- Navn: {uc.get('name', 'Ukendt')}
- Klinik: {uc.get('clinic_name', 'Ukendt')}
- Speciale: {uc.get('speciale', 'Ukendt')}
- Status: {uc.get('status', 'Ukendt')}
- Plan: {uc.get('plan', 'Ukendt')}
- Health score: {uc.get('health_score', 'N/A')}/100
- Konsultationer: {uc.get('consultation_count', 0)}
- Gns. rating: {uc.get('avg_rating', 'N/A')}
- Dage siden signup: {uc.get('days_since_signup', 'N/A')}
- Sidst aktiv: {uc.get('last_active_at', 'N/A')}"""

    # Build feedback block
    feedback_block = ""
    if feedback:
        lines = []
        for fb in feedback[:10]:
            rating = fb.get("rating", "?")
            comment = fb.get("comment", "")
            sentiment = fb.get("sentiment", "")
            date = fb.get("created_at", "")[:10]
            lines.append(f"  - [{date}] Rating: {rating}, Sentiment: {sentiment}, Kommentar: \"{comment}\"")
        feedback_block = f"\nSENESTE FEEDBACK ({len(feedback)} reviews):\n" + "\n".join(lines)

    # Build tickets block
    tickets_block = ""
    if tickets:
        lines = []
        for tk in tickets[:5]:
            subj = tk.get("subject", "")
            status = tk.get("status", "")
            date = tk.get("created_at", "")[:10]
            lines.append(f"  - [{date}] \"{subj}\" (status: {status})")
        tickets_block = f"\nSENESTE TICKETS ({len(tickets)} tickets):\n" + "\n".join(lines)

    # Build target feedback block
    target_block = ""
    if target_feedback:
        target_block = f"""\nSPECIFIK FEEDBACK AT FØLGE OP PÅ:
  Rating: {target_feedback.get('rating', '?')}, Sentiment: {target_feedback.get('sentiment', '')}
  Kommentar: \"{target_feedback.get('comment', '')}\"
  Dato: {target_feedback.get('created_at', '')[:10]}"""

    user_prompt = f"""{user_block}
{feedback_block}
{tickets_block}
{target_block}

CS-AGENTENS INSTRUKTION:
{prompt if prompt else 'Generel opfølgning'}

Generér et JSON-objekt med "subject" og "body" for en professionel outbound-besked:"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=600,
            temperature=0.7,
        )
        content = response.choices[0].message.content.strip()

        # Try to parse JSON from the response
        try:
            result = json.loads(content)
            if "subject" in result and "body" in result:
                return result
        except json.JSONDecodeError:
            pass

        # Fallback: try to extract JSON from markdown code block
        if "```" in content:
            json_match = content.split("```")[1]
            if json_match.startswith("json"):
                json_match = json_match[4:]
            try:
                result = json.loads(json_match.strip())
                if "subject" in result and "body" in result:
                    return result
            except json.JSONDecodeError:
                pass

        # Last resort: return raw content as body
        first_name = uc.get("name", "").split()[0] if uc.get("name") else ""
        return {
            "subject": f"Opfølgning — {uc.get('clinic_name', '')}",
            "body": content,
        }

    except Exception as e:
        logger.error(f"OpenAI API error (contact draft): {e}")
        return None


# ── Marketing Email Generation ─────────────────────────────────────────

def _get_marketing_system_prompt() -> str:
    """Get the marketing AI system prompt from database settings."""
    try:
        from .database import query
        rows = query("SELECT value FROM app_settings WHERE key = 'marketing_ai_prompt'")
        if rows and rows[0].get("value"):
            return rows[0]["value"]
    except Exception:
        pass
    # Fallback default
    return """Du er en professionel email-forfatter for People's Clinic, en dansk digital sundhedsplatform der bruger AI til at opsummere læge-patient samtaler.

REGLER:
- Skriv ALTID på dansk
- Vær varm, professionel og empatisk — aldrig sælgende eller pushy
- Personaliser baseret på brugerens data (navn, klinik, speciale, aktivitet)
- Hold emailen kort (3-5 afsnit, max 150 ord)
- Giv ALDRIG medicinsk rådgivning eller diagnosticering
- Nævn aldrig patientdata eller specifik patientinformation
- Henvis til platformen for konkret sundhedsrådgivning
- Start med "Hej [fornavn],"
- Afslut med "Med venlig hilsen,\\nPeople's Clinic Teamet"
- SVAR KUN med et JSON-objekt: {"subject": "...", "body_html": "..."}
- body_html: brug simple HTML tags (<p>, <br>, <strong>) — INGEN inline styles
- Subject: max 60 tegn, relevant og engagerende"""


def generate_marketing_email(
    user_context: dict,
    brief: str,
    subject_hint: str = "",
) -> dict | None:
    """Generate a personalized marketing email from a CS team brief.

    Returns {"subject": "...", "body_html": "..."} or None.
    """
    client = _get_client()
    if not client:
        return None

    system_prompt = _get_marketing_system_prompt()

    uc = user_context
    user_block = f"""BRUGER KONTEKST:
- Navn: {uc.get('name', 'Ukendt')}
- Klinik: {uc.get('clinic_name', 'Ukendt')}
- Speciale: {uc.get('speciale', 'Ukendt')}
- Status: {uc.get('status', 'Ukendt')}
- Plan: {uc.get('plan', 'Ukendt')}
- Health score: {uc.get('health_score', 'N/A')}/100
- Konsultationer total: {uc.get('consultation_count', 0)}
- Gns. rating: {uc.get('avg_rating', 'N/A')}
- Dage siden signup: {uc.get('days_since_signup', 'N/A')}
- Sidst aktiv: {uc.get('last_active_at', 'Ukendt')}
- Seneste feedback: {uc.get('latest_feedback', 'Ingen')}
- Onboarding-trin nået: {uc.get('onboarding_stages', 'Ukendt')}"""

    user_prompt = f"""{user_block}

BRIEF (hvad emailen skal kommunikere):
{brief}

{f'EMNE-HINT: {subject_hint}' if subject_hint else ''}

Generér et JSON-objekt med "subject" og "body_html":"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=800,
            temperature=0.7,
        )
        content = response.choices[0].message.content.strip()

        # Parse JSON
        try:
            result = json.loads(content)
            if "subject" in result and "body_html" in result:
                return result
        except json.JSONDecodeError:
            pass

        # Fallback: try markdown code block
        if "```" in content:
            json_match = content.split("```")[1]
            if json_match.startswith("json"):
                json_match = json_match[4:]
            try:
                result = json.loads(json_match.strip())
                if "subject" in result and "body_html" in result:
                    return result
            except json.JSONDecodeError:
                pass

        # Last resort
        first_name = uc.get("name", "").split()[0] if uc.get("name") else ""
        return {
            "subject": subject_hint or f"Besked fra People's Clinic",
            "body_html": f"<p>Hej {first_name},</p><p>{content}</p><p>Med venlig hilsen,<br>People's Clinic Teamet</p>",
        }

    except Exception as e:
        logger.error(f"OpenAI API error (marketing email): {e}")
        return None


# ── Ticket Priority Classification ─────────────────────────────────────

def classify_ticket_priority(
    subject: str,
    body: str = "",
) -> dict:
    """Classify a helpdesk ticket's priority and category using AI.

    Analyzes the subject and body to determine appropriate priority
    (urgent/high/medium/low) and category (billing/technical/onboarding/general).

    Returns {"priority": "...", "category": "..."} or defaults on failure.
    """
    client = _get_client()
    if not client:
        return {"priority": "medium", "category": "general"}

    system_prompt = """Du er en helpdesk-triage AI for People's Clinic, en dansk sundhedstech-virksomhed.

Din opgave er at analysere indkommende tickets og klassificere dem.

PRIORITET — vurder ud fra:
- "urgent": Systemnedbrud, datatabsfejl, sikkerhedshændelser, GDPR-brud, produktion nede, flere brugere påvirket
- "high": Kritisk funktionalitet virker ikke, betalingsproblemer, klinik kan ikke arbejde, bruger meget utilfreds
- "medium": Generelle spørgsmål, mindre fejl, feature-forespørgsler, standard onboarding-spørgsmål
- "low": Feedback, forbedringsforslag, kosmetiske fejl, generel information

KATEGORI — vælg den mest passende:
- "technical": Tekniske problemer, fejl, bugs, integration, system, login
- "billing": Fakturering, betaling, priser, abonnement, kontrakt
- "onboarding": Opstart, opsætning, første brug, migration, træning
- "general": Alt andet — generelle spørgsmål, feedback, etc.

SVAR KUN med et JSON-objekt: {"priority": "...", "category": "..."}
Ingen forklaring, kun JSON."""

    user_prompt = f"""Klassificér denne ticket:

EMNE: {subject}
{f'BESKED: {body[:500]}' if body else ''}

JSON:"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=50,
            temperature=0.1,
        )
        content = response.choices[0].message.content.strip()

        try:
            result = json.loads(content)
            priority = result.get("priority", "medium")
            category = result.get("category", "general")

            # Validate values
            if priority not in ("urgent", "high", "medium", "low"):
                priority = "medium"
            if category not in ("technical", "billing", "onboarding", "general"):
                category = "general"

            return {"priority": priority, "category": category}
        except json.JSONDecodeError:
            pass

        # Fallback: try markdown code block
        if "```" in content:
            json_match = content.split("```")[1]
            if json_match.startswith("json"):
                json_match = json_match[4:]
            try:
                result = json.loads(json_match.strip())
                return {
                    "priority": result.get("priority", "medium"),
                    "category": result.get("category", "general"),
                }
            except json.JSONDecodeError:
                pass

        return {"priority": "medium", "category": "general"}

    except Exception as e:
        logger.error(f"OpenAI API error (classify ticket): {e}")
        return {"priority": "medium", "category": "general"}
