"""DPA Routes — Databehandleraftale sending, signing & management."""

import secrets
import base64
import io
import csv
import zipfile
from datetime import datetime, timedelta
from fastapi import APIRouter, UploadFile, File, Form, Request
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id

router = APIRouter()

BASE_URL = "https://csm-production.up.railway.app"


# ── Models ──

class DPASendRequest(BaseModel):
    customer_id: str
    language: str = "da"  # "da" or "en"


class DPAManualSendRequest(BaseModel):
    name: str
    email: str
    company: str = ""
    language: str = "da"


class DPABulkSendRequest(BaseModel):
    customer_ids: list[str]
    language: str = "da"


class DPASignRequest(BaseModel):
    signer_name: str
    signer_email: str
    signer_title: str = ""


# ── Document Management ──

@router.get("/documents")
def list_documents():
    """List all DPA document versions."""
    docs = query("""
        SELECT id, version, language, filename, uploaded_by, is_current, created_at,
               length(pdf_data) as file_size
        FROM dpa_documents
        ORDER BY version DESC, language ASC
    """)
    return docs


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    version: int = Form(...),
    language: str = Form("da"),
    uploaded_by: str = Form(""),
):
    """Upload a new DPA PDF document."""
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        return {"error": "Kun PDF-filer er tilladt"}

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 10 * 1024 * 1024:  # 10 MB max
        return {"error": "Filen er for stor (max 10 MB)"}

    doc_id = gen_id("dpd_")

    # Mark old documents of same language as not current
    execute("""
        UPDATE dpa_documents SET is_current = false
        WHERE language = %s AND is_current = true
    """, (language,))

    # Insert new document with BYTEA PDF data
    try:
        from ..database import get_conn
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO dpa_documents (id, version, language, filename, pdf_data, uploaded_by, is_current)
                   VALUES (%s, %s, %s, %s, %s, %s, true)
                   ON CONFLICT (version, language) DO UPDATE SET
                       pdf_data = EXCLUDED.pdf_data,
                       filename = EXCLUDED.filename,
                       uploaded_by = EXCLUDED.uploaded_by,
                       is_current = true,
                       created_at = NOW()
                   RETURNING id, version, language, filename, uploaded_by, is_current, created_at""",
                (doc_id, version, language, file.filename, pdf_bytes, uploaded_by),
            )
            row = cur.fetchone()
        return dict(row) if row else {"ok": True, "id": doc_id}
    except Exception as e:
        return {"error": f"Database-fejl ved upload: {str(e)}"}


@router.get("/documents/{doc_id}/download")
def download_document(doc_id: str):
    """Download a DPA PDF (internal use)."""
    from ..database import get_conn
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT filename, pdf_data FROM dpa_documents WHERE id = %s", (doc_id,))
        row = cur.fetchone()
    if not row or not row['pdf_data']:
        return Response(content="Not found", status_code=404)

    pdf_bytes = bytes(row['pdf_data'])
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=\"{row['filename']}\""}
    )


@router.post("/documents/{doc_id}/set-current")
def set_current_document(doc_id: str):
    """Set a document version as the current one."""
    docs = query("SELECT id, language FROM dpa_documents WHERE id = %s", (doc_id,))
    if not docs:
        return {"error": "Dokument ikke fundet"}

    lang = docs[0]['language']

    # Unset all current for this language
    execute("UPDATE dpa_documents SET is_current = false WHERE language = %s", (lang,))
    # Set this one as current
    execute("UPDATE dpa_documents SET is_current = true WHERE id = %s", (doc_id,))

    return {"ok": True}


# ── Pending & History ──

@router.get("/pending")
def list_pending_customers():
    """List all pending DPA signings (both customer-linked and manual)."""
    signings = query("""
        SELECT s.id, s.customer_id, s.status, s.sent_at, s.language,
               s.recipient_name, s.recipient_email, s.recipient_company,
               s.reminder_count, s.cs_notified, s.token,
               COALESCE(s.recipient_name, c.name) as display_name,
               COALESCE(s.recipient_email, c.contact_email) as display_email,
               COALESCE(s.recipient_company, '') as display_company,
               d.version as document_version
        FROM dpa_signings s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN dpa_documents d ON s.document_id = d.id
        WHERE s.status = 'pending' AND s.is_archived = false
        ORDER BY s.sent_at DESC
    """)
    return signings


@router.get("/history")
def list_signing_history():
    """List all DPA signings with full audit info."""
    history = query("""
        SELECT s.*,
               COALESCE(NULLIF(s.recipient_name, ''), c.name) as customer_name,
               COALESCE(NULLIF(s.recipient_email, ''), c.contact_email) as customer_email,
               COALESCE(NULLIF(s.recipient_company, ''), c.name) as customer_company,
               d.version as document_version, d.filename as document_filename
        FROM dpa_signings s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN dpa_documents d ON s.document_id = d.id
        WHERE s.is_archived = false
        ORDER BY s.sent_at DESC
    """)
    return history


@router.get("/stats")
def get_dpa_stats():
    """Dashboard stats for DPA overview."""
    stats = query("""
        SELECT
            (SELECT COUNT(*) FROM dpa_signings WHERE status = 'pending' AND is_archived = false) as pending_count,
            (SELECT COUNT(*) FROM dpa_signings WHERE status = 'signed' AND is_archived = false) as signed_count,
            (SELECT COUNT(*) FROM dpa_signings WHERE status = 'expired' AND is_archived = false) as expired_count,
            (SELECT COUNT(*) FROM dpa_signings WHERE status = 'pending' AND cs_notified = true AND is_archived = false) as needs_attention_count,
            (SELECT COUNT(*) FROM dpa_signings WHERE is_archived = false) as total_sent
    """)
    return stats[0] if stats else {}


@router.delete("/signings/{signing_id}")
def archive_signing(signing_id: str):
    """Soft-delete (archive) a signing. Data is preserved but hidden from lists."""
    signings = query("SELECT id, status FROM dpa_signings WHERE id = %s", (signing_id,))
    if not signings:
        return {"error": "Signing ikke fundet"}

    execute("UPDATE dpa_signings SET is_archived = true WHERE id = %s", (signing_id,))
    return {"ok": True}


@router.get("/audit-log")
def get_audit_log():
    """Full audit log for Datatilsynet compliance."""
    log = query("""
        SELECT s.id, s.customer_id, s.status, s.signer_name, s.signer_email, s.signer_title,
               s.ip_address, s.user_agent, s.sent_at, s.signed_at, s.sent_by,
               s.reminder_count, s.language,
               c.name as customer_name,
               d.version as document_version, d.filename as document_filename
        FROM dpa_signings s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN dpa_documents d ON s.document_id = d.id
        ORDER BY COALESCE(s.signed_at, s.sent_at) DESC
    """)
    return log


@router.get("/audit-log/csv")
def export_audit_csv():
    """Export audit log as CSV for Datatilsynet."""
    log = query("""
        SELECT s.id, c.name as customer_name, s.signer_name, s.signer_email, s.signer_title,
               s.status, s.language, d.version as document_version, d.filename,
               s.ip_address, s.user_agent, s.sent_at, s.signed_at, s.sent_by
        FROM dpa_signings s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN dpa_documents d ON s.document_id = d.id
        ORDER BY s.sent_at DESC
    """)

    import csv
    import io
    output = io.StringIO()
    if log:
        writer = csv.DictWriter(output, fieldnames=log[0].keys())
        writer.writeheader()
        writer.writerows(log)

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=\"dpa_audit_log.csv\""}
    )


@router.get("/export-zip")
def export_compliance_zip():
    """Export all signed DBAs + certificates + audit CSV as ZIP for Datatilsynet."""
    signings = query("""
        SELECT s.id, s.token, s.status, s.signer_name, s.signer_email, s.signer_title,
               s.ip_address, s.user_agent, s.sent_at, s.signed_at, s.sent_by,
               s.language, s.reminder_count,
               COALESCE(c.name, s.recipient_company, s.recipient_name) as customer_name,
               d.version as document_version, d.filename as document_filename, d.pdf_data
        FROM dpa_signings s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN dpa_documents d ON s.document_id = d.id
        WHERE s.is_archived = false
        ORDER BY s.signed_at DESC NULLS LAST
    """)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add each signed DBA's PDF
        for s in signings:
            if s.get("pdf_data") and s["status"] == "signed":
                safe_name = (s.get("customer_name") or "unknown").replace("/", "-").replace("\\", "-")
                pdf_bytes = bytes(s["pdf_data"]) if isinstance(s["pdf_data"], memoryview) else s["pdf_data"]
                zf.writestr(f"pdf/{safe_name}_v{s.get('document_version', '?')}.pdf", pdf_bytes)

        # Add signing certificate PDFs for each signed DBA
        for s in signings:
            if s["status"] == "signed":
                try:
                    is_en = s.get('language') == 'en'
                    safe_name = (s.get("customer_name") or "unknown").replace("/", "-").replace("\\", "-")
                    # Build certificate PDF inline
                    lang_label = "English" if is_en else "Dansk"
                    display_name = s.get('customer_name', '')
                    company_label = s.get('customer_name', '')
                    signed_at = s.get('signed_at', '')
                    if isinstance(signed_at, str) and signed_at:
                        try:
                            dt = datetime.fromisoformat(signed_at)
                            signed_at_fmt = dt.strftime("%d %B %Y, %H:%M:%S") if is_en else dt.strftime("%d. %B %Y, kl. %H:%M:%S")
                        except Exception:
                            signed_at_fmt = str(signed_at)
                    else:
                        signed_at_fmt = str(signed_at)

                    if is_en:
                        labels = ("Data Processing Agreement", "Document", "Company", "Language", "Signature", "Signer", "Title / Role", "Signed", "Not specified", "Audit Information", "IP Address", "Browser",
                                  f"This certificate confirms that the above person has digitally signed the data processing agreement on behalf of {display_name}.")
                    else:
                        labels = ("Databehandleraftale", "Dokument", "Virksomhed", "Sprog", "Underskrift", "Underskriver", "Titel / Rolle", "Underskrevet", "Ikke angivet", "Audit Information", "IP-adresse", "Browser",
                                  f"Dette certifikat bekræfter at ovenstående person digitalt har underskrevet databehandleraftalen på vegne af {display_name}.")

                    cert_resp = _build_certificate_pdf(s, is_en, labels[0], company_label, lang_label, signed_at_fmt,
                                                        labels[1], labels[2], labels[3], labels[4], labels[5], labels[6],
                                                        labels[7], labels[8], labels[9], labels[10], labels[11], labels[12], display_name)
                    zf.writestr(f"certificates/{safe_name}_certificate.pdf", cert_resp.body)
                except Exception:
                    pass  # Skip certificate if generation fails

        # Add audit CSV
        csv_buf = io.StringIO()
        fieldnames = ["id", "customer_name", "signer_name", "signer_email", "signer_title",
                       "status", "language", "document_version", "document_filename",
                       "ip_address", "user_agent", "sent_at", "signed_at", "sent_by"]
        writer = csv.DictWriter(csv_buf, fieldnames=fieldnames)
        writer.writeheader()
        for s in signings:
            writer.writerow({k: s.get(k, "") for k in fieldnames})
        zf.writestr("audit_log.csv", csv_buf.getvalue())

    today = datetime.now().strftime("%Y-%m-%d")
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=\"DBA_compliance_{today}.zip\""}
    )


# ── Send DPA ──

@router.post("/send")
def send_dpa(data: DPASendRequest):
    """Send DPA signing link to a customer."""
    # Verify customer exists
    customers = query("SELECT * FROM customers WHERE id = %s", (data.customer_id,))
    if not customers:
        return {"error": "Kunde ikke fundet"}

    customer = customers[0]
    if not customer.get('contact_email'):
        return {"error": "Kunden har ingen email-adresse"}

    # Find current DPA document for the requested language
    docs = query("""
        SELECT id, version, filename FROM dpa_documents
        WHERE language = %s AND is_current = true
        LIMIT 1
    """, (data.language,))

    if not docs:
        return {"error": f"Ingen aktuel databehandleraftale fundet for sprog: {data.language}"}

    doc = docs[0]

    # Generate secure token
    token = secrets.token_urlsafe(32)
    signing_id = gen_id("dps_")

    # Create signing record
    execute("""
        INSERT INTO dpa_signings (id, customer_id, document_id, token, language, status, sent_by, expires_at)
        VALUES (%s, %s, %s, %s, %s, 'pending', '', NOW() + INTERVAL '30 days')
    """, (signing_id, data.customer_id, doc['id'], token, data.language))

    # Send email
    signing_url = f"{BASE_URL}/dpa/{token}"
    lang_label = "dansk" if data.language == "da" else "engelsk"

    email_html = f"""
        <p>Hej {customer.get('contact_name') or customer.get('name', '')},</p>

        <p>Vi sender hermed vores databehandleraftale, som vi beder dig genneml\u00e6se og underskrive digitalt.</p>

        <p>Databehandleraftalen sikrer, at behandlingen af persondata mellem dig og People's Doctor sker i overensstemmelse med GDPR.</p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; width: 100%;">
            <tr>
                <td style="background: #4f5fa3; border-radius: 8px; text-align: center; padding: 16px 32px;">
                    <a href="{signing_url}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                        L\u00e6s og underskriv databehandleraftale
                    </a>
                </td>
            </tr>
        </table>

        <p style="font-size: 13px; color: #6b7280;">
            Dokumentet er p\u00e5 {lang_label} (version {doc['version']}).<br>
            Linket udl\u00f8ber om 30 dage.
        </p>

        <p>Har du sp\u00f8rgsm\u00e5l, er du velkommen til at kontakte os.</p>

        <p>Med venlig hilsen,<br>People's Doctor Teamet</p>
    """

    from ..gmail import send_email
    result = send_email(
        to=customer['contact_email'],
        subject="Databehandleraftale \u2014 People's Doctor",
        body_html=email_html,
        use_template=True,
    )

    if result:
        return {"ok": True, "signing_id": signing_id, "token": token}
    else:
        return {"error": "Kunne ikke sende email. Tjek Gmail-forbindelsen."}


@router.post("/send-manual")
def send_dpa_manual(data: DPAManualSendRequest):
    """Send DPA signing link to any email — no customer record required."""
    if not data.email or not data.name:
        return {"error": "Navn og email er påkrævet"}

    # Find current DPA document for the requested language
    docs = query("""
        SELECT id, version, filename FROM dpa_documents
        WHERE language = %s AND is_current = true
        LIMIT 1
    """, (data.language,))

    if not docs:
        return {"error": f"Ingen aktuel databehandleraftale fundet for sprog: {data.language}"}

    doc = docs[0]

    # Check if there's already a pending signing for this email
    existing = query("""
        SELECT id FROM dpa_signings
        WHERE recipient_email = %s AND status = 'pending'
        LIMIT 1
    """, (data.email,))
    if existing:
        return {"error": "Der er allerede en afventende databehandleraftale for denne email"}

    # Generate secure token
    token = secrets.token_urlsafe(32)
    signing_id = gen_id("dps_")

    # Create signing record (customer_id is NULL for manual sends)
    execute("""
        INSERT INTO dpa_signings (id, document_id, token, language, status, sent_by,
                                  recipient_name, recipient_email, recipient_company,
                                  expires_at)
        VALUES (%s, %s, %s, %s, 'pending', '', %s, %s, %s, NOW() + INTERVAL '30 days')
    """, (signing_id, doc['id'], token, data.language,
          data.name, data.email, data.company or None))

    # Send email
    signing_url = f"{BASE_URL}/dpa/{token}"
    lang_label = "dansk" if data.language == "da" else "engelsk"

    email_html = f"""
        <p>Hej {data.name},</p>

        <p>Vi sender hermed vores databehandleraftale, som vi beder dig genneml\u00e6se og underskrive digitalt.</p>

        <p>Databehandleraftalen sikrer, at behandlingen af persondata mellem dig og People's Doctor sker i overensstemmelse med GDPR.</p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; width: 100%;">
            <tr>
                <td style="background: #4f5fa3; border-radius: 8px; text-align: center; padding: 16px 32px;">
                    <a href="{signing_url}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                        L\u00e6s og underskriv databehandleraftale
                    </a>
                </td>
            </tr>
        </table>

        <p style="font-size: 13px; color: #6b7280;">
            Dokumentet er p\u00e5 {lang_label} (version {doc['version']}).<br>
            Linket udl\u00f8ber om 30 dage.
        </p>

        <p>Har du sp\u00f8rgsm\u00e5l, er du velkommen til at kontakte os.</p>

        <p>Med venlig hilsen,<br>People's Doctor Teamet</p>
    """

    from ..gmail import send_email
    result = send_email(
        to=data.email,
        subject="Databehandleraftale \u2014 People's Doctor",
        body_html=email_html,
        use_template=True,
    )

    if result:
        return {"ok": True, "signing_id": signing_id, "token": token}
    else:
        return {"error": "Kunne ikke sende email. Tjek Gmail-forbindelsen."}


@router.post("/send-bulk")
def send_dpa_bulk(data: DPABulkSendRequest):
    """Send DPA to multiple customers."""
    sent = 0
    errors = []

    for cid in data.customer_ids:
        result = send_dpa(DPASendRequest(customer_id=cid, language=data.language))
        if isinstance(result, dict) and result.get('ok'):
            sent += 1
        else:
            err = result.get('error', 'Ukendt fejl') if isinstance(result, dict) else 'Fejl'
            errors.append(f"{cid}: {err}")

    return {"sent": sent, "errors": errors, "total": len(data.customer_ids)}


@router.post("/send-reminder/{signing_id}")
def send_reminder(signing_id: str):
    """Resend a reminder for a pending DPA signing."""
    signings = query("""
        SELECT s.*, c.contact_name, c.contact_email, c.name as customer_name,
               d.version as document_version
        FROM dpa_signings s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN dpa_documents d ON s.document_id = d.id
        WHERE s.id = %s
    """, (signing_id,))

    if not signings:
        return {"error": "Signing ikke fundet"}

    signing = signings[0]
    if signing['status'] != 'pending':
        return {"error": "Databehandleraftalen er allerede underskrevet eller udl\u00f8bet"}

    signing_url = f"{BASE_URL}/dpa/{signing['token']}"

    # Resolve name and email (support both customer-linked and manual sends)
    recipient_name = signing.get('recipient_name') or signing.get('contact_name') or signing.get('customer_name', '')
    recipient_email = signing.get('recipient_email') or signing.get('contact_email')

    if not recipient_email:
        return {"error": "Ingen email-adresse fundet for denne databehandleraftale"}

    email_html = f"""
        <p>Hej {recipient_name},</p>

        <p>Vi minder venligt om, at din databehandleraftale med People's Doctor stadig afventer din underskrift.</p>

        <p>For at vi kan forts\u00e6tte samarbejdet i overensstemmelse med GDPR, beder vi dig venligst underskrive aftalen hurtigst muligt.</p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; width: 100%;">
            <tr>
                <td style="background: #4f5fa3; border-radius: 8px; text-align: center; padding: 16px 32px;">
                    <a href="{signing_url}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                        L\u00e6s og underskriv databehandleraftale
                    </a>
                </td>
            </tr>
        </table>

        <p>Med venlig hilsen,<br>People's Doctor Teamet</p>
    """

    from ..gmail import send_email
    result = send_email(
        to=recipient_email,
        subject="P\u00e5mindelse: Databehandleraftale afventer underskrift",
        body_html=email_html,
        use_template=True,
    )

    if result:
        execute("""
            UPDATE dpa_signings
            SET reminder_count = reminder_count + 1, last_reminder_at = NOW()
            WHERE id = %s
        """, (signing_id,))
        return {"ok": True}
    else:
        return {"error": "Kunne ikke sende p\u00e5mindelse"}


# ── Public Endpoints (no auth) ──

@router.get("/{token}")
def get_signing_info(token: str):
    """Public: Get DPA signing info by token."""
    signings = query("""
        SELECT s.id, s.status, s.language, s.signer_name, s.signer_email, s.signer_title,
               s.signed_at, s.expires_at,
               COALESCE(NULLIF(s.recipient_name, ''), c.contact_name, c.name) as contact_name,
               COALESCE(c.name, NULLIF(s.recipient_company, ''), NULLIF(s.recipient_name, '')) as customer_name,
               d.id as document_id, d.version as document_version, d.filename
        FROM dpa_signings s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN dpa_documents d ON s.document_id = d.id
        WHERE s.token = %s
    """, (token,))

    if not signings:
        return {"error": "Ugyldigt link", "status_code": 404}

    signing = signings[0]

    # Check expiry
    if signing.get('expires_at'):
        expires = datetime.fromisoformat(signing['expires_at']) if isinstance(signing['expires_at'], str) else signing['expires_at']
        if datetime.now(expires.tzinfo) > expires and signing['status'] == 'pending':
            execute("UPDATE dpa_signings SET status = 'expired' WHERE token = %s", (token,))
            signing['status'] = 'expired'

    return signing


@router.get("/{token}/pdf")
def get_signing_pdf(token: str):
    """Public: Download the DPA PDF for a signing."""
    signings = query("""
        SELECT s.document_id, s.status, s.expires_at
        FROM dpa_signings s
        WHERE s.token = %s
    """, (token,))

    if not signings:
        return Response(content="Ikke fundet", status_code=404)

    signing = signings[0]

    # Check expiry
    if signing.get('expires_at'):
        expires = datetime.fromisoformat(signing['expires_at']) if isinstance(signing['expires_at'], str) else signing['expires_at']
        if datetime.now(expires.tzinfo) > expires and signing['status'] == 'pending':
            return Response(content="Linket er udl\u00f8bet", status_code=410)

    from ..database import get_conn
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT filename, pdf_data FROM dpa_documents WHERE id = %s", (signing['document_id'],))
        row = cur.fetchone()

    if not row or not row['pdf_data']:
        return Response(content="Dokument ikke fundet", status_code=404)

    pdf_bytes = bytes(row['pdf_data'])
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=\"{row['filename']}\""}
    )


@router.post("/{token}/sign")
def sign_dpa(token: str, data: DPASignRequest, request: Request):
    """Public: Submit DPA signature."""
    signings = query("""
        SELECT s.*, c.id as cust_id, c.name as customer_name, c.contact_email,
               d.version as document_version, d.filename
        FROM dpa_signings s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN dpa_documents d ON s.document_id = d.id
        WHERE s.token = %s
    """, (token,))

    if not signings:
        return {"error": "Ugyldigt link"}

    signing = signings[0]

    if signing['status'] == 'signed':
        return {"error": "Databehandleraftalen er allerede underskrevet", "already_signed": True}

    if signing['status'] == 'expired':
        return {"error": "Linket er udl\u00f8bet. Kontakt People's Doctor for et nyt link."}

    # Check expiry
    if signing.get('expires_at'):
        expires = datetime.fromisoformat(signing['expires_at']) if isinstance(signing['expires_at'], str) else signing['expires_at']
        if datetime.now(expires.tzinfo) > expires:
            execute("UPDATE dpa_signings SET status = 'expired' WHERE token = %s", (token,))
            return {"error": "Linket er udl\u00f8bet. Kontakt People's Doctor for et nyt link."}

    # Get client IP and user agent
    client_ip = request.client.host if request.client else ""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    user_agent = request.headers.get("user-agent", "")

    # Update signing record
    execute("""
        UPDATE dpa_signings
        SET status = 'signed',
            signer_name = %s,
            signer_email = %s,
            signer_title = %s,
            ip_address = %s,
            user_agent = %s,
            signed_at = NOW()
        WHERE token = %s
    """, (data.signer_name, data.signer_email, data.signer_title, client_ip, user_agent, token))

    # Update customer DPA status
    execute("""
        UPDATE customers
        SET dpa_signed = true, dpa_signed_at = CURRENT_DATE
        WHERE id = %s
    """, (signing['cust_id'],))

    # Send confirmation email
    _send_confirmation_email(signing, data)

    return {
        "ok": True,
        "signed_at": datetime.now().isoformat(),
        "signer_name": data.signer_name,
        "document_version": signing.get('document_version'),
    }


@router.get("/{token}/certificate")
def get_signing_certificate(token: str, request: Request):
    """Public: Get signing certificate (audit receipt) as HTML."""
    signings = query("""
        SELECT s.*, c.name as customer_name,
               d.version as document_version, d.filename as document_filename, d.language as doc_language
        FROM dpa_signings s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN dpa_documents d ON s.document_id = d.id
        WHERE s.token = %s AND s.status = 'signed'
    """, (token,))

    if not signings:
        return {"error": "Ingen underskrevet databehandleraftale fundet"}

    s = signings[0]
    is_en = s.get('language') == 'en'
    lang_label = "English" if is_en else "Dansk"
    display_name = s.get('customer_name') or s.get('recipient_company') or s.get('recipient_name') or ''
    company_label = s.get('recipient_company') or s.get('customer_name') or ''

    signed_at = s.get('signed_at', '')
    if isinstance(signed_at, str) and signed_at:
        try:
            dt = datetime.fromisoformat(signed_at)
            signed_at_formatted = dt.strftime("%d %B %Y, %H:%M:%S") if is_en else dt.strftime("%d. %B %Y, kl. %H:%M:%S")
        except Exception:
            signed_at_formatted = signed_at
    else:
        signed_at_formatted = str(signed_at)

    # i18n labels
    if is_en:
        doc_title = "Data Processing Agreement"
        lbl_doc = "Document"
        lbl_company = "Company"
        lbl_language = "Language"
        lbl_sig = "Signature"
        lbl_signer = "Signer"
        lbl_title = "Title / Role"
        lbl_signed = "Signed"
        lbl_not_specified = "Not specified"
        lbl_audit = "Audit Information"
        lbl_ip = "IP Address"
        lbl_browser = "Browser"
        footer_text = f"This certificate confirms that the above person has digitally signed the data processing agreement on behalf of {display_name}."
    else:
        doc_title = "Databehandleraftale"
        lbl_doc = "Dokument"
        lbl_company = "Virksomhed"
        lbl_language = "Sprog"
        lbl_sig = "Underskrift"
        lbl_signer = "Underskriver"
        lbl_title = "Titel / Rolle"
        lbl_signed = "Underskrevet"
        lbl_not_specified = "Ikke angivet"
        lbl_audit = "Audit Information"
        lbl_ip = "IP-adresse"
        lbl_browser = "Browser"
        footer_text = f"Dette certifikat bekr\u00e6fter at ovenst\u00e5ende person digitalt har underskrevet databehandleraftalen p\u00e5 vegne af {display_name}."

    html = f"""<!DOCTYPE html>
<html lang="{'en' if is_en else 'da'}">
<head>
    <meta charset="UTF-8">
    <title>Signing Certificate — {doc_title}</title>
    <style>
        body {{ font-family: 'Inter', -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #26304f; }}
        .cert-header {{ text-align: center; border-bottom: 2px solid #4f5fa3; padding-bottom: 20px; margin-bottom: 30px; }}
        .cert-header h1 {{ color: #4f5fa3; font-size: 24px; margin: 0; }}
        .cert-header p {{ color: #6b7280; margin: 8px 0 0; }}
        .cert-section {{ margin-bottom: 24px; }}
        .cert-section h3 {{ color: #4f5fa3; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }}
        .cert-row {{ display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }}
        .cert-label {{ width: 200px; font-weight: 600; color: #374151; }}
        .cert-value {{ flex: 1; color: #4b5563; }}
        .cert-footer {{ margin-top: 40px; padding-top: 20px; border-top: 2px solid #4f5fa3; text-align: center; color: #9ca3af; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="cert-header">
        <h1>Signing Certificate</h1>
        <p>{doc_title} &mdash; People's Doctor</p>
    </div>

    <div class="cert-section">
        <h3>{lbl_doc}</h3>
        <div class="cert-row"><span class="cert-label">{lbl_company}</span><span class="cert-value">{company_label}</span></div>
        <div class="cert-row"><span class="cert-label">{lbl_doc}</span><span class="cert-value">{s.get('document_filename', '')} (v{s.get('document_version', '')})</span></div>
        <div class="cert-row"><span class="cert-label">{lbl_language}</span><span class="cert-value">{lang_label}</span></div>
    </div>

    <div class="cert-section">
        <h3>{lbl_sig}</h3>
        <div class="cert-row"><span class="cert-label">{lbl_signer}</span><span class="cert-value">{s.get('signer_name', '')}</span></div>
        <div class="cert-row"><span class="cert-label">Email</span><span class="cert-value">{s.get('signer_email', '')}</span></div>
        <div class="cert-row"><span class="cert-label">{lbl_title}</span><span class="cert-value">{s.get('signer_title', '') or lbl_not_specified}</span></div>
        <div class="cert-row"><span class="cert-label">{lbl_signed}</span><span class="cert-value">{signed_at_formatted}</span></div>
    </div>

    <div class="cert-section">
        <h3>{lbl_audit}</h3>
        <div class="cert-row"><span class="cert-label">{lbl_ip}</span><span class="cert-value">{s.get('ip_address', '')}</span></div>
        <div class="cert-row"><span class="cert-label">{lbl_browser}</span><span class="cert-value">{s.get('user_agent', '')[:100]}</span></div>
        <div class="cert-row"><span class="cert-label">Signing ID</span><span class="cert-value">{s.get('id', '')}</span></div>
    </div>

    <div class="cert-footer">
        <p>{footer_text}</p>
        <p>Generated by People's Doctor &mdash; SynergyHub</p>
    </div>
</body>
</html>"""

    fmt = request.query_params.get('format', 'html')
    if fmt == 'pdf':
        return _build_certificate_pdf(s, is_en, doc_title, company_label, lang_label, signed_at_formatted, lbl_doc, lbl_company, lbl_language, lbl_sig, lbl_signer, lbl_title, lbl_signed, lbl_not_specified, lbl_audit, lbl_ip, lbl_browser, footer_text, display_name)
    return Response(content=html, media_type="text/html")


def _build_certificate_pdf(s, is_en, doc_title, company_label, lang_label, signed_at_formatted,
                            lbl_doc, lbl_company, lbl_language, lbl_sig, lbl_signer, lbl_title,
                            lbl_signed, lbl_not_specified, lbl_audit, lbl_ip, lbl_browser,
                            footer_text, display_name):
    """Generate a professional PDF signing certificate."""
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)

    # Colors
    navy = (79, 95, 163)
    dark = (55, 65, 81)
    gray = (75, 85, 99)
    light_gray = (156, 163, 175)
    line_color = (229, 231, 235)

    # Header
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*navy)
    pdf.cell(0, 12, "Signing Certificate", ln=True, align="C")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*gray)
    pdf.cell(0, 8, f"{doc_title} - People's Doctor", ln=True, align="C")

    # Header line
    pdf.ln(4)
    pdf.set_draw_color(*navy)
    pdf.set_line_width(0.6)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(10)

    def section_header(title):
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*navy)
        pdf.cell(0, 8, title.upper(), ln=True)
        pdf.ln(2)

    def row(label, value):
        y = pdf.get_y()
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*dark)
        pdf.cell(55, 7, label)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*gray)
        pdf.cell(0, 7, str(value or ''), ln=True)
        pdf.set_draw_color(*line_color)
        pdf.set_line_width(0.2)
        pdf.line(20, pdf.get_y() + 1, 190, pdf.get_y() + 1)
        pdf.ln(3)

    # Document section
    section_header(lbl_doc)
    row(lbl_company, company_label)
    row(lbl_doc, f"{s.get('document_filename', '')} (v{s.get('document_version', '')})")
    row(lbl_language, lang_label)
    pdf.ln(4)

    # Signature section
    section_header(lbl_sig)
    row(lbl_signer, s.get('signer_name', ''))
    row("Email", s.get('signer_email', ''))
    row(lbl_title, s.get('signer_title', '') or lbl_not_specified)
    row(lbl_signed, signed_at_formatted)
    pdf.ln(4)

    # Audit section
    section_header(lbl_audit)
    row(lbl_ip, s.get('ip_address', ''))
    row(lbl_browser, (s.get('user_agent', '') or '')[:80])
    row("Signing ID", s.get('id', ''))
    pdf.ln(8)

    # Footer line
    pdf.set_draw_color(*navy)
    pdf.set_line_width(0.6)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(6)

    # Footer text
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*light_gray)
    pdf.multi_cell(0, 5, footer_text, align="C")
    pdf.ln(2)
    pdf.cell(0, 5, "Generated by People's Doctor - SynergyHub", ln=True, align="C")

    pdf_bytes = pdf.output()
    safe_name = (s.get('recipient_company') or s.get('customer_name') or 'certificate').replace(' ', '_')
    filename = f"signing_certificate_{safe_name}.pdf"

    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ── Helpers ──

def _send_confirmation_email(signing: dict, data: DPASignRequest):
    """Send confirmation email after successful DPA signing."""
    email = data.signer_email or signing.get('contact_email', '')
    if not email:
        return

    cert_url = f"{BASE_URL}/api/dpa/{signing['token']}/certificate"
    company_name = signing.get('customer_name') or signing.get('recipient_company') or signing.get('recipient_name') or ''
    lang = signing.get('language', 'da')
    is_en = lang == 'en'

    if is_en:
        greeting = f"Hi {data.signer_name},"
        intro = "Thank you for signing the data processing agreement with People's Doctor."
        receipt_label = "Receipt:"
        lbl_company = "Company:"
        lbl_doc = f"Document: Data Processing Agreement v{signing.get('document_version', '')} (EN)"
        lbl_signer = f"Signed by: {data.signer_name}"
        lbl_date = f"Date: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        cert_text = "You can view your signing certificate at any time here:"
        closing = "Best regards,<br>The People's Doctor Team"
        subject = "Data processing agreement signed \u2014 confirmation"
    else:
        greeting = f"Hej {data.signer_name},"
        intro = "Tak for at du har underskrevet databehandleraftalen med People's Doctor."
        receipt_label = "Kvittering:"
        lbl_company = "Virksomhed:"
        lbl_doc = f"Dokument: Databehandleraftale v{signing.get('document_version', '')} ({lang.upper()})"
        lbl_signer = f"Underskrevet af: {data.signer_name}"
        lbl_date = f"Dato: {datetime.now().strftime('%d/%m/%Y kl. %H:%M')}"
        cert_text = "Du kan til enhver tid se dit signing certificate her:"
        closing = "Med venlig hilsen,<br>People's Doctor Teamet"
        subject = "Databehandleraftale underskrevet \u2014 bekr\u00e6ftelse"

    email_html = f"""
<p>{greeting}</p>

<p>{intro}</p>

<p><strong>{receipt_label}</strong></p>
<table cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 16px 0; font-size: 15px; color: #4b5563;">
  <tr><td style="padding: 4px 0;">{lbl_company}</td><td style="padding: 4px 0 4px 12px;">{company_name}</td></tr>
  <tr><td style="padding: 4px 0;">{lbl_doc.split(': ')[0]}:</td><td style="padding: 4px 0 4px 12px;">{lbl_doc.split(': ', 1)[1]}</td></tr>
  <tr><td style="padding: 4px 0;">{lbl_signer.split(': ')[0]}:</td><td style="padding: 4px 0 4px 12px;">{lbl_signer.split(': ', 1)[1]}</td></tr>
  <tr><td style="padding: 4px 0;">{lbl_date.split(': ')[0]}:</td><td style="padding: 4px 0 4px 12px;">{lbl_date.split(': ', 1)[1]}</td></tr>
</table>

<p>{cert_text}<br>
<a href="{cert_url}" style="color: #4f5fa3;">{cert_url}</a></p>

<p>{closing}</p>
    """

    from ..gmail import send_email
    send_email(
        to=email,
        subject=subject,
        body_html=email_html,
        use_template=True,
    )


def process_dpa_reminders():
    """Background task: Send automatic reminders and expire old signings.

    Called by scheduler every 2 minutes.
    - After 2 days: Send 1st reminder
    - After 5 days: Send 2nd reminder + notify CS
    - After 30 days: Mark as expired
    """
    from ..gmail import send_email

    # Expire old signings
    execute("""
        UPDATE dpa_signings
        SET status = 'expired'
        WHERE status = 'pending' AND expires_at < NOW()
    """)

    # 1st reminder: 2 days after send, not yet reminded
    pending_2d = query("""
        SELECT s.id, s.token, s.language, s.recipient_name, s.recipient_email,
               c.contact_name, c.contact_email, c.name as customer_name,
               d.version as document_version
        FROM dpa_signings s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN dpa_documents d ON s.document_id = d.id
        WHERE s.status = 'pending'
          AND s.reminder_count = 0
          AND s.sent_at < NOW() - INTERVAL '2 days'
    """)

    for signing in pending_2d:
        email = signing.get('recipient_email') or signing.get('contact_email')
        name = signing.get('recipient_name') or signing.get('contact_name') or signing.get('customer_name', '')
        if not email:
            continue
        signing_url = f"{BASE_URL}/dpa/{signing['token']}"
        is_en = signing.get('language', 'da') == 'en'
        if is_en:
            html = f"""
                <p>Hi {name},</p>
                <p>This is a friendly reminder that your data processing agreement with People's Doctor is awaiting your signature.</p>
                <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; width: 100%;">
                    <tr><td style="background: #4f5fa3; border-radius: 8px; text-align: center; padding: 16px 32px;">
                        <a href="{signing_url}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">Read and sign data processing agreement</a>
                    </td></tr>
                </table>
                <p>Best regards,<br>The People's Doctor Team</p>
            """
            subj = "Reminder: Data processing agreement awaiting signature"
        else:
            html = f"""
                <p>Hej {name},</p>
                <p>Vi minder venligt om, at din databehandleraftale med People's Doctor afventer din underskrift.</p>
                <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; width: 100%;">
                    <tr><td style="background: #4f5fa3; border-radius: 8px; text-align: center; padding: 16px 32px;">
                        <a href="{signing_url}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">Læs og underskriv databehandleraftale</a>
                    </td></tr>
                </table>
                <p>Med venlig hilsen,<br>People's Doctor Teamet</p>
            """
            subj = "Påmindelse: Databehandleraftale afventer"
        result = send_email(to=email, subject=subj, body_html=html, use_template=True)
        if result:
            execute("UPDATE dpa_signings SET reminder_count = 1, last_reminder_at = NOW() WHERE id = %s", (signing['id'],))

    # 2nd reminder: 5 days after send, only 1 reminder sent so far
    pending_5d = query("""
        SELECT s.id, s.token, s.language, s.recipient_name, s.recipient_email,
               c.contact_name, c.contact_email, c.name as customer_name,
               d.version as document_version
        FROM dpa_signings s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN dpa_documents d ON s.document_id = d.id
        WHERE s.status = 'pending'
          AND s.reminder_count = 1
          AND s.sent_at < NOW() - INTERVAL '5 days'
    """)

    for signing in pending_5d:
        email = signing.get('recipient_email') or signing.get('contact_email')
        name = signing.get('recipient_name') or signing.get('contact_name') or signing.get('customer_name', '')
        if not email:
            continue
        signing_url = f"{BASE_URL}/dpa/{signing['token']}"
        is_en = signing.get('language', 'da') == 'en'
        if is_en:
            html = f"""
                <p>Hi {name},</p>
                <p>This is a friendly reminder that your data processing agreement with People's Doctor is still awaiting your signature.</p>
                <p>To continue our collaboration in accordance with GDPR, we kindly ask you to sign the agreement.</p>
                <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; width: 100%;">
                    <tr><td style="background: #4f5fa3; border-radius: 8px; text-align: center; padding: 16px 32px;">
                        <a href="{signing_url}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">Sign data processing agreement now</a>
                    </td></tr>
                </table>
                <p>Best regards,<br>The People's Doctor Team</p>
            """
            subj = "Final reminder: Data processing agreement awaiting signature"
        else:
            html = f"""
                <p>Hej {name},</p>
                <p>Dette er en venlig påmindelse om at din databehandleraftale med People's Doctor stadig afventer din underskrift.</p>
                <p>For at vi kan fortsætte samarbejdet i overensstemmelse med GDPR, beder vi dig venligst underskrive aftalen.</p>
                <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; width: 100%;">
                    <tr><td style="background: #4f5fa3; border-radius: 8px; text-align: center; padding: 16px 32px;">
                        <a href="{signing_url}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">Underskriv databehandleraftale nu</a>
                    </td></tr>
                </table>
                <p>Med venlig hilsen,<br>People's Doctor Teamet</p>
            """
            subj = "Sidste påmindelse: Databehandleraftale afventer underskrift"
        result = send_email(to=email, subject=subj, body_html=html, use_template=True)
        if result:
            execute("UPDATE dpa_signings SET reminder_count = 2, last_reminder_at = NOW(), cs_notified = true WHERE id = %s", (signing['id'],))
