/* ═══════════════════════════════════════════
   DPA Manager — Manual DPA sending & tracking
   3 tabs: Send & Track, Dokumenter, Audit Log
   ═══════════════════════════════════════════ */

import { DPAAPI } from '../api';
import { escapeHtml } from '../utils';
import { t, getLocale } from '../i18n';
import type { DPADocument, DPASigning, DPAStats, DPAPendingCustomer } from '../types';

export const DPAManager = {
  _tab: 'overview' as 'overview' | 'documents' | 'audit',
  _stats: null as DPAStats | null,
  _pending: [] as DPAPendingCustomer[],
  _history: [] as DPASigning[],
  _documents: [] as DPADocument[],
  _sending: false,

  async render(): Promise<string> {
    try {
      const [stats, pending, history, docs] = await Promise.all([
        DPAAPI.getStats(),
        DPAAPI.getPending(),
        DPAAPI.getHistory(),
        DPAAPI.getDocuments(),
      ]);
      this._stats = stats;
      this._pending = pending;
      this._history = history;
      this._documents = docs;
    } catch {
      this._stats = { pending_count: 0, signed_count: 0, expired_count: 0, needs_attention_count: 0, total_sent: 0 };
    }

    const st = this._stats!;
    const hasDocs = this._documents.length > 0;

    return `
      <div class="dpa-container">
        <div class="dpa-header">
          <h2 class="dpa-title">${t('dpa.title')}</h2>
          ${!hasDocs ? `<div class="dpa-warning">${t('dpa.uploadWarning')}</div>` : ''}
        </div>

        <div class="dpa-stats">
          <div class="dpa-stat-card">
            <span class="dpa-stat-num">${st.total_sent}</span>
            <span class="dpa-stat-label">${t('dpa.totalSent')}</span>
          </div>
          <div class="dpa-stat-card dpa-stat-warning">
            <span class="dpa-stat-num">${st.pending_count}</span>
            <span class="dpa-stat-label">${t('dpa.pending')}</span>
          </div>
          <div class="dpa-stat-card dpa-stat-success">
            <span class="dpa-stat-num">${st.signed_count}</span>
            <span class="dpa-stat-label">${t('dpa.signed')}</span>
          </div>
          ${st.needs_attention_count > 0 ? `
          <div class="dpa-stat-card" style="border-color: var(--error)">
            <span class="dpa-stat-num" style="color: var(--error)">${st.needs_attention_count}</span>
            <span class="dpa-stat-label">${t('dpa.needsAttention')}</span>
          </div>` : ''}
        </div>

        <div class="dpa-tabs">
          <button class="dpa-tab ${this._tab === 'overview' ? 'dpa-tab-active' : ''}" onclick="DPAManager.setTab('overview')">${t('dpa.tabSendTrack')}</button>
          <button class="dpa-tab ${this._tab === 'documents' ? 'dpa-tab-active' : ''}" onclick="DPAManager.setTab('documents')">${t('dpa.tabDocuments')}</button>
          <button class="dpa-tab ${this._tab === 'audit' ? 'dpa-tab-active' : ''}" onclick="DPAManager.setTab('audit')">${t('dpa.tabAuditLog')}</button>
        </div>

        <div class="dpa-tab-content">
          ${this._tab === 'overview' ? this._renderOverview() : ''}
          ${this._tab === 'documents' ? this._renderDocuments() : ''}
          ${this._tab === 'audit' ? this._renderAuditLog() : ''}
        </div>
      </div>
    `;
  },

  /* ── Tab: Send & Track ── */
  _renderOverview(): string {
    const hasDocs = this._documents.some(d => d.is_current);
    const signedSignings = this._history.filter(h => h.status === 'signed');

    let html = '';

    // Send form
    if (hasDocs) {
      html += `
        <div class="dpa-section dpa-send-section">
          <h3 class="dpa-section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            ${t('dpa.sendTitle')}
          </h3>
          <div class="dpa-send-form">
            <div class="form-row">
              <div class="form-group" style="flex: 1">
                <label class="form-label">${t('dpa.name')} <span style="color: var(--error)">*</span></label>
                <input class="input" type="text" id="dpa-send-name" placeholder="${t('dpa.contactNamePlaceholder')}">
              </div>
              <div class="form-group" style="flex: 1">
                <label class="form-label">${t('dpa.email')} <span style="color: var(--error)">*</span></label>
                <input class="input" type="email" id="dpa-send-email" placeholder="${t('dpa.emailPlaceholder')}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex: 1">
                <label class="form-label">${t('dpa.company')}</label>
                <input class="input" type="text" id="dpa-send-company" placeholder="${t('dpa.optional')}">
              </div>
              <div class="form-group" style="flex: 0 0 120px">
                <label class="form-label">${t('dpa.language')}</label>
                <select class="input" id="dpa-send-lang">
                  <option value="da">${t('dpa.langDa')}</option>
                  <option value="en">${t('dpa.langEn')}</option>
                </select>
              </div>
            </div>
            <div style="margin-top: var(--space-2); display: flex; justify-content: flex-end;">
              <button class="btn btn-primary ${this._sending ? 'btn-loading' : ''}" id="dpa-send-btn" onclick="DPAManager.sendManual()" ${this._sending ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                ${this._sending ? t('dpa.sending') : t('dpa.sendBtn')}
              </button>
            </div>
          </div>
        </div>`;
    } else {
      html += `<div class="dpa-empty">
        <p>${t('dpa.uploadWarning')}</p>
      </div>`;
    }

    // Needs attention warning
    if (this._stats && this._stats.needs_attention_count > 0) {
      html += `<div class="dpa-alert dpa-alert-warning">
        <strong>${this._stats.needs_attention_count} ${t('dpa.modtager')}</strong> ${t('dpa.attentionWarning')}
      </div>`;
    }

    // Pending signings
    if (this._pending.length > 0) {
      html += `<div class="dpa-section">
        <h3 class="dpa-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${t('dpa.pendingSignatures')} (${this._pending.length})
        </h3>
        <div class="dpa-signing-list">
          ${this._pending.map(s => `
            <div class="dpa-signing-row ${s.cs_notified ? 'dpa-signing-attention' : ''}">
              <div class="dpa-signing-info">
                <span class="dpa-signing-name">${escapeHtml(s.display_name)}</span>
                <span class="dpa-signing-email">${escapeHtml(s.display_email)}</span>
                ${s.display_company ? `<span class="dpa-signing-company">${escapeHtml(s.display_company)}</span>` : ''}
                <span class="dpa-signing-meta">
                  ${t('dpa.sent')} ${this._formatDate(s.sent_at)} \u00b7 v${s.document_version || '?'} ${s.language === 'da' ? 'DK' : 'EN'}
                  ${s.reminder_count > 0 ? ` \u00b7 ${s.reminder_count} ${t('dpa.reminders')}` : ''}
                </span>
              </div>
              <div class="dpa-signing-actions">
                ${s.cs_notified ? `<span class="dpa-badge dpa-badge-warning">${t('dpa.needsAttention')}</span>` : `<span class="dpa-badge dpa-badge-pending">${t('dpa.pendingBadge')}</span>`}
                <button class="btn btn-sm" onclick="DPAManager.sendReminderDPA('${s.id}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  ${t('dpa.remind')}
                </button>
                <button class="dpa-archive-btn" data-id="${s.id}" data-name="${escapeHtml(s.display_name)}" onclick="DPAManager.archiveSigning(this.dataset.id, this.dataset.name)" title="${t('dpa.removeFromList')}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // No pending & no send form = empty state
    if (this._pending.length === 0 && hasDocs) {
      html += `<div class="dpa-section">
        <div class="dpa-empty" style="padding: var(--space-4)">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p>${t('dpa.noPending')}</p>
        </div>
      </div>`;
    }

    // Recently signed
    if (signedSignings.length > 0) {
      const recent = signedSignings.slice(0, 10);
      html += `<div class="dpa-section">
        <h3 class="dpa-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          ${t('dpa.recentSignatures')}
        </h3>
        <div class="dpa-signing-list">
          ${recent.map(s => `
            <div class="dpa-signing-row">
              <div class="dpa-signing-info">
                <span class="dpa-signing-name">${escapeHtml(s.customer_name || s.recipient_name || '')}</span>
                <span class="dpa-signing-meta">
                  ${t('dpa.signedAt')} ${this._formatDate(s.signed_at || '')} \u00b7 v${s.document_version || '?'} ${s.language === 'da' ? 'DK' : 'EN'}
                  \u00b7 ${escapeHtml(s.signer_name)}
                </span>
              </div>
              <div class="dpa-signing-actions">
                <a href="/api/dpa/${s.token}/certificate" target="_blank" class="btn btn-sm" title="${t('dpa.viewCertificate')}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  ${t('dpa.certificate')}
                </a>
                <a href="/api/dpa/${s.token}/pdf" target="_blank" class="btn btn-sm" title="${t('dpa.download')} PDF">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  PDF
                </a>
                <button class="dpa-archive-btn" data-id="${s.id}" data-name="${escapeHtml(s.customer_name || s.recipient_name || '')}" onclick="DPAManager.archiveSigning(this.dataset.id, this.dataset.name)" title="${t('dpa.removeFromList')}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
                <span class="dpa-badge dpa-badge-signed">${t('dpa.signedBadge')}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    return html;
  },

  /* ── Tab: Dokumenter ── */
  _renderDocuments(): string {
    const currentVersion = Math.max(0, ...this._documents.map(d => d.version));
    const grouped: Record<number, DPADocument[]> = {};
    for (const d of this._documents) {
      if (!grouped[d.version]) grouped[d.version] = [];
      grouped[d.version].push(d);
    }

    const versionCounts: Record<number, number> = {};
    for (const s of this._history) {
      if (s.status === 'signed' && s.document_version) {
        versionCounts[s.document_version] = (versionCounts[s.document_version] || 0) + 1;
      }
    }

    const versions = Object.keys(grouped).map(Number).sort((a, b) => b - a);

    let html = `
      <div class="dpa-section">
        <div class="dpa-doc-upload">
          <h3 class="dpa-section-title">${t('dpa.uploadNewVersion')}</h3>
          <div class="dpa-upload-form">
            <div class="form-row">
              <div class="form-group" style="flex:0 0 80px">
                <label class="form-label">${t('dpa.version')}</label>
                <input class="input" type="number" id="dpa-upload-version" value="${currentVersion + 1}" min="1">
              </div>
              <div class="form-group" style="flex:0 0 110px">
                <label class="form-label">${t('dpa.language')}</label>
                <select class="input" id="dpa-upload-lang">
                  <option value="da">${t('dpa.langDa')}</option>
                  <option value="en">${t('dpa.langEn')}</option>
                </select>
              </div>
              <div class="form-group" style="flex:1;min-width:180px">
                <label class="form-label">${t('dpa.pdfFile')}</label>
                <input type="file" id="dpa-upload-file" accept=".pdf">
              </div>
            </div>
            <div style="margin-top: var(--space-3); display: flex; justify-content: flex-end;">
              <button class="btn btn-primary" id="dpa-upload-btn" onclick="DPAManager.uploadDocument()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                ${t('dpa.upload')}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    if (versions.length === 0) {
      html += `<div class="dpa-empty"><p>${t('dpa.noDocuments')}</p></div>`;
    } else {
      for (const v of versions) {
        const docs = grouped[v];
        const signedOnVersion = versionCounts[v] || 0;
        const isCurrent = docs.some(d => d.is_current);

        html += `<div class="dpa-section">
          <h3 class="dpa-section-title">${t('dpa.version')} ${v} ${isCurrent ? `<span class="dpa-badge dpa-badge-signed">${t('dpa.current')}</span>` : ''}</h3>
          ${signedOnVersion > 0 ? `<p class="dpa-doc-meta">${signedOnVersion} ${t('dpa.signaturesOnVersion')}</p>` : ''}
          <div class="dpa-doc-list">
            ${docs.map(d => `
              <div class="dpa-doc-row">
                <div class="dpa-doc-info">
                  <span class="dpa-doc-lang">${d.language === 'da' ? 'DK' : 'EN'}</span>
                  <span class="dpa-doc-name">${escapeHtml(d.filename)}</span>
                  <span class="dpa-doc-size">${d.file_size ? Math.round(d.file_size / 1024) + ' KB' : ''}</span>
                </div>
                <div class="dpa-doc-actions">
                  <a href="/api/dpa/documents/${d.id}/download" target="_blank" class="btn btn-sm">${t('dpa.download')}</a>
                  ${!d.is_current ? `<button class="btn btn-sm" onclick="DPAManager.setCurrentDoc('${d.id}')">${t('dpa.setCurrent')}</button>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
      }
    }

    return html;
  },

  /* ── Tab: Audit Log ── */
  _renderAuditLog(): string {
    const log = this._history;

    let html = `
      <div class="dpa-section">
        <div class="dpa-audit-header">
          <h3 class="dpa-section-title">${t('dpa.auditTitle')}</h3>
          <div style="display: flex; gap: 8px;">
            <a href="/api/dpa/export-zip" class="btn btn-sm btn-primary" style="text-decoration:none;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              ${t('dpa.downloadZip')}
            </a>
            <a href="/api/dpa/audit-log/csv" class="btn btn-sm" style="text-decoration:none;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              ${t('dpa.exportCsv')}
            </a>
          </div>
        </div>
    `;

    if (log.length === 0) {
      html += `<div class="dpa-empty"><p>${t('dpa.noActions')}</p></div>`;
    } else {
      html += '<div class="dpa-audit-list">';
      for (const entry of log) {
        const isSigned = entry.status === 'signed';
        const date = isSigned ? entry.signed_at : entry.sent_at;
        const action = isSigned
          ? `<strong>${escapeHtml(entry.customer_name || '')}</strong> ${t('dpa.signedDpa')} v${entry.document_version || '?'} (${entry.language === 'da' ? t('dpa.da') : t('dpa.en')})`
          : `${t('dpa.title')} v${entry.document_version || '?'} (${entry.language === 'da' ? t('dpa.da') : t('dpa.en')}) ${t('dpa.sentTo')} <strong>${escapeHtml(entry.customer_name || '')}</strong>`;

        html += `
          <div class="dpa-audit-entry">
            <div class="dpa-audit-date">${this._formatDateTime(date || '')}</div>
            <div class="dpa-audit-action">${action}</div>
            ${isSigned ? `
              <div class="dpa-audit-detail">
                ${t('dpa.signer')} ${escapeHtml(entry.signer_name)}${entry.signer_title ? `, ${escapeHtml(entry.signer_title)}` : ''}
                \u00b7 ${t('dpa.ipAddress')} ${entry.ip_address || t('dpa.unknown')}
                \u00b7 <a href="/api/dpa/${entry.token}/certificate" target="_blank">${t('dpa.viewCertificate')}</a>
              </div>
            ` : `
              <div class="dpa-audit-detail">${t('dpa.sentBy')} ${escapeHtml(entry.sent_by || t('dpa.system'))}</div>
            `}
          </div>
        `;
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  /* ── Actions ── */
  setTab(tab: 'overview' | 'documents' | 'audit'): void {
    this._tab = tab;
    (window as any).App.render();
  },

  async sendManual(): Promise<void> {
    const nameEl = document.getElementById('dpa-send-name') as HTMLInputElement | null;
    const emailEl = document.getElementById('dpa-send-email') as HTMLInputElement | null;
    const companyEl = document.getElementById('dpa-send-company') as HTMLInputElement | null;
    const langEl = document.getElementById('dpa-send-lang') as HTMLSelectElement | null;

    const name = nameEl?.value?.trim() || '';
    const email = emailEl?.value?.trim() || '';
    const company = companyEl?.value?.trim() || '';
    const language = langEl?.value || 'da';

    if (!name) { nameEl?.focus(); (window as any).App.toast(t('dpa.enterName'), 'error'); return; }
    if (!email) { emailEl?.focus(); (window as any).App.toast(t('dpa.enterEmail'), 'error'); return; }
    if (!email.includes('@')) { emailEl?.focus(); (window as any).App.toast(t('dpa.invalidEmail'), 'error'); return; }

    this._sending = true;
    (window as any).App.render();

    try {
      const result = await DPAAPI.sendManual({ name, email, company, language });
      if (result.ok) {
        (window as any).App.toast(`${t('dpa.sentSuccess')} ${name}!`, 'success');
        // Clear form & reload
        this._stats = null;
        this._pending = [];
        this._history = [];
        (window as any).App.render();
      } else {
        (window as any).App.toast(result.error || t('dpa.sendError'), 'error');
      }
    } catch {
      (window as any).App.toast(t('dpa.sendFailed'), 'error');
    }
    this._sending = false;
  },

  async sendReminderDPA(signingId: string): Promise<void> {
    if (!confirm(t('dpa.confirmReminder'))) return;

    try {
      const result = await DPAAPI.sendReminder(signingId);
      if (result.ok) {
        (window as any).App.toast(t('dpa.reminderSent'), 'success');
        (window as any).App.render();
      } else {
        (window as any).App.toast(result.error || t('common.error'), 'error');
      }
    } catch {
      (window as any).App.toast(t('dpa.reminderFailed'), 'error');
    }
  },

  async uploadDocument(): Promise<void> {
    const fileInput = document.getElementById('dpa-upload-file') as HTMLInputElement | null;
    const versionInput = document.getElementById('dpa-upload-version') as HTMLInputElement | null;
    const langSelect = document.getElementById('dpa-upload-lang') as HTMLSelectElement | null;
    const btn = document.getElementById('dpa-upload-btn') as HTMLButtonElement | null;

    if (!fileInput?.files?.[0]) {
      (window as any).App.toast(t('dpa.selectPdf'), 'error');
      return;
    }

    const version = parseInt(versionInput?.value || '1');
    const language = langSelect?.value || 'da';
    const file = fileInput.files[0];

    if (btn) { btn.innerHTML = `<span class="vp-spinner"></span> ${t('dpa.uploading')}`; btn.disabled = true; }

    try {
      const result = await DPAAPI.uploadDocument(file, version, language, '');
      if (result.error) {
        (window as any).App.toast(result.error, 'error');
      } else {
        (window as any).App.toast(t('dpa.docUploaded'), 'success');
        (window as any).App.render();
      }
    } catch {
      (window as any).App.toast(t('dpa.uploadError'), 'error');
    } finally {
      if (btn) { btn.innerHTML = t('dpa.upload'); btn.disabled = false; }
    }
  },

  async archiveSigning(signingId: string, name: string): Promise<void> {
    const confirmed = confirm(`${t('dpa.confirmArchive1')} "${name}" ${t('dpa.confirmArchive2')}`);
    if (!confirmed) return;
    const doubleConfirm = confirm(`${t('dpa.confirmArchive3')} "${name}" ${t('dpa.confirmArchive4')}`);
    if (!doubleConfirm) return;

    try {
      const result = await DPAAPI.archiveSigning(signingId);
      if (result.ok) {
        (window as any).App.toast(t('dpa.removed'), 'success');
        (window as any).App.render();
      } else {
        (window as any).App.toast(result.error || t('common.error'), 'error');
      }
    } catch {
      (window as any).App.toast(t('dpa.removeFailed'), 'error');
    }
  },

  async setCurrentDoc(docId: string): Promise<void> {
    try {
      await DPAAPI.setCurrentDocument(docId);
      (window as any).App.toast(t('dpa.docSetCurrent'), 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast(t('common.error'), 'error');
    }
  },

  /* ── Helpers ── */
  _formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' });
  },

  _formatDateTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
  },
};

// Expose globally
(window as any).DPAManager = DPAManager;
