/* ═══════════════════════════════════════════
   DPA Sign — Public signing page
   Pattern: Same as /book-demo and /demo/{id}/join
   URL: /dpa/{token}
   ═══════════════════════════════════════════ */

import { DPAAPI } from '../api';
import { escapeHtml } from '../utils';

const t = {
  da: {
    loading: 'Indlæser...',
    invalidLink: 'Ugyldigt link',
    contactNew: 'Kontakt People\'s Doctor for at få tilsendt et nyt link.',
    expired: 'Linket er udløbet',
    expiredMsg: 'Dette underskriftslink er ikke længere gyldigt. Kontakt People\'s Doctor for at få tilsendt et nyt link.',
    alreadySigned: 'Allerede underskrevet',
    alreadySignedMsg: (name: string, date: string) => `Denne databehandleraftale blev underskrevet af <strong>${name}</strong>${date}.`,
    viewCertificate: 'Se signing certificate',
    dpaTitle: 'Databehandleraftale',
    dpaName: 'Data Processing Agreement',
    to: 'Til',
    version: 'Version',
    introText: 'For at overholde GDPR skal vi indgå en databehandleraftale. Læs venligst aftalen nedenfor og bekræft med dit navn og email.',
    mobileDocTitle: (v: string) => `Databehandleraftale v${v}`,
    mobileDocMsg: 'Åbn dokumentet for at læse aftalen før du underskriver.',
    openPdf: 'Åbn PDF',
    cantSeeDoc: 'Kan du ikke se dokumentet?',
    downloadPdfHere: 'Download PDF her',
    downloadPdf: 'Download PDF',
    continueToSign: 'Fortsæt til underskrift',
    signTitle: 'Underskriv databehandleraftale',
    onBehalfOf: 'På vegne af',
    fullName: 'Fulde navn',
    email: 'Email',
    titleRole: 'Titel / Rolle',
    titlePlaceholder: 'F.eks. Klinikejer, Praktiserende læge',
    namePlaceholder: 'Dit fulde navn',
    emailPlaceholder: 'Din email-adresse',
    consent: (name: string) => `Jeg bekræfter at jeg har læst og accepterer databehandleraftalen på vegne af <strong>${name}</strong>`,
    back: 'Tilbage',
    sign: 'Underskriv',
    signing: 'Underskriver...',
    consentAlert: 'Du skal bekræfte at du har læst og accepterer databehandleraftalen.',
    errorSigning: 'Fejl ved underskrift',
    errorGeneric: 'Der skete en fejl. Prøv igen.',
    doneTitle: 'Databehandleraftale underskrevet',
    doneMsg: 'Tak! Din underskrift er registreret.',
    signedBy: 'Underskrevet af:',
    date: 'Dato:',
    document: 'Dokument:',
    confirmSent: 'En bekræftelse er sendt til din email.',
    downloadCert: 'Download signing certificate',
    downloadDpa: 'Download databehandleraftale',
    footer: 'People\'s Doctor \u00b7 Databehandleraftale',
    loadError: 'Kunne ikke indlæse information.',
  },
  en: {
    loading: 'Loading...',
    invalidLink: 'Invalid link',
    contactNew: 'Contact People\'s Doctor to receive a new link.',
    expired: 'Link expired',
    expiredMsg: 'This signing link is no longer valid. Contact People\'s Doctor to receive a new link.',
    alreadySigned: 'Already signed',
    alreadySignedMsg: (name: string, date: string) => `This data processing agreement was signed by <strong>${name}</strong>${date}.`,
    viewCertificate: 'View signing certificate',
    dpaTitle: 'Data Processing Agreement',
    dpaName: 'Data Processing Agreement',
    to: 'To',
    version: 'Version',
    introText: 'To comply with GDPR, we need to enter into a data processing agreement. Please read the agreement below and confirm with your name and email.',
    mobileDocTitle: (v: string) => `Data Processing Agreement v${v}`,
    mobileDocMsg: 'Open the document to read the agreement before signing.',
    openPdf: 'Open PDF',
    cantSeeDoc: 'Can\'t see the document?',
    downloadPdfHere: 'Download PDF here',
    downloadPdf: 'Download PDF',
    continueToSign: 'Continue to sign',
    signTitle: 'Sign data processing agreement',
    onBehalfOf: 'On behalf of',
    fullName: 'Full name',
    email: 'Email',
    titleRole: 'Title / Role',
    titlePlaceholder: 'E.g. Clinic Owner, General Practitioner',
    namePlaceholder: 'Your full name',
    emailPlaceholder: 'Your email address',
    consent: (name: string) => `I confirm that I have read and accept the data processing agreement on behalf of <strong>${name}</strong>`,
    back: 'Back',
    sign: 'Sign',
    signing: 'Signing...',
    consentAlert: 'You must confirm that you have read and accept the data processing agreement.',
    errorSigning: 'Error signing',
    errorGeneric: 'An error occurred. Please try again.',
    doneTitle: 'Data Processing Agreement signed',
    doneMsg: 'Thank you! Your signature has been registered.',
    signedBy: 'Signed by:',
    date: 'Date:',
    document: 'Document:',
    confirmSent: 'A confirmation has been sent to your email.',
    downloadCert: 'Download signing certificate',
    downloadDpa: 'Download data processing agreement',
    footer: 'People\'s Doctor \u00b7 Data Processing Agreement',
    loadError: 'Could not load information.',
  },
};

export const DPASign = {
  _token: '',
  _signingInfo: null as any,
  _step: 'loading' as 'loading' | 'view' | 'sign' | 'done' | 'error' | 'expired' | 'already_signed',
  _error: '',

  _t() { return this._signingInfo?.language === 'en' ? t.en : t.da; },
  _locale() { return this._signingInfo?.language === 'en' ? 'en-GB' : 'da-DK'; },

  setToken(token: string): void {
    if (token !== this._token) {
      this._token = token;
      this._step = 'loading';
      this._signingInfo = null;
    }
  },

  async render(): Promise<string> {
    if (this._step === 'loading' && this._token) {
      try {
        const info = await DPAAPI.getSigningInfo(this._token);
        this._signingInfo = info;

        if (info.error) {
          this._step = 'error';
          this._error = info.error;
        } else if (info.status === 'signed') {
          this._step = 'already_signed';
        } else if (info.status === 'expired') {
          this._step = 'expired';
        } else {
          this._step = 'view';
        }
      } catch {
        this._step = 'error';
        this._error = t.da.loadError;
      }
    }

    const info = this._signingInfo;
    const s = this._t();
    const customerName = info?.customer_name || info?.contact_name || '';

    return `
      <div class="dpa-public">
        <div class="dpa-public-header">
          <img src="/assets/peoples-clinic.svg" alt="People's Doctor" class="dpa-public-logo" onerror="this.style.display='none'">
        </div>

        <div class="dpa-public-content">
          ${this._step === 'loading' ? this._renderLoading() : ''}
          ${this._step === 'error' ? this._renderError() : ''}
          ${this._step === 'expired' ? this._renderExpired() : ''}
          ${this._step === 'already_signed' ? this._renderAlreadySigned() : ''}
          ${this._step === 'view' ? this._renderView(customerName) : ''}
          ${this._step === 'sign' ? this._renderSignForm(customerName) : ''}
          ${this._step === 'done' ? this._renderDone() : ''}
        </div>

        <div class="dpa-public-footer">
          <p>${s.footer}</p>
        </div>
      </div>
    `;
  },

  _renderLoading(): string {
    const s = this._t();
    return `
      <div class="dpa-public-center">
        <span class="vp-spinner"></span>
        <p>${s.loading}</p>
      </div>
    `;
  },

  _renderError(): string {
    const s = this._t();
    return `
      <div class="dpa-public-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <h2>${s.invalidLink}</h2>
        <p>${escapeHtml(this._error)}</p>
        <p style="margin-top: 16px; color: #6b7280;">${s.contactNew}</p>
      </div>
    `;
  },

  _renderExpired(): string {
    const s = this._t();
    return `
      <div class="dpa-public-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <h2>${s.expired}</h2>
        <p>${s.expiredMsg}</p>
      </div>
    `;
  },

  _renderAlreadySigned(): string {
    const info = this._signingInfo;
    const s = this._t();
    const dateStr = info?.signed_at
      ? ` ${this._signingInfo?.language === 'en' ? 'on' : 'den'} ${new Date(info.signed_at).toLocaleDateString(this._locale(), { day: 'numeric', month: 'long', year: 'numeric' })}`
      : '';
    return `
      <div class="dpa-public-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <h2>${s.alreadySigned}</h2>
        <p>${s.alreadySignedMsg(escapeHtml(info?.signer_name || ''), dateStr)}</p>
        <a href="/api/dpa/${this._token}/certificate?format=pdf" class="btn btn-primary" style="margin-top: 16px;">
          ${s.viewCertificate}
        </a>
      </div>
    `;
  },

  _renderView(customerName: string): string {
    const info = this._signingInfo;
    const s = this._t();
    const pdfUrl = `/api/dpa/${this._token}/pdf`;
    const langLabel = info?.language === 'en' ? 'English' : 'Dansk';

    return `
      <div class="dpa-public-view">
        <h1>${s.dpaTitle}</h1>
        <p class="dpa-public-subtitle">${s.to}: <strong>${escapeHtml(customerName)}</strong> \u00b7 ${s.version} ${info?.document_version || '?'} \u00b7 ${langLabel}</p>

        <p class="dpa-public-intro">${s.introText}</p>

        <div class="dpa-pdf-container">
          ${/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? `
            <div class="dpa-pdf-mobile">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <p style="margin: 12px 0 4px; font-weight: 500; color: #26304f;">${s.mobileDocTitle(info?.document_version || '?')}</p>
              <p style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">${s.mobileDocMsg}</p>
              <a href="${pdfUrl}" target="_blank" class="btn btn-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                ${s.openPdf}
              </a>
            </div>
          ` : `
            <iframe src="${pdfUrl}" class="dpa-pdf-viewer" title="${s.dpaTitle} PDF"></iframe>
            <p class="dpa-pdf-fallback" style="text-align:center; margin-top:8px; font-size:13px; color:#6b7280;">
              ${s.cantSeeDoc} <a href="${pdfUrl}" target="_blank">${s.downloadPdfHere}</a>.
            </p>
          `}
        </div>

        <div class="dpa-public-actions">
          <a href="${pdfUrl}" target="_blank" class="btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ${s.downloadPdf}
          </a>
          <button class="btn btn-primary" onclick="DPASign.goToSign()">
            ${s.continueToSign}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  _renderSignForm(customerName: string): string {
    const s = this._t();
    return `
      <div class="dpa-public-sign">
        <h2>${s.signTitle}</h2>
        <p class="dpa-public-subtitle">${s.onBehalfOf}: <strong>${escapeHtml(customerName)}</strong></p>

        <div class="dpa-sign-form">
          <div class="form-group">
            <label class="form-label">${s.fullName} <span style="color: #ef4444;">*</span></label>
            <input class="input" type="text" id="dpa-signer-name" placeholder="${s.namePlaceholder}" required>
          </div>
          <div class="form-group">
            <label class="form-label">${s.email} <span style="color: #ef4444;">*</span></label>
            <input class="input" type="email" id="dpa-signer-email" placeholder="${s.emailPlaceholder}" required>
          </div>
          <div class="form-group">
            <label class="form-label">${s.titleRole}</label>
            <input class="input" type="text" id="dpa-signer-title" placeholder="${s.titlePlaceholder}">
          </div>

          <div class="dpa-consent">
            <label class="dpa-consent-label">
              <input type="checkbox" id="dpa-consent-check">
              <span>${s.consent(escapeHtml(customerName))}</span>
            </label>
          </div>

          <div class="dpa-sign-actions">
            <button class="btn" onclick="DPASign.goToView()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              ${s.back}
            </button>
            <button class="btn btn-primary" id="dpa-sign-btn" onclick="DPASign.submitSignature()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              ${s.sign}
            </button>
          </div>
        </div>
      </div>
    `;
  },

  _renderDone(): string {
    const info = this._signingInfo;
    const s = this._t();
    const locale = this._locale();
    const langLabel = info?.language === 'en' ? 'English' : 'Dansk';
    return `
      <div class="dpa-public-center">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <h2>${s.doneTitle}</h2>
        <p>${s.doneMsg}</p>

        <div class="dpa-done-details">
          <div class="dpa-done-row"><span>${s.signedBy}</span><strong>${escapeHtml(info?._signedName || '')}</strong></div>
          <div class="dpa-done-row"><span>${s.date}</span><strong>${new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></div>
          <div class="dpa-done-row"><span>${s.document}</span><strong>${s.dpaTitle} v${info?.document_version || '?'} (${langLabel})</strong></div>
        </div>

        <p style="color: #6b7280; margin-top: 16px;">${s.confirmSent}</p>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px; align-items: center;">
          <a href="/api/dpa/${this._token}/certificate?format=pdf" class="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${s.downloadCert}
          </a>
          <a href="/api/dpa/${this._token}/pdf" target="_blank" class="btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ${s.downloadDpa}
          </a>
        </div>
      </div>
    `;
  },

  /* ── Navigation ── */
  goToSign(): void {
    this._step = 'sign';
    (window as any).App.render();
  },

  goToView(): void {
    this._step = 'view';
    (window as any).App.render();
  },

  /* ── Submit ── */
  async submitSignature(): Promise<void> {
    const s = this._t();
    const nameEl = document.getElementById('dpa-signer-name') as HTMLInputElement | null;
    const emailEl = document.getElementById('dpa-signer-email') as HTMLInputElement | null;
    const titleEl = document.getElementById('dpa-signer-title') as HTMLInputElement | null;
    const consentEl = document.getElementById('dpa-consent-check') as HTMLInputElement | null;
    const btn = document.getElementById('dpa-sign-btn') as HTMLButtonElement | null;

    const name = nameEl?.value.trim() || '';
    const email = emailEl?.value.trim() || '';
    const title = titleEl?.value.trim() || '';

    if (!name) { if (nameEl) { nameEl.style.borderColor = '#ef4444'; nameEl.focus(); } return; }
    if (!email) { if (emailEl) { emailEl.style.borderColor = '#ef4444'; emailEl.focus(); } return; }
    if (!consentEl?.checked) {
      alert(s.consentAlert);
      return;
    }

    if (btn) { btn.innerHTML = `<span class="vp-spinner"></span> ${s.signing}`; btn.disabled = true; }

    try {
      const result = await DPAAPI.sign(this._token, { signer_name: name, signer_email: email, signer_title: title });

      if (result.ok) {
        this._signingInfo._signedName = name;
        this._step = 'done';
        (window as any).App.render();
      } else if (result.already_signed) {
        this._step = 'already_signed';
        (window as any).App.render();
      } else {
        alert(result.error || s.errorSigning);
        if (btn) { btn.innerHTML = s.sign; btn.disabled = false; }
      }
    } catch {
      alert(s.errorGeneric);
      if (btn) { btn.innerHTML = s.sign; btn.disabled = false; }
    }
  },
};

// Expose globally
(window as any).DPASign = DPASign;
