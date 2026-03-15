/* ═══════════════════════════════════════════
   Helpdesk Detail — Ticket conversation view
   ═══════════════════════════════════════════ */

import { HelpdeskAPI, TeamAPI } from '../api';
import { escapeHtml } from '../utils';
import type { Ticket, TicketMessage, TeamMember } from '../types';

const STATUS_LABELS: Record<string, string> = {
  open: '\u00c5ben',
  in_progress: 'I gang',
  resolved: 'L\u00f8st',
  closed: 'Lukket',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Lav',
  medium: 'Medium',
  high: 'H\u00f8j',
  urgent: 'Akut',
};

export const HelpdeskDetail = {
  _ticket: null as (Ticket & { messages?: TicketMessage[] }) | null,
  _teamMembers: [] as TeamMember[],

  /* ── Main render ── */
  async render(ticketId: string): Promise<string> {
    try {
      this._ticket = await HelpdeskAPI.get(ticketId);
    } catch {
      return `<div class="hd-empty"><p>Kunne ikke indl\u00e6se ticket.</p></div>`;
    }

    if (!this._ticket || (this._ticket as any).error) {
      return `<div class="hd-empty"><p>Ticket ikke fundet.</p></div>`;
    }

    if (this._teamMembers.length === 0) {
      try { this._teamMembers = await TeamAPI.getAll(); } catch { /* */ }
    }

    const t = this._ticket;
    const messages = t.messages || [];

    const statusLabel = STATUS_LABELS[t.status] || t.status;
    const prioLabel = PRIORITY_LABELS[t.priority] || t.priority;
    const assigneeName = t.assignee_name || 'Ikke tildelt';

    const memberOptions = this._teamMembers
      .map(m => `<option value="${m.id}" ${t.assignee_id === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`)
      .join('');

    // Messages thread
    const messagesHTML = messages.length > 0 ? messages.map(msg => `
      <div class="hd-msg ${msg.is_internal ? 'hd-msg-internal' : ''} ${msg.sender_type === 'requester' ? 'hd-msg-requester' : ''}">
        <div class="hd-msg-header">
          <span class="hd-msg-sender">${escapeHtml(msg.sender_name || (msg.sender_type === 'agent' ? 'Agent' : 'Indsender'))}</span>
          ${msg.is_internal ? '<span class="hd-msg-internal-badge">Intern note</span>' : ''}
          <span class="hd-msg-time">${new Date(msg.created_at).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="hd-msg-body">${escapeHtml(msg.body)}</div>
      </div>
    `).join('') : '<p class="hd-no-messages">Ingen beskeder endnu.</p>';

    return `
      <div class="hd-detail">
        <div class="hd-detail-top">
          <button class="btn btn-sm" onclick="App.navigateTo('helpdesk')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            Tilbage
          </button>
          <span class="hd-detail-id">${escapeHtml(t.id)}</span>
        </div>

        <div class="hd-detail-layout">
          <div class="hd-detail-main">
            <h3 class="hd-detail-subject">${escapeHtml(t.subject)}</h3>
            ${t.description ? `<p class="hd-detail-desc">${escapeHtml(t.description)}</p>` : ''}

            <div class="hd-messages">
              <h4 class="hd-messages-title">Samtale</h4>
              ${messagesHTML}
            </div>

            <div class="hd-reply-box">
              <textarea class="input" id="hd-reply-body" rows="3" placeholder="Skriv et svar..."></textarea>
              <div class="hd-reply-actions">
                <label class="hd-internal-check">
                  <input type="checkbox" id="hd-reply-internal"> Intern note
                </label>
                <div class="hd-reply-buttons">
                  <button class="btn btn-sm hd-ai-btn" id="hd-ai-btn" onclick="HelpdeskDetail.aiSuggest('${t.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>
                    Generér svar
                  </button>
                  <button class="btn btn-primary btn-sm" onclick="HelpdeskDetail.sendReply('${t.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="hd-detail-sidebar">
            <div class="hd-sidebar-section">
              <label class="hd-sidebar-label">Status</label>
              <select class="input" id="hd-detail-status" onchange="HelpdeskDetail.updateField('${t.id}', 'status', this.value)">
                <option value="open" ${t.status === 'open' ? 'selected' : ''}>\u00c5ben</option>
                <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>I gang</option>
                <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>L\u00f8st</option>
                <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>Lukket</option>
              </select>
            </div>
            <div class="hd-sidebar-section">
              <label class="hd-sidebar-label">Prioritet</label>
              <select class="input" id="hd-detail-priority" onchange="HelpdeskDetail.updateField('${t.id}', 'priority', this.value)">
                <option value="low" ${t.priority === 'low' ? 'selected' : ''}>Lav</option>
                <option value="medium" ${t.priority === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="high" ${t.priority === 'high' ? 'selected' : ''}>H\u00f8j</option>
                <option value="urgent" ${t.priority === 'urgent' ? 'selected' : ''}>Akut</option>
              </select>
            </div>
            <div class="hd-sidebar-section">
              <label class="hd-sidebar-label">Tildelt til</label>
              <select class="input" id="hd-detail-assignee" onchange="HelpdeskDetail.updateField('${t.id}', 'assignee_id', this.value)">
                <option value="">Ikke tildelt</option>
                ${memberOptions}
              </select>
            </div>
            ${t.requester_name || t.requester_email ? `
              <div class="hd-sidebar-section">
                <label class="hd-sidebar-label">Indsender</label>
                ${t.requester_name ? `<div class="hd-sidebar-value">${escapeHtml(t.requester_name)}</div>` : ''}
                ${t.requester_email ? `<div class="hd-sidebar-value hd-sidebar-email">${escapeHtml(t.requester_email)}</div>` : ''}
              </div>
            ` : ''}
            <div class="hd-sidebar-section">
              <label class="hd-sidebar-label">Kilde</label>
              <div class="hd-sidebar-value">${t.source === 'manual' ? 'Manuel' : t.source === 'email' ? 'Email' : t.source === 'outbound_email' ? 'Udg\u00e5ende email' : t.source === 'outbound_message' ? 'Udg\u00e5ende besked' : t.source === 'chat' ? 'Chat' : t.source === 'app' ? "People's Clinic App" : t.source}</div>
            </div>
            <div class="hd-sidebar-section">
              <label class="hd-sidebar-label">Oprettet</label>
              <div class="hd-sidebar-value">${new Date(t.created_at).toLocaleString('da-DK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            ${t.platform_user_id ? `
              <div class="hd-sidebar-section hd-user-context">
                <label class="hd-sidebar-label">Platform-bruger</label>
                <div class="hd-user-context-card">
                  <div class="hd-user-context-name">${escapeHtml(t.platform_user_name || '')}</div>
                  <div class="hd-user-context-clinic">${escapeHtml((t as any).platform_user_clinic || '')}</div>
                  <div class="hd-user-context-stats">
                    <div class="hd-user-context-stat">
                      <span class="hd-user-context-stat-label">Health</span>
                      <span class="hd-user-context-stat-value" style="color:${((t as any).platform_user_health || 0) >= 70 ? 'var(--success)' : ((t as any).platform_user_health || 0) >= 40 ? 'var(--warning)' : 'var(--error)'}">${(t as any).platform_user_health || 0}</span>
                    </div>
                    <div class="hd-user-context-stat">
                      <span class="hd-user-context-stat-label">Status</span>
                      <span class="hd-user-context-stat-value">${(t as any).platform_user_status || '\u2014'}</span>
                    </div>
                    <div class="hd-user-context-stat">
                      <span class="hd-user-context-stat-label">Kons.</span>
                      <span class="hd-user-context-stat-value">${(t as any).platform_user_consultations ?? '\u2014'}</span>
                    </div>
                    <div class="hd-user-context-stat">
                      <span class="hd-user-context-stat-label">Gns. rating</span>
                      <span class="hd-user-context-stat-value">${(t as any).platform_user_avg_rating ? Number((t as any).platform_user_avg_rating).toFixed(1) : '\u2014'}</span>
                    </div>
                  </div>
                  <button class="btn btn-sm" style="margin-top:var(--space-2);width:100%" onclick="App.navigateTo('onboarding')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    Se i dashboard
                  </button>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  /* ── Update ticket field ── */
  async updateField(ticketId: string, field: string, value: string): Promise<void> {
    try {
      await HelpdeskAPI.update(ticketId, { [field]: value || null });
      (window as any).App.toast('Ticket opdateret', 'success');
    } catch {
      (window as any).App.toast('Kunne ikke opdatere', 'error');
    }
  },

  /* ── AI suggest ── */
  async aiSuggest(ticketId: string): Promise<void> {
    const btn = document.getElementById('hd-ai-btn') as HTMLButtonElement | null;
    const bodyEl = document.getElementById('hd-reply-body') as HTMLTextAreaElement | null;
    if (!btn || !bodyEl) return;

    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg class="hd-ai-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Genererer...`;

    try {
      const result = await HelpdeskAPI.aiSuggest(ticketId);
      if (result.suggestion) {
        bodyEl.value = result.suggestion;
        bodyEl.focus();
        (window as any).App.toast('AI-forslag genereret', 'success');
      } else {
        (window as any).App.toast(result.error || 'Kunne ikke generere forslag', 'error');
      }
    } catch {
      (window as any).App.toast('AI-forslag fejlede — tjek API-nøgle', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  },

  /* ── Send reply ── */
  async sendReply(ticketId: string): Promise<void> {
    const bodyEl = document.getElementById('hd-reply-body') as HTMLTextAreaElement | null;
    const internalEl = document.getElementById('hd-reply-internal') as HTMLInputElement | null;

    if (!bodyEl) return;
    const body = bodyEl.value.trim();
    if (!body) { bodyEl.style.borderColor = 'var(--error)'; bodyEl.focus(); return; }

    const isInternal = internalEl?.checked || false;

    try {
      await HelpdeskAPI.addMessage(ticketId, {
        body,
        sender_type: 'agent',
        sender_name: 'Support',
        is_internal: isInternal,
      });
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke sende besked', 'error');
    }
  },
};

// Expose globally
(window as any).HelpdeskDetail = HelpdeskDetail;
