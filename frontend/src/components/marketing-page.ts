/* ═══════════════════════════════════════════
   Marketing — Flows, Segments, History, Campaign
   ═══════════════════════════════════════════ */

import { MarketingAPI } from '../api';
import { escapeHtml } from '../utils';
import type { MarketingFlow, MarketingSegment, MarketingSentEmail, MarketingStats } from '../types';

type MkTab = 'flows' | 'segments' | 'history' | 'campaign';

const TRIGGER_LABELS: Record<string, string> = {
  signup: 'Ved signup',
  inactive_14d: '14 dage inaktiv',
  inactive_30d: '30 dage inaktiv',
  negative_feedback: 'Negativ feedback',
  stuck_onboarding: 'Stuck onboarding',
  health_drop: 'Health score fald',
  manual: 'Manuel',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Kladde',
  active: 'Aktiv',
  paused: 'Pauseret',
  archived: 'Arkiveret',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--text-tertiary)',
  active: 'var(--success)',
  paused: 'var(--warning)',
  archived: 'var(--text-tertiary)',
};

export const MarketingPage = {
  _activeTab: 'flows' as MkTab,
  _flows: null as MarketingFlow[] | null,
  _templates: null as MarketingFlow[] | null,
  _segments: null as MarketingSegment[] | null,
  _history: null as MarketingSentEmail[] | null,
  _stats: null as MarketingStats | null,
  _campaignSegmentId: '',
  _campaignBrief: '',
  _campaignSubject: '',
  _campaignSending: false,
  _showTemplates: false,
  _showSegmentForm: false,
  _newSegName: '',
  _newSegDesc: '',
  _newSegRules: {} as Record<string, any>,
  _showFlowForm: false,
  _newFlowName: '',
  _newFlowTrigger: 'manual',

  setTab(tab: string): void {
    this._activeTab = tab as MkTab;
    (window as any).App.render();
  },

  async render(): Promise<string> {
    const tabs: { key: MkTab; label: string; icon: string }[] = [
      { key: 'flows', label: 'Flows', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
      { key: 'segments', label: 'Segmenter', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
      { key: 'history', label: 'Historik', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
      { key: 'campaign', label: 'Kampagne', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' },
    ];

    // Load stats
    if (!this._stats) {
      try { this._stats = await MarketingAPI.getStats(); } catch { this._stats = { total_sent: 0, sent_this_week: 0, active_flows: 0, active_enrollments: 0, per_flow: [] }; }
    }

    let content = '';
    try {
      if (this._activeTab === 'flows') content = await this._renderFlows();
      else if (this._activeTab === 'segments') content = await this._renderSegments();
      else if (this._activeTab === 'history') content = await this._renderHistory();
      else if (this._activeTab === 'campaign') content = await this._renderCampaign();
    } catch (e) {
      content = '<div class="mk-empty">Kunne ikke indl\u00e6se data.</div>';
    }

    const st = this._stats;

    return `
      <div class="mk-container">
        <div class="mk-stats-row">
          <div class="mk-stat-card">
            <div class="mk-stat-value">${st.active_flows}</div>
            <div class="mk-stat-label">Aktive flows</div>
          </div>
          <div class="mk-stat-card">
            <div class="mk-stat-value">${st.active_enrollments}</div>
            <div class="mk-stat-label">Aktive enrollments</div>
          </div>
          <div class="mk-stat-card">
            <div class="mk-stat-value">${st.sent_this_week}</div>
            <div class="mk-stat-label">Sendt denne uge</div>
          </div>
          <div class="mk-stat-card">
            <div class="mk-stat-value">${st.total_sent}</div>
            <div class="mk-stat-label">Sendt i alt</div>
          </div>
        </div>
        <div class="mk-top-bar">
          <div class="mk-tabs">
            ${tabs.map(t => `
              <button class="mk-tab ${this._activeTab === t.key ? 'mk-tab-active' : ''}"
                      onclick="MarketingPage.setTab('${t.key}')">
                ${t.icon} ${t.label}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="mk-content">${content}</div>
      </div>
    `;
  },

  /* ────────── FLOWS TAB ────────── */
  async _renderFlows(): Promise<string> {
    if (!this._flows) this._flows = await MarketingAPI.getFlows();

    const flowCards = (this._flows || []).map(f => {
      const statusColor = STATUS_COLORS[f.status] || 'var(--text-tertiary)';
      const statusLabel = STATUS_LABELS[f.status] || f.status;
      const triggerLabel = TRIGGER_LABELS[f.trigger_type] || f.trigger_type;
      return `
        <div class="mk-flow-card" onclick="MarketingPage.openFlow('${f.id}')">
          <div class="mk-flow-card-header">
            <div class="mk-flow-card-title">${escapeHtml(f.name)}</div>
            <span class="mk-flow-status" style="color:${statusColor};border-color:${statusColor}">
              ${statusLabel}
            </span>
          </div>
          <div class="mk-flow-card-meta">
            <span>Trigger: ${triggerLabel}</span>
            <span>${f.step_count || 0} trin</span>
            <span>${f.enrollment_count || 0} tilmeldt</span>
            <span>${f.sent_count || 0} emails sendt</span>
          </div>
          ${f.description ? `<div class="mk-flow-card-desc">${escapeHtml(f.description)}</div>` : ''}
          <div class="mk-flow-card-actions">
            ${f.status === 'draft' || f.status === 'paused'
              ? `<button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); MarketingPage.activateFlow('${f.id}')">Aktiv\u00e9r</button>`
              : ''}
            ${f.status === 'active'
              ? `<button class="btn btn-xs" onclick="event.stopPropagation(); MarketingPage.pauseFlow('${f.id}')">Pause</button>`
              : ''}
            <button class="btn btn-xs" onclick="event.stopPropagation(); MarketingPage.openFlow('${f.id}')">Rediger</button>
            ${f.status === 'draft'
              ? `<button class="btn btn-xs btn-danger" onclick="event.stopPropagation(); MarketingPage.deleteFlow('${f.id}')">Slet</button>`
              : ''}
          </div>
        </div>
      `;
    }).join('');

    // New flow form
    const newFlowForm = this._showFlowForm ? `
      <div class="mk-inline-form">
        <div class="form-group">
          <label class="form-label">Flownavn</label>
          <input class="input" id="mk-new-flow-name" type="text" placeholder="Fx: Velkomstflow" value="${escapeHtml(this._newFlowName)}">
        </div>
        <div class="form-group">
          <label class="form-label">Trigger</label>
          <select class="select" id="mk-new-flow-trigger">
            ${Object.entries(TRIGGER_LABELS).map(([k, v]) => `<option value="${k}" ${this._newFlowTrigger === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="mk-inline-form-actions">
          <button class="btn btn-primary" onclick="MarketingPage.submitNewFlow()">Opret</button>
          <button class="btn" onclick="MarketingPage.toggleFlowForm()">Annuller</button>
        </div>
      </div>
    ` : '';

    // Templates section
    let templatesHtml = '';
    if (this._showTemplates) {
      if (!this._templates) this._templates = await MarketingAPI.getTemplates();
      templatesHtml = `
        <div class="mk-templates-section">
          <h4>Skabeloner</h4>
          <div class="mk-templates-grid">
            ${(this._templates || []).map(t => `
              <div class="mk-template-card">
                <div class="mk-template-name">${escapeHtml(t.name)}</div>
                <div class="mk-template-desc">${escapeHtml(t.description)}</div>
                <div class="mk-template-meta">${TRIGGER_LABELS[t.trigger_type] || t.trigger_type} \u00b7 ${t.step_count || 0} trin</div>
                <button class="btn btn-xs btn-primary" onclick="MarketingPage.cloneTemplate('${t.id}')">Brug skabelon</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="mk-flows-section">
        ${flowCards || '<div class="mk-empty">Ingen flows endnu. Opret dit f\u00f8rste flow eller brug en skabelon.</div>'}
        <div class="mk-flow-actions-bar">
          <button class="btn btn-primary" onclick="MarketingPage.toggleFlowForm()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Opret flow
          </button>
          <button class="btn" onclick="MarketingPage.toggleTemplates()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            ${this._showTemplates ? 'Skjul skabeloner' : 'Brug skabelon'}
          </button>
        </div>
        ${newFlowForm}
        ${templatesHtml}
      </div>
    `;
  },

  /* ────────── SEGMENTS TAB ────────── */
  async _renderSegments(): Promise<string> {
    if (!this._segments) this._segments = await MarketingAPI.getSegments();

    const cards = (this._segments || []).map(s => `
      <div class="mk-segment-card">
        <div class="mk-segment-header">
          <div class="mk-segment-name">${escapeHtml(s.name)} ${s.is_preset ? '<span class="mk-preset-badge">Preset</span>' : ''}</div>
          <div class="mk-segment-count">${s.user_count} brugere</div>
        </div>
        ${s.description ? `<div class="mk-segment-desc">${escapeHtml(s.description)}</div>` : ''}
        <div class="mk-segment-rules">${this._formatRules(s.filter_rules)}</div>
        <div class="mk-segment-actions">
          ${!s.is_preset ? `<button class="btn btn-xs btn-danger" onclick="MarketingPage.deleteSegment('${s.id}')">Slet</button>` : ''}
        </div>
      </div>
    `).join('');

    const newSegForm = this._showSegmentForm ? `
      <div class="mk-inline-form">
        <div class="form-group">
          <label class="form-label">Segmentnavn</label>
          <input class="input" id="mk-seg-name" type="text" placeholder="Fx: VIP-kunder" value="${escapeHtml(this._newSegName)}">
        </div>
        <div class="form-group">
          <label class="form-label">Beskrivelse</label>
          <input class="input" id="mk-seg-desc" type="text" placeholder="Kort beskrivelse..." value="${escapeHtml(this._newSegDesc)}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Status (kommasepareret)</label>
            <input class="input" id="mk-seg-status" type="text" placeholder="active,onboarding">
          </div>
          <div class="form-group">
            <label class="form-label">Max health score</label>
            <input class="input" id="mk-seg-health-max" type="number" placeholder="Fx: 40">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Min dage inaktiv</label>
            <input class="input" id="mk-seg-inactive-min" type="number" placeholder="Fx: 14">
          </div>
          <div class="form-group">
            <label class="form-label">Signup dage siden (min)</label>
            <input class="input" id="mk-seg-signup-min" type="number" placeholder="Fx: 7">
          </div>
        </div>
        <div class="mk-inline-form-actions">
          <button class="btn btn-primary" onclick="MarketingPage.submitNewSegment()">Opret</button>
          <button class="btn" onclick="MarketingPage.toggleSegmentForm()">Annuller</button>
        </div>
      </div>
    ` : '';

    return `
      <div class="mk-segments-section">
        ${cards || '<div class="mk-empty">Ingen segmenter oprettet endnu.</div>'}
        <div class="mk-flow-actions-bar">
          <button class="btn btn-primary" onclick="MarketingPage.toggleSegmentForm()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Opret segment
          </button>
        </div>
        ${newSegForm}
      </div>
    `;
  },

  /* ────────── HISTORY TAB ────────── */
  async _renderHistory(): Promise<string> {
    if (!this._history) this._history = await MarketingAPI.getHistory();

    if (!this._history || this._history.length === 0) {
      return '<div class="mk-empty">Ingen emails sendt endnu.</div>';
    }

    const rows = this._history.map(e => {
      const date = e.sent_at ? new Date(e.sent_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <tr>
          <td>${date}</td>
          <td>${escapeHtml(e.user_name || '')}</td>
          <td>${escapeHtml(e.clinic_name || '')}</td>
          <td>${escapeHtml(e.flow_name || 'Kampagne')}</td>
          <td>${escapeHtml(e.subject)}</td>
          <td><span class="mk-sent-badge">${e.gmail_message_id ? 'Sendt' : 'Fejl'}</span></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="mk-history-section">
        <table class="mk-table">
          <thead>
            <tr>
              <th>Dato</th>
              <th>Bruger</th>
              <th>Klinik</th>
              <th>Flow</th>
              <th>Emne</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  /* ────────── CAMPAIGN TAB ────────── */
  async _renderCampaign(): Promise<string> {
    if (!this._segments) this._segments = await MarketingAPI.getSegments();

    const segOptions = (this._segments || []).map(s =>
      `<option value="${s.id}" ${this._campaignSegmentId === s.id ? 'selected' : ''}>${escapeHtml(s.name)} (${s.user_count} brugere)</option>`
    ).join('');

    return `
      <div class="mk-campaign-section">
        <div class="mk-campaign-info">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Send en AI-personaliseret email til alle brugere i et segment. AI'en skriver en unik email til hver bruger baseret p\u00e5 deres data.</span>
        </div>

        <div class="form-group">
          <label class="form-label">V\u00e6lg segment</label>
          <select class="select" id="mk-campaign-segment" onchange="MarketingPage._campaignSegmentId = this.value">
            <option value="">V\u00e6lg segment...</option>
            ${segOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Brief til AI</label>
          <textarea class="textarea" id="mk-campaign-brief" rows="3" placeholder="Beskriv kort hvad emailen skal handle om, fx: 'F\u00f8lg op p\u00e5 inaktive brugere og fort\u00e6l om nye features'">${escapeHtml(this._campaignBrief)}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Emne-hint (valgfrit)</label>
          <input class="input" id="mk-campaign-subject" type="text" placeholder="Fx: Nyt fra People's Clinic" value="${escapeHtml(this._campaignSubject)}">
        </div>

        <button class="btn btn-primary ${this._campaignSending ? 'btn-loading' : ''}" onclick="MarketingPage.sendCampaign()" ${this._campaignSending ? 'disabled' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          ${this._campaignSending ? 'Sender...' : 'Send kampagne'}
        </button>
      </div>
    `;
  },

  /* ────────── ACTIONS ────────── */
  openFlow(flowId: string): void {
    const { MarketingFlowEditor } = (window as any);
    if (MarketingFlowEditor) {
      MarketingFlowEditor.open(flowId);
    }
  },

  toggleFlowForm(): void {
    this._showFlowForm = !this._showFlowForm;
    (window as any).App.render();
  },

  toggleTemplates(): void {
    this._showTemplates = !this._showTemplates;
    (window as any).App.render();
  },

  toggleSegmentForm(): void {
    this._showSegmentForm = !this._showSegmentForm;
    (window as any).App.render();
  },

  async submitNewFlow(): Promise<void> {
    const name = (document.getElementById('mk-new-flow-name') as HTMLInputElement)?.value?.trim();
    const trigger = (document.getElementById('mk-new-flow-trigger') as HTMLSelectElement)?.value || 'manual';
    if (!name) { (window as any).App.toast('Indtast et flownavn', 'error'); return; }

    try {
      const result = await MarketingAPI.createFlow({ name, trigger_type: trigger });
      this._flows = null;
      this._stats = null;
      this._showFlowForm = false;
      (window as any).App.toast('Flow oprettet', 'success');
      this.openFlow(result.id);
    } catch {
      (window as any).App.toast('Kunne ikke oprette flow', 'error');
    }
  },

  async cloneTemplate(templateId: string): Promise<void> {
    try {
      const result = await MarketingAPI.cloneTemplate(templateId);
      this._flows = null;
      this._stats = null;
      this._showTemplates = false;
      (window as any).App.toast('Skabelon klonet', 'success');
      this.openFlow(result.id);
    } catch {
      (window as any).App.toast('Kunne ikke klone skabelon', 'error');
    }
  },

  async activateFlow(flowId: string): Promise<void> {
    try {
      const result = await MarketingAPI.activateFlow(flowId);
      if (result.error) {
        (window as any).App.toast(result.error, 'error');
        return;
      }
      this._flows = null;
      this._stats = null;
      (window as any).App.toast('Flow aktiveret', 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke aktivere flow', 'error');
    }
  },

  async pauseFlow(flowId: string): Promise<void> {
    try {
      await MarketingAPI.pauseFlow(flowId);
      this._flows = null;
      this._stats = null;
      (window as any).App.toast('Flow pauseret', 'info');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke pausere flow', 'error');
    }
  },

  async deleteFlow(flowId: string): Promise<void> {
    if (!confirm('Er du sikker p\u00e5, at du vil slette dette flow?')) return;
    try {
      await MarketingAPI.deleteFlow(flowId);
      this._flows = null;
      this._stats = null;
      (window as any).App.toast('Flow slettet', 'info');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke slette flow', 'error');
    }
  },

  async submitNewSegment(): Promise<void> {
    const name = (document.getElementById('mk-seg-name') as HTMLInputElement)?.value?.trim();
    const desc = (document.getElementById('mk-seg-desc') as HTMLInputElement)?.value?.trim() || '';
    if (!name) { (window as any).App.toast('Indtast et segmentnavn', 'error'); return; }

    const rules: Record<string, any> = {};
    const statusVal = (document.getElementById('mk-seg-status') as HTMLInputElement)?.value?.trim();
    if (statusVal) rules.status = statusVal.split(',').map(s => s.trim());
    const healthMax = (document.getElementById('mk-seg-health-max') as HTMLInputElement)?.value;
    if (healthMax) rules.health_score_max = parseInt(healthMax);
    const inactiveMin = (document.getElementById('mk-seg-inactive-min') as HTMLInputElement)?.value;
    if (inactiveMin) rules.days_inactive_min = parseInt(inactiveMin);
    const signupMin = (document.getElementById('mk-seg-signup-min') as HTMLInputElement)?.value;
    if (signupMin) rules.signup_days_ago_min = parseInt(signupMin);

    try {
      await MarketingAPI.createSegment({ name, description: desc, filter_rules: rules });
      this._segments = null;
      this._showSegmentForm = false;
      (window as any).App.toast('Segment oprettet', 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke oprette segment', 'error');
    }
  },

  async deleteSegment(segId: string): Promise<void> {
    if (!confirm('Er du sikker?')) return;
    try {
      await MarketingAPI.deleteSegment(segId);
      this._segments = null;
      (window as any).App.toast('Segment slettet', 'info');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke slette segment', 'error');
    }
  },

  async sendCampaign(): Promise<void> {
    const segId = (document.getElementById('mk-campaign-segment') as HTMLSelectElement)?.value;
    const brief = (document.getElementById('mk-campaign-brief') as HTMLTextAreaElement)?.value?.trim();
    const subjectHint = (document.getElementById('mk-campaign-subject') as HTMLInputElement)?.value?.trim() || '';

    if (!segId) { (window as any).App.toast('V\u00e6lg et segment', 'error'); return; }
    if (!brief) { (window as any).App.toast('Skriv et brief til AI', 'error'); return; }

    this._campaignSending = true;
    (window as any).App.render();

    try {
      const result = await MarketingAPI.sendCampaign({ segment_id: segId, brief, subject_hint: subjectHint });
      this._stats = null;
      this._history = null;
      this._campaignSending = false;
      (window as any).App.toast(`Kampagne sendt: ${result.sent} emails`, 'success');
      (window as any).App.render();
    } catch {
      this._campaignSending = false;
      (window as any).App.toast('Kampagne fejlede', 'error');
      (window as any).App.render();
    }
  },

  _formatRules(rules: Record<string, any>): string {
    if (!rules || typeof rules !== 'object') return '';
    const parts: string[] = [];
    if (rules.status) parts.push(`Status: ${Array.isArray(rules.status) ? rules.status.join(', ') : rules.status}`);
    if (rules.health_score_max) parts.push(`Health \u2264 ${rules.health_score_max}`);
    if (rules.days_inactive_min) parts.push(`Inaktiv \u2265 ${rules.days_inactive_min}d`);
    if (rules.signup_days_ago_min) parts.push(`Signup \u2265 ${rules.signup_days_ago_min}d siden`);
    if (rules.signup_days_ago_max) parts.push(`Signup \u2264 ${rules.signup_days_ago_max}d siden`);
    if (rules.has_consultation === false) parts.push('Ingen konsultation');
    return parts.length ? parts.join(' \u00b7 ') : 'Alle brugere';
  },
};

(window as any).MarketingPage = MarketingPage;
