/* ═══════════════════════════════════════════
   Marketing Flow Editor — Form-based step management
   ═══════════════════════════════════════════ */

import { MarketingAPI, OnboardingAPI } from '../api';
import { escapeHtml } from '../utils';
import type { MarketingFlow, MarketingFlowStep, MarketingEnrollment, OnboardingUser } from '../types';

const TRIGGER_LABELS: Record<string, string> = {
  signup: 'Ved signup',
  inactive_14d: '14 dage inaktiv',
  inactive_30d: '30 dage inaktiv',
  negative_feedback: 'Negativ feedback',
  stuck_onboarding: 'Stuck onboarding',
  health_drop: 'Health score fald',
  manual: 'Manuel',
};

const STEP_ICONS: Record<string, string> = {
  email: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  wait: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  condition: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
};

export const MarketingFlowEditor = {
  _el: null as HTMLElement | null,
  _flow: null as MarketingFlow | null,
  _previewHtml: null as { subject: string; body_html: string; preview_user: { name: string; clinic_name: string } } | null,
  _previewStepId: null as string | null,
  _loadingPreview: false,
  _showEnrollModal: false,
  _users: null as OnboardingUser[] | null,
  _enrollSearch: '',
  _selectedUserIds: [] as string[],

  init(): void {
    this._el = document.getElementById('marketing-editor-modal');
    if (!this._el) return;
    this._el.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this._el) this.close();
    });
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this._el?.classList.contains('open')) this.close();
    });
  },

  async open(flowId: string): Promise<void> {
    if (!this._el) {
      // Create the modal element if it doesn't exist
      const div = document.createElement('div');
      div.id = 'marketing-editor-modal';
      div.className = 'modal-overlay';
      document.body.appendChild(div);
      this._el = div;
      this._el.addEventListener('click', (e: MouseEvent) => {
        if (e.target === this._el) this.close();
      });
    }

    try {
      this._flow = await MarketingAPI.getFlow(flowId);
      this._previewHtml = null;
      this._previewStepId = null;
      this._showEnrollModal = false;
      this._renderEditor();
      this._el!.classList.add('open');
    } catch {
      (window as any).App.toast('Kunne ikke indl\u00e6se flow', 'error');
    }
  },

  close(): void {
    if (this._el) this._el.classList.remove('open');
    this._flow = null;
    this._previewHtml = null;
    // Refresh the marketing page data
    const mp = (window as any).MarketingPage;
    if (mp) {
      mp._flows = null;
      mp._stats = null;
    }
    (window as any).App.render();
  },

  _renderEditor(): void {
    if (!this._el || !this._flow) return;
    const f = this._flow;
    const steps = f.steps || [];
    const enrollments = f.enrollments || [];
    const isDraft = f.status === 'draft';

    const stepsHtml = steps.map((step, i) => {
      const config = step.config || {};
      const isEmail = step.step_type === 'email';
      const isWait = step.step_type === 'wait';
      const isCondition = step.step_type === 'condition';

      return `
        <div class="mk-step-card" data-step-id="${step.id}">
          <div class="mk-step-header">
            <span class="mk-step-number">${i + 1}</span>
            ${STEP_ICONS[step.step_type] || ''}
            <span class="mk-step-type">${isEmail ? 'Email' : isWait ? 'Vent' : 'Betingelse'}</span>
            <button class="btn-icon mk-step-delete" onclick="MarketingFlowEditor.deleteStep('${step.id}')" title="Slet trin">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          ${isEmail ? `
            <div class="mk-step-body">
              <div class="form-group">
                <label class="form-label">Brief til AI</label>
                <textarea class="textarea mk-step-input" id="step-brief-${step.id}" rows="2" placeholder="Beskriv hvad emailen skal handle om..."
                  onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'brief', this.value)">${escapeHtml(config.brief || '')}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Emne-hint</label>
                <input class="input mk-step-input" id="step-subject-${step.id}" type="text" placeholder="Valgfrit emne-hint..."
                  value="${escapeHtml(config.subject_hint || '')}"
                  onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'subject_hint', this.value)">
              </div>
              <button class="btn btn-xs ${this._loadingPreview && this._previewStepId === step.id ? 'btn-loading' : ''}"
                onclick="MarketingFlowEditor.previewStep('${step.id}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Preview email
              </button>
              ${this._previewHtml && this._previewStepId === step.id ? `
                <div class="mk-preview-box">
                  <div class="mk-preview-meta">Preview for: ${escapeHtml(this._previewHtml.preview_user.name)} (${escapeHtml(this._previewHtml.preview_user.clinic_name)})</div>
                  <div class="mk-preview-subject"><strong>Emne:</strong> ${escapeHtml(this._previewHtml.subject)}</div>
                  <div class="mk-preview-body">${this._previewHtml.body_html}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${isWait ? `
            <div class="mk-step-body">
              <div class="form-group">
                <label class="form-label">Vent antal dage</label>
                <input class="input" type="number" min="1" value="${config.days || 3}"
                  onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'days', parseInt(this.value))">
              </div>
            </div>
          ` : ''}

          ${isCondition ? `
            <div class="mk-step-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Tjek</label>
                  <select class="select" onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'check', this.value)">
                    <option value="has_consultation" ${config.check === 'has_consultation' ? 'selected' : ''}>Har konsultation</option>
                    <option value="health_above" ${config.check === 'health_above' ? 'selected' : ''}>Health score over</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Hvis falsk</label>
                  <select class="select" onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'if_false', this.value)">
                    <option value="skip_rest" ${config.if_false === 'skip_rest' ? 'selected' : ''}>Spring resten over</option>
                    <option value="continue" ${config.if_false === 'continue' ? 'selected' : ''}>Forts\u00e6t alligevel</option>
                  </select>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Enrollments list
    const enrollHtml = enrollments.length > 0 ? `
      <div class="mk-enrollments-section">
        <h4>Tilmeldte brugere (${enrollments.length})</h4>
        <div class="mk-enrollment-list">
          ${enrollments.slice(0, 20).map(e => `
            <div class="mk-enrollment-row">
              <span class="mk-enrollment-name">${escapeHtml(e.user_name || '')}</span>
              <span class="mk-enrollment-clinic">${escapeHtml(e.clinic_name || '')}</span>
              <span class="mk-enrollment-status mk-enrollment-${e.status}">${e.status === 'active' ? 'Aktiv' : e.status === 'completed' ? 'F\u00e6rdig' : 'Annulleret'}</span>
              <span class="mk-enrollment-step">Trin ${e.current_step + 1}</span>
              ${e.status === 'active' ? `<button class="btn btn-xs" onclick="MarketingFlowEditor.cancelEnrollment('${e.id}')">Annuller</button>` : ''}
            </div>
          `).join('')}
          ${enrollments.length > 20 ? `<div class="mk-enrollment-more">+ ${enrollments.length - 20} flere...</div>` : ''}
        </div>
      </div>
    ` : '';

    // Enroll modal
    const enrollModal = this._showEnrollModal ? this._renderEnrollModal() : '';

    this._el!.innerHTML = `
      <div class="modal-panel mk-editor-panel">
        <div class="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            ${escapeHtml(f.name)}
          </h3>
          <button class="btn-icon" onclick="MarketingFlowEditor.close()" aria-label="Luk">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal-body mk-editor-body">
          <div class="mk-editor-meta">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Flownavn</label>
                <input class="input" id="mk-ed-name" type="text" value="${escapeHtml(f.name)}"
                  onchange="MarketingFlowEditor.updateField('name', this.value)">
              </div>
              <div class="form-group">
                <label class="form-label">Trigger</label>
                <select class="select" id="mk-ed-trigger"
                  onchange="MarketingFlowEditor.updateField('trigger_type', this.value)">
                  ${Object.entries(TRIGGER_LABELS).map(([k, v]) => `<option value="${k}" ${f.trigger_type === k ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Beskrivelse</label>
              <input class="input" id="mk-ed-desc" type="text" value="${escapeHtml(f.description)}" placeholder="Kort beskrivelse..."
                onchange="MarketingFlowEditor.updateField('description', this.value)">
            </div>
          </div>

          <div class="mk-steps-header">
            <h4>Trin</h4>
          </div>

          <div class="mk-steps-list">
            ${stepsHtml || '<div class="mk-empty mk-empty-sm">Ingen trin endnu. Tilf\u00f8j et trin nedenfor.</div>'}
          </div>

          <div class="mk-add-step-bar">
            <button class="btn btn-xs btn-primary" onclick="MarketingFlowEditor.addStep('email')">
              ${STEP_ICONS.email} Email
            </button>
            <button class="btn btn-xs" onclick="MarketingFlowEditor.addStep('wait')">
              ${STEP_ICONS.wait} Vent
            </button>
            <button class="btn btn-xs" onclick="MarketingFlowEditor.addStep('condition')">
              ${STEP_ICONS.condition} Betingelse
            </button>
          </div>

          ${enrollHtml}
        </div>

        <div class="modal-footer">
          <div class="mk-editor-footer-left">
            ${f.status === 'draft' || f.status === 'paused'
              ? `<button class="btn btn-primary" onclick="MarketingFlowEditor.activate()">Aktiv\u00e9r flow</button>`
              : `<button class="btn" onclick="MarketingFlowEditor.pause()">Paus\u00e9r flow</button>`
            }
            <button class="btn" onclick="MarketingFlowEditor.showEnroll()">Tilmeld brugere</button>
          </div>
          <button class="btn" onclick="MarketingFlowEditor.close()">Luk</button>
        </div>
      </div>
      ${enrollModal}
    `;
  },

  _renderEnrollModal(): string {
    const users = this._users || [];
    const search = this._enrollSearch.toLowerCase();
    const filtered = search
      ? users.filter(u => u.name.toLowerCase().includes(search) || u.clinic_name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
      : users;

    return `
      <div class="mk-enroll-overlay" onclick="if(event.target===this) MarketingFlowEditor.hideEnroll()">
        <div class="mk-enroll-panel">
          <h4>Tilmeld brugere til flow</h4>
          <input class="input" type="text" placeholder="S\u00f8g bruger..." value="${escapeHtml(this._enrollSearch)}"
            oninput="MarketingFlowEditor._enrollSearch = this.value; MarketingFlowEditor._renderEditor()">
          <div class="mk-enroll-list">
            ${filtered.slice(0, 30).map(u => `
              <label class="mk-enroll-row">
                <input type="checkbox" value="${u.id}" ${this._selectedUserIds.includes(u.id) ? 'checked' : ''}
                  onchange="MarketingFlowEditor.toggleUser('${u.id}')">
                <span>${escapeHtml(u.name)}</span>
                <span class="text-tertiary">${escapeHtml(u.clinic_name)}</span>
              </label>
            `).join('')}
          </div>
          <div class="mk-enroll-actions">
            <button class="btn btn-primary" onclick="MarketingFlowEditor.submitEnroll()"
              ${this._selectedUserIds.length === 0 ? 'disabled' : ''}>
              Tilmeld ${this._selectedUserIds.length} bruger${this._selectedUserIds.length !== 1 ? 'e' : ''}
            </button>
            <button class="btn" onclick="MarketingFlowEditor.hideEnroll()">Annuller</button>
          </div>
        </div>
      </div>
    `;
  },

  /* ────────── STEP ACTIONS ────────── */
  async addStep(stepType: string): Promise<void> {
    if (!this._flow) return;
    const defaultConfig: Record<string, any> = {};
    if (stepType === 'email') { defaultConfig.brief = ''; defaultConfig.subject_hint = ''; }
    if (stepType === 'wait') { defaultConfig.days = 3; }
    if (stepType === 'condition') { defaultConfig.check = 'has_consultation'; defaultConfig.if_false = 'skip_rest'; }

    try {
      await MarketingAPI.addStep(this._flow.id, { step_type: stepType, config: defaultConfig });
      this._flow = await MarketingAPI.getFlow(this._flow.id);
      this._renderEditor();
      (window as any).App.toast('Trin tilf\u00f8jet', 'success');
    } catch {
      (window as any).App.toast('Kunne ikke tilf\u00f8je trin', 'error');
    }
  },

  async deleteStep(stepId: string): Promise<void> {
    if (!this._flow) return;
    if (!confirm('Slet dette trin?')) return;
    try {
      await MarketingAPI.deleteStep(this._flow.id, stepId);
      this._flow = await MarketingAPI.getFlow(this._flow.id);
      this._renderEditor();
      (window as any).App.toast('Trin slettet', 'info');
    } catch {
      (window as any).App.toast('Kunne ikke slette trin', 'error');
    }
  },

  async updateStepConfig(stepId: string, key: string, value: any): Promise<void> {
    if (!this._flow) return;
    const step = (this._flow.steps || []).find(s => s.id === stepId);
    if (!step) return;

    const newConfig = { ...(step.config || {}), [key]: value };
    try {
      await MarketingAPI.updateStep(this._flow.id, stepId, { config: newConfig });
      step.config = newConfig;
    } catch {
      (window as any).App.toast('Kunne ikke opdatere trin', 'error');
    }
  },

  async previewStep(stepId: string): Promise<void> {
    if (!this._flow) return;
    this._loadingPreview = true;
    this._previewStepId = stepId;
    this._previewHtml = null;
    this._renderEditor();

    try {
      const result = await MarketingAPI.previewStep(this._flow.id, stepId);
      if (result.error) {
        (window as any).App.toast(result.error, 'error');
        this._loadingPreview = false;
        this._renderEditor();
        return;
      }
      this._previewHtml = result as any;
      this._loadingPreview = false;
      this._renderEditor();
    } catch {
      this._loadingPreview = false;
      (window as any).App.toast('Preview fejlede', 'error');
      this._renderEditor();
    }
  },

  /* ────────── FLOW ACTIONS ────────── */
  async updateField(field: string, value: string): Promise<void> {
    if (!this._flow) return;
    try {
      await MarketingAPI.updateFlow(this._flow.id, { [field]: value } as any);
      (this._flow as any)[field] = value;
    } catch {
      (window as any).App.toast('Kunne ikke opdatere', 'error');
    }
  },

  async activate(): Promise<void> {
    if (!this._flow) return;
    try {
      const result = await MarketingAPI.activateFlow(this._flow.id);
      if (result.error) {
        (window as any).App.toast(result.error, 'error');
        return;
      }
      this._flow.status = 'active';
      (window as any).App.toast('Flow aktiveret', 'success');
      this._renderEditor();
    } catch {
      (window as any).App.toast('Kunne ikke aktivere', 'error');
    }
  },

  async pause(): Promise<void> {
    if (!this._flow) return;
    try {
      await MarketingAPI.pauseFlow(this._flow.id);
      this._flow.status = 'paused';
      (window as any).App.toast('Flow pauseret', 'info');
      this._renderEditor();
    } catch {
      (window as any).App.toast('Kunne ikke pausere', 'error');
    }
  },

  /* ────────── ENROLLMENT ────────── */
  async showEnroll(): Promise<void> {
    this._showEnrollModal = true;
    this._selectedUserIds = [];
    this._enrollSearch = '';
    if (!this._users) {
      try { this._users = await OnboardingAPI.getUsers(); } catch { this._users = []; }
    }
    this._renderEditor();
  },

  hideEnroll(): void {
    this._showEnrollModal = false;
    this._renderEditor();
  },

  toggleUser(userId: string): void {
    const idx = this._selectedUserIds.indexOf(userId);
    if (idx >= 0) {
      this._selectedUserIds.splice(idx, 1);
    } else {
      this._selectedUserIds.push(userId);
    }
  },

  async submitEnroll(): Promise<void> {
    if (!this._flow || this._selectedUserIds.length === 0) return;
    try {
      const result = await MarketingAPI.enrollUsers(this._flow.id, this._selectedUserIds);
      (window as any).App.toast(`${result.enrolled} bruger(e) tilmeldt`, 'success');
      this._showEnrollModal = false;
      this._flow = await MarketingAPI.getFlow(this._flow.id);
      this._renderEditor();
    } catch {
      (window as any).App.toast('Kunne ikke tilmelde brugere', 'error');
    }
  },

  async cancelEnrollment(enrollmentId: string): Promise<void> {
    if (!this._flow) return;
    try {
      await MarketingAPI.cancelEnrollment(enrollmentId);
      this._flow = await MarketingAPI.getFlow(this._flow.id);
      this._renderEditor();
      (window as any).App.toast('Enrollment annulleret', 'info');
    } catch {
      (window as any).App.toast('Fejl ved annullering', 'error');
    }
  },
};

(window as any).MarketingFlowEditor = MarketingFlowEditor;
