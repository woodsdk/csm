/* ═══════════════════════════════════════════
   Settings Page — Google Integration management
   ═══════════════════════════════════════════ */

import { GoogleAuthAPI } from '../api';
import type { GoogleOAuthStatus } from '../types';

export const SettingsPage = {
  _status: null as GoogleOAuthStatus | null,

  async render(): Promise<string> {
    try {
      this._status = await GoogleAuthAPI.getStatus();
    } catch {
      this._status = { connected: false };
    }

    const s = this._status;

    // Check URL params for success/error feedback
    const urlParams = new URLSearchParams(window.location.search);
    const googleResult = urlParams.get('google');
    let toastHTML = '';
    if (googleResult === 'connected') {
      toastHTML = '<div class="set-toast set-toast-success">Google-konto forbundet!</div>';
      // Clean URL
      window.history.replaceState({}, '', '/?page=settings');
    } else if (googleResult === 'error') {
      toastHTML = '<div class="set-toast set-toast-error">Kunne ikke forbinde Google-konto. Prøv igen.</div>';
      window.history.replaceState({}, '', '/?page=settings');
    }

    const connectedAt = s.connected && s.connected_at
      ? new Date(s.connected_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

    return `
      <div class="set-container">
        ${toastHTML}
        <h2 class="set-title">Indstillinger</h2>

        <div class="set-section">
          <h3 class="set-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google Integration
          </h3>

          ${s.connected ? `
            <div class="set-card set-card-connected">
              <div class="set-card-header">
                <span class="set-status-dot set-status-connected"></span>
                <span class="set-status-label">Forbundet</span>
              </div>
              <div class="set-card-email">${s.email || ''}</div>
              <div class="set-card-scopes">Gmail · Kalender</div>
              <div class="set-card-date">Forbundet: ${connectedAt}</div>
              <button class="btn btn-sm set-disconnect-btn" onclick="SettingsPage.disconnect()">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                  <line x1="12" y1="2" x2="12" y2="12"/>
                </svg>
                Afbryd forbindelse
              </button>
            </div>
          ` : `
            <div class="set-card set-card-disconnected">
              <div class="set-card-header">
                <span class="set-status-dot set-status-disconnected"></span>
                <span class="set-status-label">Ikke forbundet</span>
              </div>
              <p class="set-card-desc">Forbind din Google-konto for at sende emails fra helpdesk og bruge kalenderen direkte i platformen.</p>
              <button class="btn btn-primary btn-sm" onclick="SettingsPage.connect()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Forbind Google-konto
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  },

  async connect(): Promise<void> {
    try {
      const result = await GoogleAuthAPI.getConnectUrl();
      if (result.auth_url) {
        window.location.href = result.auth_url;
      } else {
        (window as any).App.toast((result as any).error || 'Kunne ikke oprette forbindelse', 'error');
      }
    } catch {
      (window as any).App.toast('Fejl ved oprettelse af Google-forbindelse', 'error');
    }
  },

  async disconnect(): Promise<void> {
    try {
      await GoogleAuthAPI.disconnect();
      (window as any).App.toast('Google-konto afbrudt', 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke afbryde forbindelsen', 'error');
    }
  },
};

(window as any).SettingsPage = SettingsPage;
