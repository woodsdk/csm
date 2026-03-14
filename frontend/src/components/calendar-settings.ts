/* ═══════════════════════════════════════════
   Calendar Settings — Google Calendar config
   ═══════════════════════════════════════════ */

import { GoogleCal } from '../google-calendar';
import { escapeHtml } from '../utils';

export const CalendarSettings = {
  _el: null as HTMLElement | null,

  init(): void {
    this._el = document.getElementById('settings-modal');
    this._el!.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this._el) this.close();
    });
  },

  open(): void {
    const cfg = GoogleCal.getConfig();
    const isConnected = GoogleCal.isConnected();

    this._el!.innerHTML = `
      <div class="modal-panel">
        <div class="modal-header">
          <h3>Kalender-indstillinger</h3>
          <button class="btn-icon" onclick="CalendarSettings.close()" aria-label="Luk">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="event-detail-section" style="background: var(--navy-100); padding: var(--space-3); border-radius: var(--radius-md);">
            <div class="text-xs text-secondary" style="line-height: 1.6">
              <strong>Ops\u00e6tning:</strong><br>
              1. G\u00e5 til <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" class="text-accent">Google Cloud Console</a><br>
              2. Opret OAuth 2.0 Client ID (Web application)<br>
              3. Tilf\u00f8j <code>${window.location.origin}</code> som Authorized JavaScript origin<br>
              4. Kopier Client ID herunder<br>
              5. Calendar ID er emailen p\u00e5 den delte kalender
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="gcal-client-id">Google OAuth Client ID</label>
            <input class="input" id="gcal-client-id" type="text"
                   placeholder="123456789.apps.googleusercontent.com"
                   value="${escapeHtml(cfg.client_id)}">
          </div>

          <div class="form-group">
            <label class="form-label" for="gcal-calendar-id">Calendar ID (email)</label>
            <input class="input" id="gcal-calendar-id" type="text"
                   placeholder="support@peoplesdoctor.com"
                   value="${escapeHtml(cfg.calendar_id)}">
          </div>

          ${isConnected ? `
          <div style="display:flex; align-items:center; gap: var(--space-2); padding: var(--space-2) 0;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span class="text-sm text-secondary">Kalender er forbundet</span>
            <button class="btn btn-danger btn-sm" onclick="CalendarSettings.disconnect()" style="margin-left: auto">Afbryd</button>
          </div>` : ''}
        </div>
        <div class="modal-footer">
          <span></span>
          <div class="modal-footer-actions">
            <button class="btn" onclick="CalendarSettings.close()">Annuller</button>
            <button class="btn btn-primary" onclick="CalendarSettings.save()">Gem</button>
          </div>
        </div>
      </div>
    `;

    this._el!.classList.add('open');
  },

  save(): void {
    const clientId = (document.getElementById('gcal-client-id') as HTMLInputElement).value.trim();
    const calendarId = (document.getElementById('gcal-calendar-id') as HTMLInputElement).value.trim();

    GoogleCal.setConfig({ client_id: clientId, calendar_id: calendarId });
    (window as any).App.toast('Kalender-indstillinger gemt', 'success');
    this.close();
    (window as any).App.render();
  },

  disconnect(): void {
    GoogleCal.disconnect();
    this.close();
    (window as any).App.render();
  },

  close(): void {
    this._el!.classList.remove('open');
  }
};

(window as any).CalendarSettings = CalendarSettings;
