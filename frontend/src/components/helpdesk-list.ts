/* ═══════════════════════════════════════════
   Helpdesk List — Ticket overview
   ═══════════════════════════════════════════ */

import { HelpdeskAPI, TeamAPI, GoogleAuthAPI } from '../api';
import { escapeHtml } from '../utils';
import type { Ticket, TeamMember } from '../types';

const STATUS_LABELS: Record<string, string> = {
  open: '\u00c5ben',
  in_progress: 'I gang',
  resolved: 'L\u00f8st',
  closed: 'Lukket',
};

const STATUS_CLASSES: Record<string, string> = {
  open: 'hd-status-open',
  in_progress: 'hd-status-progress',
  resolved: 'hd-status-resolved',
  closed: 'hd-status-closed',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Lav',
  medium: 'Medium',
  high: 'H\u00f8j',
  urgent: 'Akut',
};

const PRIORITY_CLASSES: Record<string, string> = {
  low: 'hd-prio-low',
  medium: 'hd-prio-medium',
  high: 'hd-prio-high',
  urgent: 'hd-prio-urgent',
};

export const HelpdeskList = {
  _tickets: [] as Ticket[],
  _stats: { open_count: 0, in_progress_count: 0, resolved_count: 0, closed_count: 0, total: 0 },
  _filterStatus: '' as string,
  _filterPriority: '' as string,
  _teamMembers: [] as TeamMember[],
  _gmailConnected: false,
  _gmailEmail: '' as string,

  /* ── Main render ── */
  async render(): Promise<string> {
    try {
      const filters: any = {};
      if (this._filterStatus) filters.status = this._filterStatus;
      if (this._filterPriority) filters.priority = this._filterPriority;
      [this._tickets, this._stats] = await Promise.all([
        HelpdeskAPI.getAll(filters),
        HelpdeskAPI.getStats(),
      ]);
    } catch {
      this._tickets = [];
    }

    if (this._teamMembers.length === 0) {
      try { this._teamMembers = await TeamAPI.getAll(); } catch { /* */ }
    }

    // Check Gmail connection status
    try {
      const gStatus = await GoogleAuthAPI.getStatus();
      this._gmailConnected = gStatus.connected;
      this._gmailEmail = gStatus.email || '';
    } catch { this._gmailConnected = false; }

    const stats = this._stats;
    const activeCount = stats.open_count + stats.in_progress_count;

    // Stats cards
    const statsHTML = `
      <div class="hd-stats">
        <button class="hd-stat-card ${this._filterStatus === 'open' ? 'hd-stat-active' : ''}" onclick="HelpdeskList.filterStatus('open')">
          <span class="hd-stat-num">${stats.open_count}</span>
          <span class="hd-stat-label">\u00c5bne</span>
        </button>
        <button class="hd-stat-card ${this._filterStatus === 'in_progress' ? 'hd-stat-active' : ''}" onclick="HelpdeskList.filterStatus('in_progress')">
          <span class="hd-stat-num">${stats.in_progress_count}</span>
          <span class="hd-stat-label">I gang</span>
        </button>
        <button class="hd-stat-card ${this._filterStatus === 'resolved' ? 'hd-stat-active' : ''}" onclick="HelpdeskList.filterStatus('resolved')">
          <span class="hd-stat-num">${stats.resolved_count}</span>
          <span class="hd-stat-label">L\u00f8st</span>
        </button>
        <button class="hd-stat-card ${this._filterStatus === 'closed' ? 'hd-stat-active' : ''}" onclick="HelpdeskList.filterStatus('closed')">
          <span class="hd-stat-num">${stats.closed_count}</span>
          <span class="hd-stat-label">Lukket</span>
        </button>
        <button class="hd-stat-card ${this._filterStatus === '' ? 'hd-stat-active' : ''}" onclick="HelpdeskList.filterStatus('')">
          <span class="hd-stat-num">${stats.total}</span>
          <span class="hd-stat-label">Total</span>
        </button>
      </div>
    `;

    // Ticket list
    let listHTML = '';
    if (this._tickets.length === 0) {
      listHTML = `
        <div class="hd-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
          <p>Ingen tickets endnu${this._filterStatus ? ' med dette filter' : ''}.</p>
          <button class="btn btn-primary btn-sm" onclick="HelpdeskList.openCreateModal()">Opret f\u00f8rste ticket</button>
        </div>
      `;
    } else {
      const rows = this._tickets.map(t => this._renderTicketRow(t)).join('');
      listHTML = `<div class="hd-ticket-list">${rows}</div>`;
    }

    // Gmail integration banner — dynamic based on connection status
    const gmailBanner = this._gmailConnected ? `
      <div class="hd-gmail-banner hd-gmail-connected">
        <svg class="hd-gmail-banner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
        <div class="hd-gmail-banner-text">
          <div class="hd-gmail-banner-title">Gmail forbundet</div>
          <div class="hd-gmail-banner-desc">${escapeHtml(this._gmailEmail)} — svar sendes automatisk via email.</div>
        </div>
        <button class="hd-gmail-banner-btn hd-gmail-banner-btn-settings" onclick="App.navigateTo('settings')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Indstillinger
        </button>
      </div>
    ` : `
      <div class="hd-gmail-banner">
        <svg class="hd-gmail-banner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
        <div class="hd-gmail-banner-text">
          <div class="hd-gmail-banner-title">Gmail-integration mangler</div>
          <div class="hd-gmail-banner-desc">Forbind din Google-konto for automatisk at modtage og besvare tickets via email.</div>
        </div>
        <button class="hd-gmail-banner-btn" onclick="App.navigateTo('settings')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Forbind
        </button>
      </div>
    `;

    return `
      <div class="hd-container">
        ${gmailBanner}
        ${statsHTML}
        <div class="hd-toolbar">
          <div class="hd-toolbar-left">
            <select class="input hd-filter-select" onchange="HelpdeskList.filterPriority(this.value)">
              <option value="" ${this._filterPriority === '' ? 'selected' : ''}>Alle prioriteter</option>
              <option value="urgent" ${this._filterPriority === 'urgent' ? 'selected' : ''}>Akut</option>
              <option value="high" ${this._filterPriority === 'high' ? 'selected' : ''}>H\u00f8j</option>
              <option value="medium" ${this._filterPriority === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="low" ${this._filterPriority === 'low' ? 'selected' : ''}>Lav</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="HelpdeskList.openCreateModal()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ny ticket
          </button>
        </div>
        ${listHTML}
      </div>
    `;
  },

  /* ── Ticket row ── */
  _renderTicketRow(t: Ticket): string {
    const statusLabel = STATUS_LABELS[t.status] || t.status;
    const statusClass = STATUS_CLASSES[t.status] || '';
    const prioLabel = PRIORITY_LABELS[t.priority] || t.priority;
    const prioClass = PRIORITY_CLASSES[t.priority] || '';
    const timeAgo = this._timeAgo(t.created_at);
    const assigneeName = t.assignee_name || 'Ikke tildelt';

    return `
      <div class="hd-ticket-row" onclick="App.navigateTo('helpdesk-detail', '${t.id}')">
        <div class="hd-ticket-main">
          <div class="hd-ticket-subject">${escapeHtml(t.subject)}</div>
          <div class="hd-ticket-meta">
            ${t.requester_name ? `<span class="hd-ticket-requester">${escapeHtml(t.requester_name)}</span>` : ''}
            ${(t as any).platform_user_name ? `<span class="hd-ticket-platform-user" title="Linket til ${escapeHtml((t as any).platform_user_name)}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ${escapeHtml((t as any).platform_user_name)}</span>` : ''}
            ${t.category ? `<span class="hd-ticket-category">${escapeHtml(t.category)}</span>` : ''}
            <span class="hd-ticket-time">${timeAgo}</span>
          </div>
        </div>
        <div class="hd-ticket-badges">
          <span class="hd-badge ${prioClass}">${prioLabel}</span>
          <span class="hd-badge ${statusClass}">${statusLabel}</span>
          <span class="hd-ticket-assignee">${escapeHtml(assigneeName)}</span>
        </div>
      </div>
    `;
  },

  _timeAgo(dateStr: string): string {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Lige nu';
    if (diffMin < 60) return `${diffMin}m siden`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}t siden`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d siden`;
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  },

  /* ── Filters ── */
  filterStatus(status: string): void {
    this._filterStatus = this._filterStatus === status ? '' : status;
    (window as any).App.render();
  },

  filterPriority(priority: string): void {
    this._filterPriority = priority;
    (window as any).App.render();
  },

  /* ── Create Modal ── */
  async openCreateModal(): Promise<void> {
    if (this._teamMembers.length === 0) {
      try { this._teamMembers = await TeamAPI.getAll(); } catch { /* */ }
    }

    const modal = document.getElementById('team-modal');
    if (!modal) return;

    const memberOptions = this._teamMembers
      .map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`)
      .join('');

    modal.innerHTML = `
      <div class="tl-modal" onclick="event.stopPropagation()">
        <div class="tl-modal-header">
          <h3>Ny ticket</h3>
          <button class="btn-icon" onclick="HelpdeskList.closeModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="tl-modal-body">
          <div class="form-group">
            <label class="form-label">Emne <span style="color: var(--error)">*</span></label>
            <input class="input" type="text" id="hd-subject" placeholder="Kort beskrivelse af problemet...">
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Indsender</label>
              <input class="input" type="text" id="hd-requester-name" placeholder="Navn...">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Email</label>
              <input class="input" type="email" id="hd-requester-email" placeholder="Email...">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Prioritet</label>
              <select class="input" id="hd-priority">
                <option value="low">Lav</option>
                <option value="medium" selected>Medium</option>
                <option value="high">H\u00f8j</option>
                <option value="urgent">Akut</option>
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Kategori</label>
              <select class="input" id="hd-category">
                <option value="">V\u00e6lg...</option>
                <option value="billing">Fakturering</option>
                <option value="technical">Teknisk</option>
                <option value="onboarding">Onboarding</option>
                <option value="general">Generelt</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Kilde</label>
              <select class="input" id="hd-source">
                <option value="manual" selected>Manuel</option>
                <option value="email">Email</option>
                <option value="chat">Chat</option>
                <option value="app">People's Clinic App</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Tildel til</label>
            <select class="input" id="hd-assignee">
              <option value="">Ikke tildelt</option>
              ${memberOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Beskrivelse</label>
            <textarea class="input" id="hd-description" rows="4" placeholder="Detaljer..."></textarea>
          </div>
        </div>
        <div class="tl-modal-footer">
          <button class="btn" onclick="HelpdeskList.closeModal()">Annuller</button>
          <button class="btn btn-primary" id="hd-create-btn" onclick="HelpdeskList.createTicket()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Opret ticket
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.onclick = (e: Event) => {
      if (e.target === modal) this.closeModal();
    };

    requestAnimationFrame(() => {
      const el = document.getElementById('hd-subject') as HTMLInputElement | null;
      if (el) el.focus();
    });
  },

  closeModal(): void {
    const modal = document.getElementById('team-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.innerHTML = '';
      modal.onclick = null;
    }
  },

  async createTicket(): Promise<void> {
    const subjectEl = document.getElementById('hd-subject') as HTMLInputElement | null;
    const btn = document.getElementById('hd-create-btn') as HTMLButtonElement | null;

    if (!subjectEl) return;
    const subject = subjectEl.value.trim();
    if (!subject) { subjectEl.style.borderColor = 'var(--error)'; subjectEl.focus(); return; }

    const description = (document.getElementById('hd-description') as HTMLTextAreaElement)?.value.trim() || '';
    const priority = (document.getElementById('hd-priority') as HTMLSelectElement)?.value || 'medium';
    const category = (document.getElementById('hd-category') as HTMLSelectElement)?.value || '';
    const source = (document.getElementById('hd-source') as HTMLSelectElement)?.value || 'manual';
    const assigneeId = (document.getElementById('hd-assignee') as HTMLSelectElement)?.value || undefined;
    const requesterName = (document.getElementById('hd-requester-name') as HTMLInputElement)?.value.trim() || '';
    const requesterEmail = (document.getElementById('hd-requester-email') as HTMLInputElement)?.value.trim() || '';

    if (btn) { btn.innerHTML = '<span class="vp-spinner"></span> Opretter...'; btn.disabled = true; }

    try {
      await HelpdeskAPI.create({
        subject, description, priority, category, source,
        requester_name: requesterName,
        requester_email: requesterEmail,
        assignee_id: assigneeId,
      });
      (window as any).App.toast('Ticket oprettet', 'success');
      this.closeModal();
      (window as any).App.render();
    } catch (err: any) {
      if (btn) { btn.innerHTML = 'Opret ticket'; btn.disabled = false; }
      (window as any).App.toast(err.message || 'Kunne ikke oprette ticket', 'error');
    }
  },
};

// Expose globally
(window as any).HelpdeskList = HelpdeskList;
