/* ═══════════════════════════════════════════
   Marketing Flow Editor — Form-based step management
   with drag-and-drop, template preview, and improved UX
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

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  draft: { label: 'Kladde', class: 'mk-status-draft' },
  active: { label: 'Aktiv', class: 'mk-status-active' },
  paused: { label: 'Pauseret', class: 'mk-status-paused' },
};

export const MarketingFlowEditor = {
  _el: null as HTMLElement | null,
  _flow: null as MarketingFlow | null,
  _previewHtml: null as { subject: string; body_html: string; template_html?: string; preview_user: { name: string; clinic_name: string } } | null,
  _previewStepId: null as string | null,
  _loadingPreview: false,
  _showTemplatePreview: false,
  _showEnrollModal: false,
  _users: null as OnboardingUser[] | null,
  _enrollSearch: '',
  _selectedUserIds: [] as string[],
  _dragStepId: null as string | null,

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
      this._showTemplatePreview = false;
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
    const mp = (window as any).MarketingPage;
    if (mp) { mp._flows = null; mp._stats = null; }
    (window as any).App.render();
  },

  _renderEditor(): void {
    if (!this._el || !this._flow) return;
    const f = this._flow;
    const steps = f.steps || [];
    const enrollments = f.enrollments || [];
    const statusCfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.draft;

    // Steps with flow connectors
    const stepsHtml = steps.map((step, i) => {
      const config = step.config || {};
      const isEmail = step.step_type === 'email';
      const isWait = step.step_type === 'wait';
      const isCondition = step.step_type === 'condition';

      const connector = i < steps.length - 1 ? `
        <div class="mk-step-connector">
          <div class="mk-step-connector-line"></div>
          <svg class="mk-step-connector-arrow" width="10" height="10" viewBox="0 0 10 10"><path d="M5 0 L10 5 L5 10" fill="none" stroke="var(--border)" stroke-width="1.5"/></svg>
        </div>` : '';

      return `
        <div class="mk-step-card ${this._dragStepId === step.id ? 'mk-step-dragging' : ''}"
             data-step-id="${step.id}"
             draggable="true"
             ondragstart="MarketingFlowEditor._onDragStart(event, '${step.id}')"
             ondragover="MarketingFlowEditor._onDragOver(event)"
             ondrop="MarketingFlowEditor._onDrop(event, '${step.id}')"
             ondragend="MarketingFlowEditor._onDragEnd()">
          <div class="mk-step-header">
            <span class="mk-step-drag-handle" title="Tr\u00e6k for at \u00e6ndre r\u00e6kkef\u00f8lge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            </span>
            <span class="mk-step-number">${i + 1}</span>
            ${STEP_ICONS[step.step_type] || ''}
            <span class="mk-step-type">${isEmail ? 'Email' : isWait ? 'Ventetid' : 'Betingelse'}</span>
            <button class="btn-icon mk-step-delete" onclick="MarketingFlowEditor.deleteStep('${step.id}')" title="Slet trin">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          ${isEmail ? `
            <div class="mk-step-body">
              <div class="form-group">
                <label class="form-label">Brief til AI <span class="mk-step-hint">Beskriv hvad emailen skal kommunikere</span></label>
                <textarea class="textarea mk-step-input" id="step-brief-${step.id}" rows="2" placeholder="F.eks. &quot;Byd brugeren velkommen og forklar hvordan de booker en konsultation&quot;"
                  onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'brief', this.value)">${escapeHtml(config.brief || '')}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Emne-hint <span class="mk-step-hint">Valgfrit — AI genererer ellers selv</span></label>
                <input class="input mk-step-input" id="step-subject-${step.id}" type="text" placeholder="F.eks. &quot;Velkommen til People's Clinic&quot;"
                  value="${escapeHtml(config.subject_hint || '')}"
                  onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'subject_hint', this.value)">
              </div>
              <button class="btn btn-xs ${this._loadingPreview && this._previewStepId === step.id ? 'btn-loading' : ''}"
                onclick="MarketingFlowEditor.previewStep('${step.id}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ${this._loadingPreview && this._previewStepId === step.id ? 'Genererer...' : 'Preview email'}
              </button>
              ${this._previewHtml && this._previewStepId === step.id ? `
                <div class="mk-preview-box">
                  <div class="mk-preview-header">
                    <div class="mk-preview-meta">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      Preview for: ${escapeHtml(this._previewHtml.preview_user.name)} (${escapeHtml(this._previewHtml.preview_user.clinic_name)})
                    </div>
                    <div class="mk-preview-actions">
                      <button class="btn btn-xs ${this._showTemplatePreview ? 'btn-primary' : ''}" onclick="MarketingFlowEditor.toggleTemplatePreview()">
                        ${this._showTemplatePreview ? 'Vis tekst' : 'Vis i email-skabelon'}
                      </button>
                    </div>
                  </div>
                  <div class="mk-preview-subject"><strong>Emne:</strong> ${escapeHtml(this._previewHtml.subject)}</div>
                  ${this._showTemplatePreview && this._previewHtml.template_html ? `
                    <div class="mk-preview-template">
                      <iframe class="mk-preview-iframe" srcdoc="${escapeHtml(this._previewHtml.template_html)}" sandbox=""></iframe>
                    </div>
                  ` : `
                    <div class="mk-preview-body">${this._previewHtml.body_html}</div>
                  `}
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${isWait ? `
            <div class="mk-step-body">
              <div class="form-group">
                <label class="form-label">Vent antal dage <span class="mk-step-hint">F\u00f8r n\u00e6ste trin k\u00f8res</span></label>
                <input class="input" type="number" min="1" value="${config.days || 3}" style="max-width: 100px"
                  onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'days', parseInt(this.value))">
              </div>
            </div>
          ` : ''}

          ${isCondition ? `
            <div class="mk-step-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Tjek betingelse</label>
                  <select class="select" onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'check', this.value)">
                    <option value="has_consultation" ${config.check === 'has_consultation' ? 'selected' : ''}>Har haft konsultation</option>
                    <option value="health_above" ${config.check === 'health_above' ? 'selected' : ''}>Health score over gr\u00e6nse</option>
                    <option value="health_below" ${config.check === 'health_below' ? 'selected' : ''}>Health score under gr\u00e6nse</option>
                    <option value="is_active" ${config.check === 'is_active' ? 'selected' : ''}>Bruger er aktiv</option>
                    <option value="days_since_signup" ${config.check === 'days_since_signup' ? 'selected' : ''}>Dage siden signup</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Hvis ikke opfyldt</label>
                  <select class="select" onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'if_false', this.value)">
                    <option value="skip_rest" ${config.if_false === 'skip_rest' ? 'selected' : ''}>Stop flow</option>
                    <option value="continue" ${config.if_false === 'continue' ? 'selected' : ''}>Forts\u00e6t alligevel</option>
                  </select>
                </div>
              </div>
              ${config.check === 'health_above' || config.check === 'health_below' ? `
                <div class="form-group" style="margin-top: var(--space-2)">
                  <label class="form-label">Gr\u00e6nseværdi</label>
                  <input class="input" type="number" min="0" max="100" value="${config.threshold || 50}" style="max-width: 100px"
                    onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'threshold', parseInt(this.value))">
                </div>
              ` : ''}
              ${config.check === 'days_since_signup' ? `
                <div class="form-group" style="margin-top: var(--space-2)">
                  <label class="form-label">Minimum dage</label>
                  <input class="input" type="number" min="0" value="${config.min_days || 7}" style="max-width: 100px"
                    onchange="MarketingFlowEditor.updateStepConfig('${step.id}', 'min_days', parseInt(this.value))">
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
        ${connector}
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

    const enrollModal = this._showEnrollModal ? this._renderEnrollModal() : '';

    this._el!.innerHTML = `
      <div class="modal-panel mk-editor-panel">
        <div class="modal-header">
          <div class="mk-editor-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <h3>${escapeHtml(f.name)}</h3>
            <span class="mk-badge ${statusCfg.class}">${statusCfg.label}</span>
          </div>
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
                <label class="form-label">Trigger <span class="mk-step-hint">Hvorn\u00e5r starter flowet</span></label>
                <select class="select" id="mk-ed-trigger"
                  onchange="MarketingFlowEditor.updateField('trigger_type', this.value)">
                  ${Object.entries(TRIGGER_LABELS).map(([k, v]) => `<option value="${k}" ${f.trigger_type === k ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Beskrivelse</label>
              <input class="input" id="mk-ed-desc" type="text" value="${escapeHtml(f.description)}" placeholder="Kort beskrivelse af flowets form\u00e5l..."
                onchange="MarketingFlowEditor.updateField('description', this.value)">
            </div>
          </div>

          <div class="mk-steps-header">
            <h4>Trin <span class="mk-steps-count">${steps.length}</span></h4>
            <span class="mk-steps-hint">Tr\u00e6k for at \u00e6ndre r\u00e6kkef\u00f8lge</span>
          </div>

          <div class="mk-steps-list" id="mk-steps-list">
            ${stepsHtml || '<div class="mk-empty mk-empty-sm">Ingen trin endnu. Tilf\u00f8j et trin nedenfor.</div>'}
          </div>

          <div class="mk-add-step-section">
            <div class="mk-add-step-label">Tilf\u00f8j trin:</div>
            <div class="mk-add-step-buttons">
              <button class="mk-add-step-btn" onclick="MarketingFlowEditor.addStep('email')">
                <div class="mk-add-step-icon mk-add-step-email">${STEP_ICONS.email}</div>
                <div class="mk-add-step-info">
                  <span class="mk-add-step-name">Email</span>
                  <span class="mk-add-step-desc">Send en AI-personaliseret email</span>
                </div>
              </button>
              <button class="mk-add-step-btn" onclick="MarketingFlowEditor.addStep('wait')">
                <div class="mk-add-step-icon mk-add-step-wait">${STEP_ICONS.wait}</div>
                <div class="mk-add-step-info">
                  <span class="mk-add-step-name">Ventetid</span>
                  <span class="mk-add-step-desc">Vent X dage f\u00f8r n\u00e6ste trin</span>
                </div>
              </button>
              <button class="mk-add-step-btn" onclick="MarketingFlowEditor.addStep('condition')">
                <div class="mk-add-step-icon mk-add-step-condition">${STEP_ICONS.condition}</div>
                <div class="mk-add-step-info">
                  <span class="mk-add-step-name">Betingelse</span>
                  <span class="mk-add-step-desc">Tjek brugerdata f\u00f8r n\u00e6ste trin</span>
                </div>
              </button>
            </div>
          </div>

          ${enrollHtml}
        </div>

        <div class="modal-footer mk-editor-footer">
          <div class="mk-editor-footer-left">
            ${f.status === 'draft' || f.status === 'paused'
              ? `<button class="btn btn-primary" onclick="MarketingFlowEditor.activate()" title="Start automatisk afsendelse baseret p\u00e5 trigger">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Aktiv\u00e9r flow
                </button>`
              : `<button class="btn btn-warning-outline" onclick="MarketingFlowEditor.pause()" title="Stop automatisk afsendelse midlertidigt">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  Paus\u00e9r flow
                </button>`
            }
            <button class="btn" onclick="MarketingFlowEditor.showEnroll()" title="Tilf\u00f8j brugere manuelt til dette flow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              Tilmeld brugere
            </button>
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

  /* ── Template preview toggle ── */
  toggleTemplatePreview(): void {
    this._showTemplatePreview = !this._showTemplatePreview;
    this._renderEditor();
  },

  /* ── DRAG & DROP ── */
  _onDragStart(e: DragEvent, stepId: string): void {
    this._dragStepId = stepId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', stepId);
    }
  },

  _onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  },

  async _onDrop(e: DragEvent, targetStepId: string): Promise<void> {
    e.preventDefault();
    if (!this._flow || !this._dragStepId || this._dragStepId === targetStepId) return;

    const steps = this._flow.steps || [];
    const dragIdx = steps.findIndex(s => s.id === this._dragStepId);
    const dropIdx = steps.findIndex(s => s.id === targetStepId);
    if (dragIdx < 0 || dropIdx < 0) return;

    // Reorder locally
    const [moved] = steps.splice(dragIdx, 1);
    steps.splice(dropIdx, 0, moved);

    // Update step_order
    const stepIds = steps.map(s => s.id);
    this._dragStepId = null;
    this._renderEditor();

    try {
      await fetch(`/api/marketing/flows/${this._flow.id}/reorder-steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_ids: stepIds }),
      });
      this._flow = await MarketingAPI.getFlow(this._flow.id);
      this._renderEditor();
    } catch {
      (window as any).App.toast('Kunne ikke \u00e6ndre r\u00e6kkef\u00f8lge', 'error');
    }
  },

  _onDragEnd(): void {
    this._dragStepId = null;
  },

  /* ── STEP ACTIONS ── */
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
    this._showTemplatePreview = false;
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

  /* ── FLOW ACTIONS ── */
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
      (window as any).App.toast('Flow aktiveret \u2014 emails sendes nu automatisk', 'success');
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
      (window as any).App.toast('Flow pauseret \u2014 ingen nye emails sendes', 'info');
      this._renderEditor();
    } catch {
      (window as any).App.toast('Kunne ikke pausere', 'error');
    }
  },

  /* ── ENROLLMENT ── */
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
