/* ═══════════════════════════════════════════
   Platform Kommunikation — Announcements + Platform Support
   ═══════════════════════════════════════════ */

import { CommsAPI, MarketingAPI } from '../api';
import { escapeHtml } from '../utils';
import type { Announcement, CommsStats, Ticket, MarketingSegment } from '../types';

type CmTab = 'announcements' | 'support';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Kladde',
  scheduled: 'Planlagt',
  published: 'Publiceret',
  expired: 'Udløbet',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  scheduled: '#3b82f6',
  published: '#22c55e',
  expired: '#9ca3af',
};

export const CommsPage = {
  _activeTab: 'announcements' as CmTab,
  _announcements: null as Announcement[] | null,
  _stats: null as CommsStats | null,
  _tickets: null as Ticket[] | null,
  _segments: null as MarketingSegment[] | null,
  _showCreateForm: false,

  setTab(tab: string): void {
    this._activeTab = tab as CmTab;
    (window as any).App.render();
  },

  async render(): Promise<string> {
    // Load stats
    if (!this._stats) {
      try { this._stats = await CommsAPI.getStats(); } catch { this._stats = null; }
    }

    const stats = this._stats;
    const tabs: { key: CmTab; label: string; icon: string }[] = [
      { key: 'announcements', label: 'Meddelelser', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' },
      { key: 'support', label: 'Platform Support', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
    ];

    let content = '';
    if (this._activeTab === 'announcements') content = await this._renderAnnouncements();
    else if (this._activeTab === 'support') content = await this._renderSupport();

    return `
      <div class="cm-container">
        <div class="cm-stats-row">
          <div class="cm-stat-card">
            <span class="cm-stat-value">${stats?.announcements?.draft ?? 0}</span>
            <span class="cm-stat-label">Kladder</span>
          </div>
          <div class="cm-stat-card">
            <span class="cm-stat-value" style="color: var(--success)">${stats?.announcements?.published ?? 0}</span>
            <span class="cm-stat-label">Aktive</span>
          </div>
          <div class="cm-stat-card">
            <span class="cm-stat-value">${stats?.announcements?.total ?? 0}</span>
            <span class="cm-stat-label">Totalt sendt</span>
          </div>
          <div class="cm-stat-card">
            <span class="cm-stat-value" style="color: ${(stats?.platform_tickets_open ?? 0) > 0 ? 'var(--warning)' : 'var(--text-primary)'}">${stats?.platform_tickets_open ?? 0}</span>
            <span class="cm-stat-label">Åbne tickets</span>
          </div>
        </div>

        <div class="cm-top-bar">
          <div class="cm-tabs">
            ${tabs.map(t => `
              <button class="cm-tab ${this._activeTab === t.key ? 'cm-tab-active' : ''}" onclick="CommsPage.setTab('${t.key}')">
                ${t.icon} ${t.label}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="cm-content">
          ${content}
        </div>
      </div>
    `;
  },

  /* ────────── ANNOUNCEMENTS TAB ────────── */

  async _renderAnnouncements(): Promise<string> {
    if (!this._announcements) {
      try { this._announcements = await CommsAPI.getAnnouncements(); } catch { this._announcements = []; }
    }
    if (!this._segments) {
      try { this._segments = await MarketingAPI.getSegments(); } catch { this._segments = []; }
    }

    const list = this._announcements || [];
    const segOpts = (this._segments || []).map(s =>
      `<option value="${s.id}">${escapeHtml(s.name)} (${s.user_count} brugere)</option>`
    ).join('');

    const createForm = this._showCreateForm ? `
      <div class="cm-create-form">
        <h3 class="cm-form-title">Ny meddelelse</h3>
        <div class="form-group">
          <label class="form-label">Titel <span style="color: #ef4444;">*</span></label>
          <input class="input" type="text" id="cm-ann-title" placeholder="Overskrift på meddelelsen">
        </div>
        <div class="form-group">
          <label class="form-label">Indhold</label>
          <textarea class="input" id="cm-ann-body" rows="5" placeholder="Beskedtekst (understøtter HTML)"></textarea>
        </div>
        <div class="form-row" style="gap: 12px;">
          <div class="form-group" style="flex:1">
            <label class="form-label">Type</label>
            <select class="input" id="cm-ann-type">
              <option value="modal">Modal (pop-up)</option>
              <option value="banner">Banner</option>
            </select>
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Målgruppe</label>
            <select class="input" id="cm-ann-audience" onchange="CommsPage.toggleSegmentSelect()">
              <option value="all">Alle brugere</option>
              <option value="segment">Specifikt segment</option>
            </select>
          </div>
          <div class="form-group" style="flex:1;display:none" id="cm-segment-group">
            <label class="form-label">Segment</label>
            <select class="input" id="cm-ann-segment">
              ${segOpts}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Udløber (valgfrit)</label>
          <input class="input" type="datetime-local" id="cm-ann-expires">
        </div>
        <div class="cm-form-actions">
          <button class="btn" onclick="CommsPage.toggleCreateForm()">Annuller</button>
          <button class="btn btn-primary" onclick="CommsPage.createAnnouncement()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Opret som kladde
          </button>
        </div>
      </div>
    ` : '';

    return `
      <div class="cm-ann-toolbar">
        <button class="btn btn-primary" onclick="CommsPage.toggleCreateForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Opret meddelelse
        </button>
      </div>

      ${createForm}

      ${list.length === 0 ? `
        <div class="cm-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <p>Ingen meddelelser endnu.</p>
          <p style="color: var(--text-tertiary); font-size: var(--text-xs);">Opret en meddelelse for at sende til brugere på platformen.</p>
        </div>
      ` : `
        <div class="cm-ann-list">
          ${list.map(a => this._renderAnnouncementCard(a)).join('')}
        </div>
      `}
    `;
  },

  _renderAnnouncementCard(a: Announcement): string {
    const statusLabel = STATUS_LABELS[a.status] || a.status;
    const statusColor = STATUS_COLORS[a.status] || '#6b7280';
    const typeLabel = a.type === 'modal' ? 'Modal' : 'Banner';
    const audienceLabel = a.audience_type === 'all' ? 'Alle brugere' : (a.segment_name || 'Segment');
    const dateStr = a.published_at
      ? new Date(a.published_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
      : new Date(a.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });

    const deliveryCount = a.delivery_count ?? 0;
    const readCount = a.read_count ?? 0;
    const readPct = deliveryCount > 0 ? Math.round(readCount / deliveryCount * 100) : 0;

    return `
      <div class="cm-ann-card">
        <div class="cm-ann-card-header">
          <div class="cm-ann-card-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2">
              ${a.type === 'modal'
                ? '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/>'
                : '<rect x="2" y="6" width="20" height="4" rx="1"/><line x1="6" y1="10" x2="6" y2="18"/>'}
            </svg>
            <h4 class="cm-ann-title">${escapeHtml(a.title)}</h4>
          </div>
          <span class="cm-ann-badge" style="background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}40">${statusLabel}</span>
        </div>
        <div class="cm-ann-meta">
          <span>${typeLabel}</span>
          <span>·</span>
          <span>${audienceLabel}</span>
          <span>·</span>
          <span>${dateStr}</span>
          ${a.status === 'published' ? `
            <span>·</span>
            <span>${deliveryCount} leveret · ${readCount} læst (${readPct}%)</span>
          ` : ''}
        </div>
        ${a.body ? `<div class="cm-ann-preview">${a.body.replace(/<[^>]+>/g, '').substring(0, 120)}${a.body.length > 120 ? '...' : ''}</div>` : ''}
        <div class="cm-ann-actions">
          ${a.status === 'draft' || a.status === 'scheduled' ? `
            <button class="btn btn-sm btn-primary" onclick="CommsPage.publishAnnouncement('${a.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Publicer nu
            </button>
            <button class="btn btn-sm" onclick="CommsPage.deleteAnnouncement('${a.id}')">Slet</button>
          ` : ''}
          ${a.status === 'published' ? `
            <button class="btn btn-sm" onclick="CommsPage.viewStats('${a.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Se statistik
            </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  /* ────────── SUPPORT TAB ────────── */

  async _renderSupport(): Promise<string> {
    if (!this._tickets) {
      try { this._tickets = await CommsAPI.getPlatformTickets(); } catch { this._tickets = []; }
    }

    const tickets = this._tickets || [];

    const priorityColors: Record<string, string> = {
      urgent: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#6b7280',
    };
    const priorityLabels: Record<string, string> = {
      urgent: 'Akut', high: 'Høj', medium: 'Medium', low: 'Lav',
    };
    const statusLabels: Record<string, string> = {
      open: 'Åben', in_progress: 'I gang', resolved: 'Løst', closed: 'Lukket',
    };

    return `
      <div class="cm-support-intro">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>Tickets oprettet af brugere via "Kontakt Support" i People's Doctor-appen. Klik for at åbne i Helpdesk.</span>
      </div>

      ${tickets.length === 0 ? `
        <div class="cm-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p>Ingen platform-tickets endnu.</p>
          <p style="color: var(--text-tertiary); font-size: var(--text-xs);">Tickets fra People's Doctor-platformen vises her automatisk.</p>
        </div>
      ` : `
        <table class="cm-ticket-table">
          <thead>
            <tr>
              <th>Emne</th>
              <th>Bruger</th>
              <th>Status</th>
              <th>Prioritet</th>
              <th>Dato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${tickets.map(t => `
              <tr class="cm-ticket-row" onclick="App.state.tab='${t.id}'; App.navigateTo('helpdesk-detail')">
                <td class="cm-ticket-subject">${escapeHtml(t.subject)}</td>
                <td>${escapeHtml(t.requester_name || '')}</td>
                <td><span class="cm-ticket-status">${statusLabels[t.status] || t.status}</span></td>
                <td><span class="cm-ticket-priority" style="color: ${priorityColors[t.priority] || '#6b7280'}">${priorityLabels[t.priority] || t.priority}</span></td>
                <td class="cm-ticket-date">${new Date(t.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</td>
                <td class="cm-ticket-arrow">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    `;
  },

  /* ────────── ACTIONS ────────── */

  toggleCreateForm(): void {
    this._showCreateForm = !this._showCreateForm;
    (window as any).App.render();
  },

  toggleSegmentSelect(): void {
    const audience = (document.getElementById('cm-ann-audience') as HTMLSelectElement)?.value;
    const segGroup = document.getElementById('cm-segment-group');
    if (segGroup) {
      segGroup.style.display = audience === 'segment' ? 'block' : 'none';
    }
  },

  async createAnnouncement(): Promise<void> {
    const title = (document.getElementById('cm-ann-title') as HTMLInputElement)?.value?.trim();
    const body = (document.getElementById('cm-ann-body') as HTMLTextAreaElement)?.value?.trim() || '';
    const type = (document.getElementById('cm-ann-type') as HTMLSelectElement)?.value || 'modal';
    const audienceType = (document.getElementById('cm-ann-audience') as HTMLSelectElement)?.value || 'all';
    const segmentId = (document.getElementById('cm-ann-segment') as HTMLSelectElement)?.value || null;
    const expiresAt = (document.getElementById('cm-ann-expires') as HTMLInputElement)?.value || null;

    if (!title) {
      (window as any).App.toast('Angiv en titel', 'error');
      return;
    }

    try {
      const result = await CommsAPI.createAnnouncement({
        title,
        body: body.includes('<') ? body : `<p>${body.replace(/\n/g, '</p><p>')}</p>`,
        type: type as any,
        audience_type: audienceType as any,
        segment_id: audienceType === 'segment' ? segmentId : null,
        expires_at: expiresAt || null,
      });

      if ((result as any).error) {
        (window as any).App.toast((result as any).error, 'error');
      } else {
        (window as any).App.toast('Meddelelse oprettet som kladde', 'success');
        this._announcements = null;
        this._stats = null;
        this._showCreateForm = false;
        (window as any).App.render();
      }
    } catch {
      (window as any).App.toast('Kunne ikke oprette meddelelse', 'error');
    }
  },

  async publishAnnouncement(id: string): Promise<void> {
    if (!confirm('Er du sikker? Meddelelsen sendes til alle målgruppe-brugere.')) return;

    try {
      const result = await CommsAPI.publishAnnouncement(id);
      if ((result as any).error) {
        (window as any).App.toast((result as any).error, 'error');
      } else {
        (window as any).App.toast(`Meddelelse publiceret — leveret til ${result.delivered_to ?? 0} brugere`, 'success');
        this._announcements = null;
        this._stats = null;
        (window as any).App.render();
      }
    } catch {
      (window as any).App.toast('Kunne ikke publicere', 'error');
    }
  },

  async deleteAnnouncement(id: string): Promise<void> {
    if (!confirm('Slet denne kladde?')) return;

    try {
      await CommsAPI.deleteAnnouncement(id);
      this._announcements = null;
      this._stats = null;
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke slette', 'error');
    }
  },

  async viewStats(id: string): Promise<void> {
    try {
      const stats = await CommsAPI.getAnnouncementStats(id);
      const deliveries = stats.deliveries || [];

      let rows = deliveries.map((d: any) => `
        <tr>
          <td>${escapeHtml(d.user_name || 'Ukendt')}</td>
          <td>${escapeHtml(d.clinic_name || '')}</td>
          <td>${d.read_at ? '✅ Læst' : '⏳ Ikke læst'}</td>
          <td>${d.read_at ? new Date(d.read_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
        </tr>
      `).join('');

      const modal = document.getElementById('team-modal');
      if (modal) {
        modal.innerHTML = `
          <div class="modal-overlay" onclick="CommsPage.closeModal()">
            <div class="modal-dialog" onclick="event.stopPropagation()" style="max-width: 600px;">
              <div class="modal-header">
                <h3>Leveringsstatistik</h3>
                <button class="modal-close" onclick="CommsPage.closeModal()">×</button>
              </div>
              <div class="modal-body">
                <div style="display:flex;gap:24px;margin-bottom:16px;">
                  <div><strong>${stats.delivery_count}</strong> leveret</div>
                  <div><strong>${stats.read_count}</strong> læst</div>
                  <div><strong>${stats.read_pct}%</strong> læserate</div>
                </div>
                <table class="cm-stats-table">
                  <thead><tr><th>Bruger</th><th>Klinik</th><th>Status</th><th>Læst</th></tr></thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>
            </div>
          </div>
        `;
        modal.classList.add('open');
      }
    } catch {
      (window as any).App.toast('Kunne ikke hente statistik', 'error');
    }
  },

  closeModal(): void {
    const modal = document.getElementById('team-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.innerHTML = '';
    }
  },
};

// Expose globally
(window as any).CommsPage = CommsPage;
