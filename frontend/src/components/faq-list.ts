/* ═══════════════════════════════════════════
   FAQ List — Accordion-style editable Q&A
   ═══════════════════════════════════════════ */

import { FaqAPI } from '../api';
import { escapeHtml } from '../utils';
import type { FaqItem } from '../types';

const CATEGORIES = [
  'Sikkerhed & Compliance',
  'Produkt & Funktioner',
  'Pris & Praktisk',
  'Typiske Bekymringer',
];

export const FaqList = {
  _items: [] as FaqItem[],
  _openId: null as string | null,
  _activeCategory: '' as string,

  /* ── Main render ── */
  async render(): Promise<string> {
    try {
      this._items = await FaqAPI.getAll();
    } catch {
      this._items = [];
    }

    const count = this._items.length;

    // Group by category
    const grouped = new Map<string, FaqItem[]>();
    for (const cat of CATEGORIES) {
      grouped.set(cat, []);
    }
    for (const item of this._items) {
      const cat = item.category || 'Andet';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(item);
    }

    // Category filter pills
    const filterPills = `
      <div class="faq-filters">
        <button class="faq-pill ${this._activeCategory === '' ? 'faq-pill-active' : ''}" onclick="FaqList.setCategory('')">
          Alle <span class="faq-pill-count">${count}</span>
        </button>
        ${CATEGORIES.map(cat => {
          const catCount = grouped.get(cat)?.length || 0;
          if (catCount === 0) return '';
          return `<button class="faq-pill ${this._activeCategory === cat ? 'faq-pill-active' : ''}" onclick="FaqList.setCategory('${escapeHtml(cat)}')">
            ${escapeHtml(cat)} <span class="faq-pill-count">${catCount}</span>
          </button>`;
        }).join('')}
      </div>
    `;

    // Build accordion sections
    let sectionsHTML = '';
    for (const [cat, items] of grouped) {
      if (items.length === 0) continue;
      if (this._activeCategory && this._activeCategory !== cat) continue;

      sectionsHTML += `
        <div class="faq-section">
          <div class="faq-section-header">
            <span class="faq-section-title">${escapeHtml(cat)}</span>
            <span class="faq-section-count">${items.length}</span>
          </div>
          <div class="faq-section-items">
            ${items.map(item => this._renderItem(item)).join('')}
          </div>
        </div>
      `;
    }

    if (!sectionsHTML) {
      sectionsHTML = `
        <div class="faq-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p>Ingen FAQ-emner endnu.</p>
        </div>
      `;
    }

    return `
      <div class="faq-container">
        <div class="faq-header">
          ${filterPills}
          <button class="btn btn-primary btn-sm" onclick="FaqList.openModal()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tilf\u00f8j
          </button>
        </div>
        ${sectionsHTML}
      </div>
    `;
  },

  /* ── Single FAQ item (accordion) ── */
  _renderItem(item: FaqItem): string {
    const isOpen = this._openId === item.id;

    return `
      <div class="faq-item ${isOpen ? 'faq-item-open' : ''}">
        <div class="faq-question" onclick="FaqList.toggle('${item.id}')">
          <svg class="faq-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <span class="faq-q-text">${escapeHtml(item.question)}</span>
          <div class="faq-item-actions">
            <button class="faq-action-btn" onclick="event.stopPropagation(); FaqList.openModal('${item.id}')" title="Rediger">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="faq-action-btn faq-action-danger" onclick="event.stopPropagation(); FaqList.deleteItem('${item.id}')" title="Slet">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        ${isOpen ? `
          <div class="faq-answer">
            <p>${escapeHtml(item.answer)}</p>
          </div>
        ` : ''}
      </div>
    `;
  },

  /* ── Toggle accordion ── */
  toggle(id: string): void {
    this._openId = this._openId === id ? null : id;
    (window as any).App.render();
  },

  /* ── Category filter ── */
  setCategory(cat: string): void {
    this._activeCategory = cat;
    (window as any).App.render();
  },

  /* ── Modal: Create / Edit ── */
  async openModal(itemId: string | null = null): Promise<void> {
    let item: FaqItem | null = null;
    if (itemId) {
      item = this._items.find(i => i.id === itemId) || null;
    }

    const isEdit = !!item;
    const question = item?.question || '';
    const answer = item?.answer || '';
    const category = item?.category || '';

    const modal = document.getElementById('team-modal');
    if (!modal) return;

    const catOptions = CATEGORIES.map(c =>
      `<option value="${escapeHtml(c)}" ${category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');

    modal.innerHTML = `
      <div class="tl-modal" onclick="event.stopPropagation()">
        <div class="tl-modal-header">
          <h3>${isEdit ? 'Rediger FAQ' : 'Tilf\u00f8j FAQ'}</h3>
          <button class="btn-icon" onclick="FaqList.closeModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="tl-modal-body">
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select class="input" id="faq-category">
              <option value="">V\u00e6lg kategori...</option>
              ${catOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Sp\u00f8rgsm\u00e5l <span style="color: var(--error)">*</span></label>
            <input class="input" type="text" id="faq-question" value="${escapeHtml(question)}" placeholder="Skriv sp\u00f8rgsm\u00e5let...">
          </div>
          <div class="form-group">
            <label class="form-label">Svar <span style="color: var(--error)">*</span></label>
            <textarea class="input" id="faq-answer" rows="5" placeholder="Skriv svaret...">${escapeHtml(answer)}</textarea>
          </div>
        </div>
        <div class="tl-modal-footer">
          <button class="btn" onclick="FaqList.closeModal()">Annuller</button>
          <button class="btn btn-primary" id="faq-save-btn" onclick="FaqList.save('${itemId || ''}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            ${isEdit ? 'Gem \u00e6ndringer' : 'Tilf\u00f8j'}
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.onclick = (e: Event) => {
      if (e.target === modal) this.closeModal();
    };

    requestAnimationFrame(() => {
      const qInput = document.getElementById('faq-question') as HTMLInputElement | null;
      if (qInput) qInput.focus();
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

  async save(itemId: string): Promise<void> {
    const qEl = document.getElementById('faq-question') as HTMLInputElement | null;
    const aEl = document.getElementById('faq-answer') as HTMLTextAreaElement | null;
    const catEl = document.getElementById('faq-category') as HTMLSelectElement | null;
    const btn = document.getElementById('faq-save-btn') as HTMLButtonElement | null;

    if (!qEl || !aEl) return;

    const question = qEl.value.trim();
    const answer = aEl.value.trim();
    const category = catEl?.value || '';

    if (!question) { qEl.style.borderColor = 'var(--error)'; qEl.focus(); return; }
    if (!answer) { aEl.style.borderColor = 'var(--error)'; aEl.focus(); return; }

    if (btn) { btn.innerHTML = '<span class="vp-spinner"></span> Gemmer...'; btn.disabled = true; }

    try {
      if (itemId) {
        await FaqAPI.update(itemId, { question, answer, category });
        (window as any).App.toast('FAQ opdateret', 'success');
      } else {
        await FaqAPI.create({ question, answer, category });
        (window as any).App.toast('FAQ tilf\u00f8jet', 'success');
      }
      this.closeModal();
      (window as any).App.render();
    } catch (err: any) {
      if (btn) { btn.innerHTML = itemId ? 'Gem \u00e6ndringer' : 'Tilf\u00f8j'; btn.disabled = false; }
      (window as any).App.toast(err.message || 'Noget gik galt', 'error');
    }
  },

  async deleteItem(id: string): Promise<void> {
    if (!confirm('Er du sikker p\u00e5 du vil slette denne FAQ?')) return;
    try {
      await FaqAPI.delete(id);
      (window as any).App.toast('FAQ slettet', 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke slette FAQ', 'error');
    }
  },
};

// Expose globally for onclick handlers
(window as any).FaqList = FaqList;
