/* ═══════════════════════════════════════════
   DPA Manager — Internal DPA overview & management
   3 tabs: Oversigt, Dokumenter, Audit Log
   ═══════════════════════════════════════════ */

import { DPAAPI } from '../api';
import { escapeHtml } from '../utils';
import type { DPADocument, DPASigning, DPAStats, DPAPendingCustomer } from '../types';

export const DPAManager = {
  _tab: 'overview' as 'overview' | 'documents' | 'audit',
  _stats: null as DPAStats | null,
  _pending: [] as DPAPendingCustomer[],
  _history: [] as DPASigning[],
  _documents: [] as DPADocument[],
  _auditLog: [] as DPASigning[],
  _selectedIds: new Set<string>(),
  _bulkLanguage: 'da' as string,

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
      this._stats = { unsigned_count: 0, pending_count: 0, signed_count: 0, expired_count: 0, needs_attention_count: 0 };
    }

    const st = this._stats!;

    const hasDocs = this._documents.length > 0;

    return `
      <div class="dpa-container">
        <div class="dpa-header">
          <h2 class="dpa-title">Databehandleraftaler (DPA)</h2>
          ${!hasDocs ? '<div class="dpa-warning">Du skal uploade en DPA-PDF f\u00f8r du kan sende underskriftslinks.</div>' : ''}
        </div>

        <div class="dpa-stats">
          <div class="dpa-stat-card">
            <span class="dpa-stat-num">${st.unsigned_count}</span>
            <span class="dpa-stat-label">Mangler DPA</span>
          </div>
          <div class="dpa-stat-card">
            <span class="dpa-stat-num">${st.pending_count}</span>
            <span class="dpa-stat-label">Afventer svar</span>
          </div>
          <div class="dpa-stat-card dpa-stat-success">
            <span class="dpa-stat-num">${st.signed_count}</span>
            <span class="dpa-stat-label">Underskrevet</span>
          </div>
          ${st.needs_attention_count > 0 ? `
          <div class="dpa-stat-card dpa-stat-warning">
            <span class="dpa-stat-num">${st.needs_attention_count}</span>
            <span class="dpa-stat-label">Kr\u00e6ver opm\u00e6rksomhed</span>
          </div>` : ''}
        </div>

        <div class="dpa-tabs">
          <button class="dpa-tab ${this._tab === 'overview' ? 'dpa-tab-active' : ''}" onclick="DPAManager.setTab('overview')">Oversigt</button>
          <button class="dpa-tab ${this._tab === 'documents' ? 'dpa-tab-active' : ''}" onclick="DPAManager.setTab('documents')">Dokumenter</button>
          <button class="dpa-tab ${this._tab === 'audit' ? 'dpa-tab-active' : ''}" onclick="DPAManager.setTab('audit')">Audit Log</button>
        </div>

        <div class="dpa-tab-content">
          ${this._tab === 'overview' ? this._renderOverview() : ''}
          ${this._tab === 'documents' ? this._renderDocuments() : ''}
          ${this._tab === 'audit' ? this._renderAuditLog() : ''}
        </div>
      </div>
    `;
  },

  /* ── Tab: Oversigt ── */
  _renderOverview(): string {
    const hasDocs = this._documents.some(d => d.is_current);

    // Split history into pending and signed
    const pendingSignings = this._history.filter(h => h.status === 'pending');
    const signedSignings = this._history.filter(h => h.status === 'signed');

    // Customers without any signing sent
    const unsent = this._pending.filter(c => !c.latest_signing_id);
    const sent = this._pending.filter(c => c.latest_signing_id && c.latest_signing_status === 'pending');

    const selectedCount = this._selectedIds.size;

    let html = '';

    // Needs attention warning
    if (this._stats && this._stats.needs_attention_count > 0) {
      html += `<div class="dpa-alert dpa-alert-warning">
        <strong>${this._stats.needs_attention_count} kunde(r)</strong> har ikke underskrevet efter 2 p\u00e5mindelser. Overv\u00e6j personlig opf\u00f8lgning.
      </div>`;
    }

    // Customers needing DPA
    if (unsent.length > 0 && hasDocs) {
      html += `<div class="dpa-section">
        <h3 class="dpa-section-title">Kunder der mangler DPA (${unsent.length})</h3>
        <div class="dpa-customer-list">
          ${unsent.map(c => `
            <div class="dpa-customer-row">
              <label class="dpa-checkbox">
                <input type="checkbox" ${this._selectedIds.has(c.id) ? 'checked' : ''} onchange="DPAManager.toggleSelect('${c.id}')">
              </label>
              <div class="dpa-customer-info">
                <span class="dpa-customer-name">${escapeHtml(c.name)}</span>
                <span class="dpa-customer-email">${escapeHtml(c.contact_email || 'Ingen email')}</span>
              </div>
              <div class="dpa-customer-actions">
                <select class="dpa-lang-select" id="dpa-lang-${c.id}">
                  <option value="da">DK</option>
                  <option value="en">EN</option>
                </select>
                <button class="btn btn-primary btn-sm" onclick="DPAManager.sendDPA('${c.id}')" ${!c.contact_email ? 'disabled title="Ingen email"' : ''}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  Send
                </button>
              </div>
            </div>
          `).join('')}
        </div>
        ${selectedCount > 0 ? `
          <div class="dpa-bulk-bar">
            <select class="dpa-lang-select" id="dpa-bulk-lang" onchange="DPAManager._bulkLanguage = this.value">
              <option value="da">Dansk</option>
              <option value="en">English</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="DPAManager.sendBulk()">
              Send til alle valgte (${selectedCount})
            </button>
          </div>
        ` : ''}
      </div>`;
    } else if (!hasDocs) {
      html += `<div class="dpa-empty">
        <p>Upload en DPA-PDF under <strong>Dokumenter</strong>-fanen f\u00f8r du kan sende underskriftslinks.</p>
      </div>`;
    } else if (unsent.length === 0 && this._pending.length === 0) {
      html += `<div class="dpa-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <p>Alle kunder har underskrevet deres DPA!</p>
      </div>`;
    }

    // Sent & awaiting
    if (pendingSignings.length > 0) {
      html += `<div class="dpa-section">
        <h3 class="dpa-section-title">Sendt & afventer (${pendingSignings.length})</h3>
        <div class="dpa-signing-list">
          ${pendingSignings.map(s => `
            <div class="dpa-signing-row">
              <div class="dpa-signing-info">
                <span class="dpa-signing-name">${escapeHtml(s.customer_name || '')}</span>
                <span class="dpa-signing-meta">
                  Sendt ${this._formatDate(s.sent_at)} \u00b7 v${s.document_version || '?'} ${s.language === 'da' ? 'DK' : 'EN'}
                  ${s.reminder_count > 0 ? ` \u00b7 ${s.reminder_count} p\u00e5mindelse(r)` : ''}
                </span>
              </div>
              <div class="dpa-signing-actions">
                ${s.cs_notified ? '<span class="dpa-badge dpa-badge-warning">Kr\u00e6ver opm.</span>' : '<span class="dpa-badge dpa-badge-pending">Afventer</span>'}
                <button class="btn btn-sm" onclick="DPAManager.sendReminderDPA('${s.id}')">P\u00e5mind</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // Recently signed
    if (signedSignings.length > 0) {
      const recent = signedSignings.slice(0, 10);
      html += `<div class="dpa-section">
        <h3 class="dpa-section-title">Seneste underskrifter</h3>
        <div class="dpa-signing-list">
          ${recent.map(s => `
            <div class="dpa-signing-row">
              <div class="dpa-signing-info">
                <span class="dpa-signing-name">${escapeHtml(s.customer_name || '')}</span>
                <span class="dpa-signing-meta">
                  Underskrevet ${this._formatDate(s.signed_at || '')} \u00b7 v${s.document_version || '?'} ${s.language === 'da' ? 'DK' : 'EN'}
                  \u00b7 ${escapeHtml(s.signer_name)}
                </span>
              </div>
              <span class="dpa-badge dpa-badge-signed">Underskrevet</span>
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

    // Count signings per version
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
          <h3 class="dpa-section-title">Upload ny DPA-version</h3>
          <div class="dpa-upload-form">
            <div class="form-row" style="gap: 12px; align-items: end;">
              <div class="form-group" style="flex:0 0 80px">
                <label class="form-label">Version</label>
                <input class="input" type="number" id="dpa-upload-version" value="${currentVersion + 1}" min="1">
              </div>
              <div class="form-group" style="flex:0 0 100px">
                <label class="form-label">Sprog</label>
                <select class="input" id="dpa-upload-lang">
                  <option value="da">Dansk</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div class="form-group" style="flex:1">
                <label class="form-label">PDF-fil</label>
                <input class="input" type="file" id="dpa-upload-file" accept=".pdf">
              </div>
              <button class="btn btn-primary btn-sm" id="dpa-upload-btn" onclick="DPAManager.uploadDocument()">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    if (versions.length === 0) {
      html += `<div class="dpa-empty"><p>Ingen DPA-dokumenter uploadet endnu.</p></div>`;
    } else {
      for (const v of versions) {
        const docs = grouped[v];
        const signedOnVersion = versionCounts[v] || 0;
        const isCurrent = docs.some(d => d.is_current);

        html += `<div class="dpa-section">
          <h3 class="dpa-section-title">Version ${v} ${isCurrent ? '<span class="dpa-badge dpa-badge-signed">Aktuel</span>' : ''}</h3>
          ${signedOnVersion > 0 ? `<p class="dpa-doc-meta">${signedOnVersion} kunde(r) har underskrevet denne version</p>` : ''}
          <div class="dpa-doc-list">
            ${docs.map(d => `
              <div class="dpa-doc-row">
                <div class="dpa-doc-info">
                  <span class="dpa-doc-lang">${d.language === 'da' ? 'DK' : 'EN'}</span>
                  <span class="dpa-doc-name">${escapeHtml(d.filename)}</span>
                  <span class="dpa-doc-size">${d.file_size ? Math.round(d.file_size / 1024) + ' KB' : ''}</span>
                </div>
                <div class="dpa-doc-actions">
                  <a href="/api/dpa/documents/${d.id}/download" target="_blank" class="btn btn-sm">Download</a>
                  ${!d.is_current ? `<button class="btn btn-sm" onclick="DPAManager.setCurrentDoc('${d.id}')">S\u00e6t som aktuel</button>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
      }

      // Warning about old versions
      const oldVersionCount = this._history.filter(s =>
        s.status === 'signed' && s.document_version && s.document_version < currentVersion
      ).length;
      if (oldVersionCount > 0) {
        html += `<div class="dpa-alert dpa-alert-info">
          <strong>${oldVersionCount} kunde(r)</strong> har underskrevet en \u00e6ldre version af DPA'en. Overv\u00e6j at sende den nye version til dem.
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
          <h3 class="dpa-section-title">Fuld audit log (for Datatilsynet)</h3>
          <a href="/api/dpa/audit-log/csv" target="_blank" class="btn btn-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Eksporter CSV
          </a>
        </div>
    `;

    if (log.length === 0) {
      html += '<div class="dpa-empty"><p>Ingen DPA-handlinger endnu.</p></div>';
    } else {
      html += '<div class="dpa-audit-list">';
      for (const entry of log) {
        const isSigned = entry.status === 'signed';
        const date = isSigned ? entry.signed_at : entry.sent_at;
        const action = isSigned
          ? `<strong>${escapeHtml(entry.customer_name || '')}</strong> underskrev DPA v${entry.document_version || '?'} (${entry.language === 'da' ? 'dansk' : 'engelsk'})`
          : `DPA v${entry.document_version || '?'} (${entry.language === 'da' ? 'dansk' : 'engelsk'}) sendt til <strong>${escapeHtml(entry.customer_name || '')}</strong>`;

        html += `
          <div class="dpa-audit-entry">
            <div class="dpa-audit-date">${this._formatDateTime(date || '')}</div>
            <div class="dpa-audit-action">${action}</div>
            ${isSigned ? `
              <div class="dpa-audit-detail">
                Underskriver: ${escapeHtml(entry.signer_name)}${entry.signer_title ? `, ${escapeHtml(entry.signer_title)}` : ''}
                \u00b7 IP: ${entry.ip_address || 'Ukendt'}
                \u00b7 <a href="/api/dpa/${entry.token}/certificate" target="_blank">Se certifikat</a>
              </div>
            ` : `
              <div class="dpa-audit-detail">Sendt af: ${escapeHtml(entry.sent_by || 'System')}</div>
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

  toggleSelect(customerId: string): void {
    if (this._selectedIds.has(customerId)) {
      this._selectedIds.delete(customerId);
    } else {
      this._selectedIds.add(customerId);
    }
    (window as any).App.render();
  },

  async sendDPA(customerId: string): Promise<void> {
    const langEl = document.getElementById(`dpa-lang-${customerId}`) as HTMLSelectElement | null;
    const lang = langEl?.value || 'da';

    if (!confirm(`Send DPA til denne kunde?`)) return;

    try {
      const result = await DPAAPI.send(customerId, lang);
      if (result.ok) {
        (window as any).App.toast('DPA-link sendt!', 'success');
        (window as any).App.render();
      } else {
        (window as any).App.toast(result.error || 'Fejl ved afsendelse', 'error');
      }
    } catch {
      (window as any).App.toast('Kunne ikke sende DPA', 'error');
    }
  },

  async sendBulk(): Promise<void> {
    const ids = Array.from(this._selectedIds);
    if (ids.length === 0) return;

    if (!confirm(`Send DPA til ${ids.length} kunde(r)?`)) return;

    try {
      const result = await DPAAPI.sendBulk(ids, this._bulkLanguage);
      (window as any).App.toast(`${result.sent} DPA(er) sendt. ${result.errors.length} fejl.`, result.errors.length > 0 ? 'warning' : 'success');
      this._selectedIds.clear();
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Fejl ved bulk-afsendelse', 'error');
    }
  },

  async sendReminderDPA(signingId: string): Promise<void> {
    if (!confirm('Send p\u00e5mindelse til denne kunde?')) return;

    try {
      const result = await DPAAPI.sendReminder(signingId);
      if (result.ok) {
        (window as any).App.toast('P\u00e5mindelse sendt', 'success');
        (window as any).App.render();
      } else {
        (window as any).App.toast(result.error || 'Fejl', 'error');
      }
    } catch {
      (window as any).App.toast('Kunne ikke sende p\u00e5mindelse', 'error');
    }
  },

  async uploadDocument(): Promise<void> {
    const fileInput = document.getElementById('dpa-upload-file') as HTMLInputElement | null;
    const versionInput = document.getElementById('dpa-upload-version') as HTMLInputElement | null;
    const langSelect = document.getElementById('dpa-upload-lang') as HTMLSelectElement | null;
    const btn = document.getElementById('dpa-upload-btn') as HTMLButtonElement | null;

    if (!fileInput?.files?.[0]) {
      (window as any).App.toast('V\u00e6lg en PDF-fil', 'error');
      return;
    }

    const version = parseInt(versionInput?.value || '1');
    const language = langSelect?.value || 'da';
    const file = fileInput.files[0];

    if (btn) { btn.innerHTML = '<span class="vp-spinner"></span> Uploader...'; btn.disabled = true; }

    try {
      const result = await DPAAPI.uploadDocument(file, version, language, '');
      if (result.error) {
        (window as any).App.toast(result.error, 'error');
      } else {
        (window as any).App.toast('DPA-dokument uploadet!', 'success');
        (window as any).App.render();
      }
    } catch {
      (window as any).App.toast('Fejl ved upload', 'error');
    } finally {
      if (btn) { btn.innerHTML = 'Upload'; btn.disabled = false; }
    }
  },

  async setCurrentDoc(docId: string): Promise<void> {
    try {
      await DPAAPI.setCurrentDocument(docId);
      (window as any).App.toast('Dokument sat som aktuel version', 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Fejl', 'error');
    }
  },

  /* ── Helpers ── */
  _formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  },

  _formatDateTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  },
};

// Expose globally
(window as any).DPAManager = DPAManager;
