/* ═══════════════════════════════════════════
   Demo Join — Colleague sign-up for existing demo
   ═══════════════════════════════════════════ */

import { DemoAPI } from '../api';
import type { DemoInfo, DemoJoinResult } from '../types';

const DAY_NAMES = ['S\u00f8ndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'L\u00f8rdag'];
const MONTH_NAMES = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
const ROLES = ['L\u00e6ge', 'Sygeplejerske', 'Klinikassistent', 'Sekret\u00e6r', 'Andet'];

export const DemoJoin = {
  _state: {
    bookingId: '' as string,
    info: null as DemoInfo | null,
    form: { name: '', email: '', role: '' },
    result: null as DemoJoinResult | null,
    loading: false,
    error: null as string | null,
  },

  setBookingId(id: string): void {
    this._state.bookingId = id;
  },

  async render(): Promise<string> {
    // Fetch booking info on first render
    if (!this._state.info && !this._state.error && !this._state.result) {
      try {
        this._state.loading = true;
        const info = await DemoAPI.getInfo(this._state.bookingId);
        if ((info as any).error) {
          this._state.error = (info as any).error;
        } else {
          this._state.info = info;
        }
      } catch {
        this._state.error = 'Kunne ikke hente booking-info.';
      }
      this._state.loading = false;
    }

    return `
      <div class="db-page">
        <div class="db-container">
          <div class="db-header">
            <img src="/assets/peoples-clinic.svg" alt="People's Clinic" class="db-logo">
            <h1 class="db-title">Deltag i demo</h1>
            <p class="db-subtitle">Tilmeld dig en planlagt demo af People's Clinic platformen.</p>
          </div>
          <div class="db-body">
            ${this._state.error && !this._state.result ? `<div class="db-error">${this._state.error}</div>` : ''}
            ${this._state.loading ? '<div class="db-loading">Indl\u00e6ser...</div>' : ''}
            ${!this._state.loading ? this._renderContent() : ''}
          </div>
        </div>
      </div>
    `;
  },

  _renderContent(): string {
    if (this._state.result) return this._renderSuccess();
    if (this._state.info) return this._renderForm();
    return '';
  },

  _renderForm(): string {
    const info = this._state.info!;
    const d = new Date(info.date + 'T00:00:00');
    const dateLabel = `${DAY_NAMES[d.getDay()]} d. ${d.getDate()}. ${MONTH_NAMES[d.getMonth()]}`;
    const f = this._state.form;

    const participantList = info.participants.length > 0
      ? `<div class="dj-participants">
           <span class="dj-participants-label">Allerede tilmeldt:</span>
           ${info.participants.map(p =>
             `<span class="dj-participant-tag">${this._esc(p.name)}${p.role ? ` \u00b7 ${this._esc(p.role)}` : ''}${p.is_primary ? ' (arrang\u00f8r)' : ''}</span>`
           ).join('')}
         </div>`
      : '';

    return `
      <div class="db-section">
        <div class="dj-info-card">
          <div class="dj-info-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>${dateLabel} kl. ${info.start_time}\u2013${info.end_time}</span>
          </div>
          ${info.clinic ? `
            <div class="dj-info-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span>${this._esc(info.clinic)}</span>
            </div>
          ` : ''}
          ${participantList}
        </div>

        <h2 class="db-section-title" style="margin-top: 24px;">Dine oplysninger</h2>
        <form class="db-form" onsubmit="event.preventDefault(); DemoJoin.submit();">
          <div class="db-field">
            <label class="db-label" for="dj-name">Navn <span class="db-required">*</span></label>
            <input class="db-input" id="dj-name" type="text" required placeholder="Dit fulde navn"
              value="${this._esc(f.name)}" oninput="DemoJoin.setField('name', this.value)">
          </div>
          <div class="db-field">
            <label class="db-label" for="dj-email">Email <span class="db-required">*</span></label>
            <input class="db-input" id="dj-email" type="email" required placeholder="din@email.dk"
              value="${this._esc(f.email)}" oninput="DemoJoin.setField('email', this.value)">
          </div>
          <div class="db-field">
            <label class="db-label" for="dj-role">Rolle</label>
            <select class="db-input" id="dj-role" onchange="DemoJoin.setField('role', this.value)">
              <option value="">V\u00e6lg rolle...</option>
              ${ROLES.map(r => `<option value="${r}" ${f.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </div>
          <div class="db-actions">
            <div></div>
            <button type="submit" class="db-btn db-btn-primary"
              ${!f.name || !f.email ? 'disabled' : ''}>Tilmeld mig \u2192</button>
          </div>
        </form>
      </div>
    `;
  },

  _renderSuccess(): string {
    const result = this._state.result!;

    return `
      <div class="db-section db-confirm-section">
        <div class="db-confirm-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h2 class="db-confirm-title">Du er tilmeldt!</h2>
        <p class="db-confirm-subtitle">
          ${result.calendar_invite_sent
            ? 'Du modtager en kalenderinvitation med video-linket p\u00e5 email.'
            : 'Du kan deltage i demoen via video-linket nedenfor.'}
        </p>
        ${!result.calendar_invite_sent && result.meet_link ? `
          <div class="db-confirm-details">
            <div class="db-confirm-row db-confirm-meet">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              <a href="${result.meet_link}" target="_blank" rel="noopener">${result.meet_link}</a>
            </div>
          </div>
        ` : ''}
        <div class="db-confirm-actions" style="margin-top: 24px;">
          <a href="https://peoplesclinic.dk" class="db-btn db-btn-secondary">Tilbage til People's Clinic</a>
        </div>
      </div>
    `;
  },

  // ─── Actions ────────────────────────────────

  setField(field: string, value: string): void {
    (this._state.form as any)[field] = value;
    const btn = document.querySelector('.db-btn-primary[type="submit"]') as HTMLButtonElement;
    if (btn) btn.disabled = !this._state.form.name || !this._state.form.email;
  },

  async submit(): Promise<void> {
    const f = this._state.form;
    if (!f.name || !f.email) return;

    this._state.loading = true;
    this._state.error = null;
    this._rerender();

    try {
      const result = await DemoAPI.join(this._state.bookingId, {
        name: f.name,
        email: f.email,
        role: f.role,
      });
      if ((result as any).error) {
        this._state.error = (result as any).error;
      } else {
        this._state.result = result;
      }
    } catch (e: any) {
      this._state.error = e.message || 'Tilmelding fejlede.';
    }

    this._state.loading = false;
    this._rerender();
  },

  // ─── Helpers ────────────────────────────────

  _esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  async _rerender(): Promise<void> {
    const container = document.getElementById('main');
    if (!container) return;
    container.innerHTML = await this.render();
  },
};

(window as any).DemoJoin = DemoJoin;
