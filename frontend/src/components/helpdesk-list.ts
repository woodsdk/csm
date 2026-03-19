/* ═══════════════════════════════════════════
   Helpdesk List — Ticket overview
   ═══════════════════════════════════════════ */

import { HelpdeskAPI, TeamAPI, GoogleAuthAPI, GmailAPI } from '../api';
import { escapeHtml } from '../utils';
import { t, getLocale } from '../i18n';
import type { Ticket, TeamMember } from '../types';

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    open: t('hd.statusOpen'),
    in_progress: t('hd.statusInProgress'),
    resolved: t('hd.statusResolved'),
    closed: t('hd.statusClosed'),
  };
  return map[status] || status;
}

const STATUS_CLASSES: Record<string, string> = {
  open: 'hd-status-open',
  in_progress: 'hd-status-progress',
  resolved: 'hd-status-resolved',
  closed: 'hd-status-closed',
};

function getPriorityLabel(priority: string): string {
  const map: Record<string, string> = {
    low: t('hd.prioLow'),
    medium: t('hd.prioMedium'),
    high: t('hd.prioHigh'),
    urgent: t('hd.prioUrgent'),
  };
  return map[priority] || priority;
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    billing: t('hd.catBilling'),
    technical: t('hd.catTechnical'),
    onboarding: t('hd.catOnboarding'),
    general: t('hd.catGeneral'),
  };
  return map[category] || category;
}

const PRIORITY_CLASSES: Record<string, string> = {
  low: 'hd-prio-low',
  medium: 'hd-prio-medium',
  high: 'hd-prio-high',
  urgent: 'hd-prio-urgent',
};

export const HelpdeskList = {
  _tickets: [] as Ticket[],
  _stats: { open_count: 0, in_progress_count: 0, resolved_count: 0, closed_count: 0, total: 0 },
  _filterStatus: 'open' as string,
  _filterPriority: '' as string,
  _teamMembers: [] as TeamMember[],
  _gmailConnected: false,
  _gmailEmail: '' as string,
  _syncing: false,
  _lastSyncResult: null as { synced: number; created: number; updated: number } | null,

  /* ── Main render ── */
  async render(): Promise<string> {
    // Check Gmail connection status first (needed for sync + banner)
    try {
      const gStatus = await GoogleAuthAPI.getStatus();
      this._gmailConnected = gStatus.connected;
      this._gmailEmail = gStatus.email || '';
    } catch { this._gmailConnected = false; }

    // Auto-sync inbox if Gmail is connected (non-blocking)
    if (this._gmailConnected && !this._syncing) {
      this._syncInbox();
    }

    try {
      const filters: any = {};
      if (this._filterStatus === 'active') {
        filters.status = 'open,in_progress';
      } else if (this._filterStatus) {
        filters.status = this._filterStatus;
      }
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

    const stats = this._stats;
    const activeCount = stats.open_count + stats.in_progress_count;

    // Stats cards
    const statsHTML = `
      <div class="hd-stats">
        <button class="hd-stat-card ${this._filterStatus === 'active' ? 'hd-stat-active' : ''}" onclick="HelpdeskList.filterStatus('active')">
          <span class="hd-stat-num">${activeCount}</span>
          <span class="hd-stat-label">${t('hd.activeTickets')}</span>
        </button>
        <button class="hd-stat-card ${this._filterStatus === 'open' ? 'hd-stat-active' : ''}" onclick="HelpdeskList.filterStatus('open')">
          <span class="hd-stat-num">${stats.open_count}</span>
          <span class="hd-stat-label">${t('hd.openTickets')}</span>
        </button>
        <button class="hd-stat-card ${this._filterStatus === 'in_progress' ? 'hd-stat-active' : ''}" onclick="HelpdeskList.filterStatus('in_progress')">
          <span class="hd-stat-num">${stats.in_progress_count}</span>
          <span class="hd-stat-label">${t('hd.inProgress')}</span>
        </button>
        <button class="hd-stat-card ${this._filterStatus === 'resolved' ? 'hd-stat-active' : ''}" onclick="HelpdeskList.filterStatus('resolved')">
          <span class="hd-stat-num">${stats.resolved_count}</span>
          <span class="hd-stat-label">${t('hd.resolvedTickets')}</span>
        </button>
        <button class="hd-stat-card ${this._filterStatus === 'closed' ? 'hd-stat-active' : ''}" onclick="HelpdeskList.filterStatus('closed')">
          <span class="hd-stat-num">${stats.closed_count}</span>
          <span class="hd-stat-label">${t('hd.closedTickets')}</span>
        </button>
        <button class="hd-stat-card ${this._filterStatus === '' ? 'hd-stat-active' : ''}" onclick="HelpdeskList.filterStatus('')">
          <span class="hd-stat-num">${stats.total}</span>
          <span class="hd-stat-label">${t('hd.allTickets')}</span>
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
          <p>${t('hd.noTickets')}${this._filterStatus !== '' ? ' ' + t('hd.tryChangeFilter') : ''}</p>
          <button class="btn btn-primary btn-sm" onclick="HelpdeskList.openCreateModal()">${t('hd.createFirst')}</button>
        </div>
      `;
    } else {
      const rows = this._tickets.map(tk => this._renderTicketRow(tk)).join('');
      listHTML = `<div class="hd-ticket-list">${rows}</div>`;
    }

    // Gmail integration banner — dynamic based on connection status
    const gmailBanner = this._gmailConnected ? `
      <div class="hd-gmail-banner hd-gmail-connected">
        <svg class="hd-gmail-banner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
        <div class="hd-gmail-banner-text">
          <div class="hd-gmail-banner-title">${t('hd.gmailConnected')}</div>
          <div class="hd-gmail-banner-desc">${escapeHtml(this._gmailEmail)} — ${t('hd.replySent')}</div>
        </div>
        <button class="hd-gmail-banner-btn" id="hd-sync-btn" onclick="HelpdeskList.manualSync()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          ${t('hd.syncInbox')}
        </button>
        <button class="hd-gmail-banner-btn hd-gmail-banner-btn-settings" onclick="App.navigateTo('settings')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          ${t('sidebar.settings')}
        </button>
      </div>
    ` : `
      <div class="hd-gmail-banner">
        <svg class="hd-gmail-banner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
        <div class="hd-gmail-banner-text">
          <div class="hd-gmail-banner-title">${t('hd.gmailMissing')}</div>
          <div class="hd-gmail-banner-desc">${t('hd.gmailDesc')}</div>
        </div>
        <button class="hd-gmail-banner-btn" onclick="App.navigateTo('settings')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          ${t('hd.connect')}
        </button>
      </div>
    `;

    return `
      <div class="hd-container">
        ${gmailBanner}
        ${statsHTML}
        <div class="hd-toolbar">
          <div class="hd-toolbar-left">
            <div class="hd-filter-bar">
              <div class="hd-filter-group">
                <label class="hd-filter-label">${t('hd.filterStatus')}</label>
                <select class="hd-filter-select" id="hd-filter-status" onchange="HelpdeskList.filterBySelect()">
                  <option value="open"${this._filterStatus === 'open' ? ' selected' : ''}>${t('hd.openTickets')}</option>
                  <option value="in_progress"${this._filterStatus === 'in_progress' ? ' selected' : ''}>${t('hd.inProgress')}</option>
                  <option value="active"${this._filterStatus === 'active' ? ' selected' : ''}>${t('hd.activeOpenInProgress')}</option>
                  <option value="resolved"${this._filterStatus === 'resolved' ? ' selected' : ''}>${t('hd.resolvedTickets')}</option>
                  <option value="closed"${this._filterStatus === 'closed' ? ' selected' : ''}>${t('hd.closedTickets')}</option>
                  <option value=""${this._filterStatus === '' ? ' selected' : ''}>${t('hd.allTickets')}</option>
                </select>
              </div>
              <div class="hd-filter-group">
                <label class="hd-filter-label">${t('hd.filterPriority')}</label>
                <select class="hd-filter-select" id="hd-filter-priority" onchange="HelpdeskList.filterByPrioritySelect()">
                  <option value=""${this._filterPriority === '' ? ' selected' : ''}>${t('hd.allTickets')}</option>
                  <option value="urgent"${this._filterPriority === 'urgent' ? ' selected' : ''}>${t('hd.prioUrgent')}</option>
                  <option value="high"${this._filterPriority === 'high' ? ' selected' : ''}>${t('hd.prioHigh')}</option>
                  <option value="medium"${this._filterPriority === 'medium' ? ' selected' : ''}>${t('hd.prioMedium')}</option>
                  <option value="low"${this._filterPriority === 'low' ? ' selected' : ''}>${t('hd.prioLow')}</option>
                </select>
              </div>
            </div>
            <span class="hd-sort-info">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/></svg>
              ${t('hd.sortedByPriority')}
            </span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="HelpdeskList.openCreateModal()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ${t('hd.newTicket')}
          </button>
        </div>
        ${listHTML}
      </div>
    `;
  },

  /* ── Ticket row ── */
  _renderTicketRow(tk: Ticket): string {
    const statusLabel = getStatusLabel(tk.status);
    const statusClass = STATUS_CLASSES[tk.status] || '';
    const prioLabel = getPriorityLabel(tk.priority);
    const prioClass = PRIORITY_CLASSES[tk.priority] || '';
    const timeAgo = this._timeAgo(tk.created_at);
    const assigneeName = tk.assignee_name || t('hd.notAssigned');
    const isAiPriority = tk.priority_source === 'ai';

    return `
      <div class="hd-ticket-row" onclick="App.navigateTo('helpdesk-detail', '${tk.id}')">
        <div class="hd-ticket-main">
          <div class="hd-ticket-subject">${escapeHtml(tk.subject)}</div>
          <div class="hd-ticket-meta">
            ${tk.requester_name ? `<span class="hd-ticket-requester">${escapeHtml(tk.requester_name)}</span>` : ''}
            ${(tk as any).platform_user_name ? `<span class="hd-ticket-platform-user" title="Linket til ${escapeHtml((tk as any).platform_user_name)}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ${escapeHtml((tk as any).platform_user_name)}</span>` : ''}
            ${tk.category ? `<span class="hd-ticket-category">${getCategoryLabel(tk.category)}</span>` : ''}
            <span class="hd-ticket-time">${timeAgo}</span>
          </div>
        </div>
        <div class="hd-ticket-badges" onclick="event.stopPropagation()">
          <select class="hd-inline-select hd-inline-prio ${prioClass}" onchange="HelpdeskList.inlineUpdate('${tk.id}', 'priority', this.value)">
            <option value="low" ${tk.priority === 'low' ? 'selected' : ''}>${t('hd.prioLow')}</option>
            <option value="medium" ${tk.priority === 'medium' ? 'selected' : ''}>${t('hd.prioMedium')}</option>
            <option value="high" ${tk.priority === 'high' ? 'selected' : ''}>${t('hd.prioHigh')}</option>
            <option value="urgent" ${tk.priority === 'urgent' ? 'selected' : ''}>${t('hd.prioUrgent')}</option>
          </select>${isAiPriority ? '<span class="hd-ai-tag" title="Prioritet sat af AI">AI</span>' : ''}
          <select class="hd-inline-select hd-inline-status ${statusClass}" onchange="HelpdeskList.inlineUpdate('${tk.id}', 'status', this.value)">
            <option value="open" ${tk.status === 'open' ? 'selected' : ''}>${t('hd.statusOpen')}</option>
            <option value="in_progress" ${tk.status === 'in_progress' ? 'selected' : ''}>${t('hd.statusInProgress')}</option>
            <option value="resolved" ${tk.status === 'resolved' ? 'selected' : ''}>${t('hd.statusResolved')}</option>
            <option value="closed" ${tk.status === 'closed' ? 'selected' : ''}>${t('hd.statusClosed')}</option>
          </select>
          <select class="hd-inline-select hd-inline-assignee" onchange="HelpdeskList.inlineUpdate('${tk.id}', 'assignee_id', this.value)">
            <option value="" ${!tk.assignee_id ? 'selected' : ''}>${t('hd.notAssigned')}</option>
            ${this._teamMembers.map(m => `<option value="${m.id}" ${tk.assignee_id === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
  },

  _timeAgo(dateStr: string): string {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('hd.justNow');
    if (diffMin < 60) return `${diffMin}${t('hd.mAgo')}`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}${t('hd.hAgo')}`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}${t('hd.dAgo')}`;
    return d.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' });
  },

  /* ── Filters ── */
  /* ── Gmail sync ── */
  async _syncInbox(): Promise<void> {
    if (this._syncing) return;
    this._syncing = true;
    try {
      const result = await GmailAPI.syncInbox();
      this._lastSyncResult = result;
      if (result.synced > 0) {
        (window as any).App.toast(`${result.created} ${t('hd.newTicketsToast')}, ${result.updated} ${t('hd.updatedFromInbox')}`, 'success');
        (window as any).App.render();
      }
    } catch {
      /* silent fail on auto-sync */
    } finally {
      this._syncing = false;
    }
  },

  async inlineUpdate(ticketId: string, field: string, value: string): Promise<void> {
    try {
      await HelpdeskAPI.update(ticketId, { [field]: value || null });
      // Update local state
      const tk = this._tickets.find(t2 => t2.id === ticketId);
      if (tk) {
        (tk as any)[field] = value || null;
        if (field === 'assignee_id') {
          const member = this._teamMembers.find(m => m.id === value);
          (tk as any).assignee_name = member ? member.name : null;
        }
      }
      (window as any).App.render();
    } catch {
      (window as any).App.toast(t('common.somethingWrong'), 'error');
    }
  },

  async manualSync(): Promise<void> {
    const btn = document.getElementById('hd-sync-btn') as HTMLButtonElement | null;
    if (btn) { btn.innerHTML = `<span class="vp-spinner"></span> ${t('hd.syncing')}`; btn.disabled = true; }

    this._syncing = true;
    try {
      const result = await GmailAPI.syncInbox();
      this._lastSyncResult = result;
      if (result.synced > 0) {
        (window as any).App.toast(`${result.created} ${t('hd.newTicketsToast')}, ${result.updated} ${t('hd.updatedFromInbox')}`, 'success');
        (window as any).App.render();
      } else {
        (window as any).App.toast(t('hd.noNewEmails'), 'info');
      }
    } catch {
      (window as any).App.toast(t('hd.syncFailed'), 'error');
    } finally {
      this._syncing = false;
      if (btn) {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> ${t('hd.syncInbox')}`;
        btn.disabled = false;
      }
    }
  },

  filterStatus(status: string): void {
    // Clicking the already-active filter resets to default "open" view
    if (this._filterStatus === status) {
      this._filterStatus = 'open';
    } else {
      this._filterStatus = status;
    }
    (window as any).App.render();
  },

  filterBySelect(): void {
    const el = document.getElementById('hd-filter-status') as HTMLSelectElement | null;
    if (el) {
      this._filterStatus = el.value;
      (window as any).App.render();
    }
  },

  filterByPrioritySelect(): void {
    const el = document.getElementById('hd-filter-priority') as HTMLSelectElement | null;
    if (el) {
      this._filterPriority = el.value;
      (window as any).App.render();
    }
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
          <h3>${t('hd.newTicket')}</h3>
          <button class="btn-icon" onclick="HelpdeskList.closeModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="tl-modal-body">
          <div class="form-group">
            <label class="form-label">${t('hd.subject')} <span style="color: var(--error)">*</span></label>
            <input class="input" type="text" id="hd-subject" placeholder="${t('hd.subjectPlaceholder')}">
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">${t('hd.requester')}</label>
              <input class="input" type="text" id="hd-requester-name" placeholder="${t('hd.namePlaceholder')}">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Email</label>
              <input class="input" type="email" id="hd-requester-email" placeholder="${t('hd.emailPlaceholder')}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">${t('hd.filterPriority')} <span class="hd-ai-hint">${t('hd.aiClassifies')}</span></label>
              <select class="input" id="hd-priority">
                <option value="medium" selected>${t('hd.autoAI')}</option>
                <option value="low">${t('hd.prioLow')}</option>
                <option value="high">${t('hd.prioHigh')}</option>
                <option value="urgent">${t('hd.prioUrgent')}</option>
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">${t('hd.category')} <span class="hd-ai-hint">${t('hd.setAuto')}</span></label>
              <select class="input" id="hd-category">
                <option value="">${t('hd.autoAI')}</option>
                <option value="billing">${t('hd.catBilling')}</option>
                <option value="technical">${t('hd.catTechnical')}</option>
                <option value="onboarding">${t('hd.catOnboarding')}</option>
                <option value="general">${t('hd.catGeneral')}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">${t('hd.source')}</label>
              <select class="input" id="hd-source">
                <option value="manual" selected>${t('hd.sourceManual')}</option>
                <option value="email">Email</option>
                <option value="chat">Chat</option>
                <option value="app">People's Clinic App</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${t('hd.assignTo')}</label>
            <select class="input" id="hd-assignee">
              <option value="">${t('hd.notAssigned')}</option>
              ${memberOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${t('hd.description')}</label>
            <textarea class="input" id="hd-description" rows="4" placeholder="${t('hd.detailsPlaceholder')}"></textarea>
          </div>
        </div>
        <div class="tl-modal-footer">
          <button class="btn" onclick="HelpdeskList.closeModal()">${t('hd.cancel')}</button>
          <button class="btn btn-primary" id="hd-create-btn" onclick="HelpdeskList.createTicket()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            ${t('hd.createTicket')}
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

    if (btn) { btn.innerHTML = `<span class="vp-spinner"></span> ${t('hd.creating')}`; btn.disabled = true; }

    try {
      await HelpdeskAPI.create({
        subject, description, priority, category, source,
        requester_name: requesterName,
        requester_email: requesterEmail,
        assignee_id: assigneeId,
      });
      (window as any).App.toast(t('hd.ticketCreated'), 'success');
      this.closeModal();
      (window as any).App.render();
    } catch (err: any) {
      if (btn) { btn.innerHTML = t('hd.createTicket'); btn.disabled = false; }
      (window as any).App.toast(err.message || t('hd.ticketCreateFailed'), 'error');
    }
  },
};

// Expose globally
(window as any).HelpdeskList = HelpdeskList;
