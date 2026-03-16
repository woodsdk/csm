/* ═══════════════════════════════════════════
   DPA Sign — Public signing page
   Pattern: Same as /book-demo and /demo/{id}/join
   URL: /dpa/{token}
   ═══════════════════════════════════════════ */

import { DPAAPI } from '../api';
import { escapeHtml } from '../utils';

export const DPASign = {
  _token: '',
  _signingInfo: null as any,
  _step: 'loading' as 'loading' | 'view' | 'sign' | 'done' | 'error' | 'expired' | 'already_signed',
  _error: '',

  setToken(token: string): void {
    // Only reset to loading if token changed (avoid resetting mid-flow)
    if (token !== this._token) {
      this._token = token;
      this._step = 'loading';
      this._signingInfo = null;
    }
  },

  async render(): Promise<string> {
    // Load signing info
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
        this._error = 'Kunne ikke indl\u00e6se information.';
      }
    }

    const info = this._signingInfo;
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
          <p>People's Doctor \u00b7 Databehandleraftale</p>
        </div>
      </div>
    `;
  },

  _renderLoading(): string {
    return `
      <div class="dpa-public-center">
        <span class="vp-spinner"></span>
        <p>Indl\u00e6ser...</p>
      </div>
    `;
  },

  _renderError(): string {
    return `
      <div class="dpa-public-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <h2>Ugyldigt link</h2>
        <p>${escapeHtml(this._error)}</p>
        <p style="margin-top: 16px; color: #6b7280;">Kontakt People's Doctor for at f\u00e5 tilsendt et nyt link.</p>
      </div>
    `;
  },

  _renderExpired(): string {
    return `
      <div class="dpa-public-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <h2>Linket er udl\u00f8bet</h2>
        <p>Dette underskriftslink er ikke l\u00e6ngere gyldigt. Kontakt People's Doctor for at f\u00e5 tilsendt et nyt link.</p>
      </div>
    `;
  },

  _renderAlreadySigned(): string {
    const info = this._signingInfo;
    return `
      <div class="dpa-public-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <h2>Allerede underskrevet</h2>
        <p>Denne databehandleraftale blev underskrevet af <strong>${escapeHtml(info?.signer_name || '')}</strong>
        ${info?.signed_at ? ` den ${new Date(info.signed_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.</p>
        <a href="/api/dpa/${this._token}/certificate" target="_blank" class="btn btn-primary" style="margin-top: 16px;">
          Se signing certificate
        </a>
      </div>
    `;
  },

  _renderView(customerName: string): string {
    const info = this._signingInfo;
    const pdfUrl = `/api/dpa/${this._token}/pdf`;
    const langLabel = info?.language === 'en' ? 'English' : 'Dansk';

    return `
      <div class="dpa-public-view">
        <h1>Databehandleraftale</h1>
        <p class="dpa-public-subtitle">Til: <strong>${escapeHtml(customerName)}</strong> \u00b7 Version ${info?.document_version || '?'} \u00b7 ${langLabel}</p>

        <p class="dpa-public-intro">
          For at overholde GDPR skal vi indg\u00e5 en databehandleraftale.
          L\u00e6s venligst aftalen nedenfor og bekr\u00e6ft med dit navn og email.
        </p>

        <div class="dpa-pdf-container">
          <object data="${pdfUrl}" type="application/pdf" class="dpa-pdf-viewer">
            <p>Din browser kan ikke vise PDF-filer.
              <a href="${pdfUrl}" target="_blank">Download PDF her</a>.</p>
          </object>
        </div>

        <div class="dpa-public-actions">
          <a href="${pdfUrl}" target="_blank" class="btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download PDF
          </a>
          <button class="btn btn-primary" onclick="DPASign.goToSign()">
            Forts\u00e6t til underskrift
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  _renderSignForm(customerName: string): string {
    return `
      <div class="dpa-public-sign">
        <h2>Underskriv databehandleraftale</h2>
        <p class="dpa-public-subtitle">P\u00e5 vegne af: <strong>${escapeHtml(customerName)}</strong></p>

        <div class="dpa-sign-form">
          <div class="form-group">
            <label class="form-label">Fulde navn <span style="color: #ef4444;">*</span></label>
            <input class="input" type="text" id="dpa-signer-name" placeholder="Dit fulde navn" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email <span style="color: #ef4444;">*</span></label>
            <input class="input" type="email" id="dpa-signer-email" placeholder="Din email-adresse" required>
          </div>
          <div class="form-group">
            <label class="form-label">Titel / Rolle</label>
            <input class="input" type="text" id="dpa-signer-title" placeholder="F.eks. Klinikejer, Praktiserende l\u00e6ge">
          </div>

          <div class="dpa-consent">
            <label class="dpa-consent-label">
              <input type="checkbox" id="dpa-consent-check">
              <span>Jeg bekr\u00e6fter at jeg har l\u00e6st og accepterer databehandleraftalen p\u00e5 vegne af <strong>${escapeHtml(customerName)}</strong></span>
            </label>
          </div>

          <div class="dpa-sign-actions">
            <button class="btn" onclick="DPASign.goToView()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              Tilbage
            </button>
            <button class="btn btn-primary" id="dpa-sign-btn" onclick="DPASign.submitSignature()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Underskriv
            </button>
          </div>
        </div>
      </div>
    `;
  },

  _renderDone(): string {
    const info = this._signingInfo;
    return `
      <div class="dpa-public-center">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <h2>Databehandleraftale underskrevet</h2>
        <p>Tak! Din underskrift er registreret.</p>

        <div class="dpa-done-details">
          <div class="dpa-done-row"><span>Underskrevet af:</span><strong>${escapeHtml(info?._signedName || '')}</strong></div>
          <div class="dpa-done-row"><span>Dato:</span><strong>${new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></div>
          <div class="dpa-done-row"><span>Dokument:</span><strong>Databehandleraftale v${info?.document_version || '?'} (${info?.language === 'en' ? 'English' : 'Dansk'})</strong></div>
        </div>

        <p style="color: #6b7280; margin-top: 16px;">En bekr\u00e6ftelse er sendt til din email.</p>

        <a href="/api/dpa/${this._token}/certificate" target="_blank" class="btn btn-primary" style="margin-top: 16px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Download signing certificate
        </a>
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
      alert('Du skal bekr\u00e6fte at du har l\u00e6st og accepterer databehandleraftalen.');
      return;
    }

    if (btn) { btn.innerHTML = '<span class="vp-spinner"></span> Underskriver...'; btn.disabled = true; }

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
        alert(result.error || 'Fejl ved underskrift');
        if (btn) { btn.innerHTML = 'Underskriv'; btn.disabled = false; }
      }
    } catch {
      alert('Der skete en fejl. Pr\u00f8v igen.');
      if (btn) { btn.innerHTML = 'Underskriv'; btn.disabled = false; }
    }
  },
};

// Expose globally
(window as any).DPASign = DPASign;
