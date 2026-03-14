/* ═══════════════════════════════════════════
   Training List — Oplæringscheckliste
   ═══════════════════════════════════════════ */

import { TrainingAPI } from '../api';
import { escapeHtml } from '../utils';
import type { TrainingItem } from '../types';

export const TrainingList = {
  _items: [] as TrainingItem[],
  _editingId: null as string | null,

  /* ── Main render ── */
  async render(): Promise<string> {
    try {
      this._items = await TrainingAPI.getAll();
    } catch {
      this._items = [];
    }

    const count = this._items.length;

    let listHTML = '';
    if (count === 0) {
      listHTML = `
        <div class="tr-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <p>Ingen emner endnu. Tilf\u00f8j det f\u00f8rste emne.</p>
        </div>`;
    } else {
      const rows = this._items.map((item, index) => this._renderItem(item, index)).join('');
      listHTML = `<div class="tr-list">${rows}</div>`;
    }

    return `
      <div class="tr-header">
        <div class="tr-header-left">
          <span class="tr-stat"><strong>${count}</strong> emne${count !== 1 ? 'r' : ''} i opl\u00e6ringslisten</span>
        </div>
        <button class="btn btn-primary" onclick="TrainingList.openModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tilf\u00f8j emne
        </button>
      </div>

      ${listHTML}
    `;
  },

  /* ── Single item ── */
  _renderItem(item: TrainingItem, index: number): string {
    const isFirst = index === 0;
    const isLast = index === this._items.length - 1;

    return `
      <div class="tr-item" data-id="${item.id}">
        <div class="tr-item-number">${index + 1}</div>
        <div class="tr-item-content">
          <div class="tr-item-title">${escapeHtml(item.title)}</div>
          ${item.description ? `<div class="tr-item-desc">${escapeHtml(item.description)}</div>` : ''}
        </div>
        <div class="tr-item-actions">
          <button class="tr-action-btn" onclick="TrainingList.moveUp('${item.id}')" title="Flyt op" ${isFirst ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="tr-action-btn" onclick="TrainingList.moveDown('${item.id}')" title="Flyt ned" ${isLast ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="tr-action-btn" onclick="TrainingList.openModal('${item.id}')" title="Rediger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="tr-action-btn tr-action-danger" onclick="TrainingList.deleteItem('${item.id}')" title="Slet">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`;
  },

  /* ── Move up/down ── */
  async moveUp(id: string): Promise<void> {
    const idx = this._items.findIndex(i => i.id === id);
    if (idx <= 0) return;

    const ids = this._items.map(i => i.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];

    try {
      await TrainingAPI.reorder(ids);
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke \u00e6ndre r\u00e6kkef\u00f8lge', 'error');
    }
  },

  async moveDown(id: string): Promise<void> {
    const idx = this._items.findIndex(i => i.id === id);
    if (idx < 0 || idx >= this._items.length - 1) return;

    const ids = this._items.map(i => i.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];

    try {
      await TrainingAPI.reorder(ids);
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke \u00e6ndre r\u00e6kkef\u00f8lge', 'error');
    }
  },

  /* ── Modal: Create / Edit ── */
  async openModal(itemId: string | null = null): Promise<void> {
    this._editingId = itemId;
    let item: TrainingItem | null = null;

    if (itemId) {
      item = this._items.find(i => i.id === itemId) || null;
    }

    const isEdit = !!item;
    const title = item?.title || '';
    const description = item?.description || '';

    const modal = document.getElementById('team-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="tl-modal" onclick="event.stopPropagation()">
        <div class="tl-modal-header">
          <h3>${isEdit ? 'Rediger emne' : 'Tilf\u00f8j emne'}</h3>
          <button class="btn-icon" onclick="TrainingList.closeModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="tl-modal-body">
          <div class="form-group">
            <label class="form-label">Emne <span style="color: var(--error)">*</span></label>
            <input class="input" type="text" id="tr-title" value="${escapeHtml(title)}" placeholder="Emnetitel...">
          </div>
          <div class="form-group">
            <label class="form-label">Beskrivelse</label>
            <textarea class="input" id="tr-desc" rows="3" placeholder="Kort beskrivelse af emnet...">${escapeHtml(description)}</textarea>
          </div>
        </div>
        <div class="tl-modal-footer">
          <button class="btn" onclick="TrainingList.closeModal()">Annuller</button>
          <button class="btn btn-primary" id="tr-save-btn" onclick="TrainingList.save()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            ${isEdit ? 'Gem \u00e6ndringer' : 'Tilf\u00f8j emne'}
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.onclick = (e: Event) => {
      if (e.target === modal) this.closeModal();
    };

    requestAnimationFrame(() => {
      const titleInput = document.getElementById('tr-title') as HTMLInputElement | null;
      if (titleInput) titleInput.focus();
    });
  },

  closeModal(): void {
    const modal = document.getElementById('team-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.innerHTML = '';
      modal.onclick = null;
    }
    this._editingId = null;
  },

  async save(): Promise<void> {
    const titleEl = document.getElementById('tr-title') as HTMLInputElement | null;
    const descEl = document.getElementById('tr-desc') as HTMLTextAreaElement | null;
    const btn = document.getElementById('tr-save-btn') as HTMLButtonElement | null;

    if (!titleEl) return;

    const title = titleEl.value.trim();
    if (!title) {
      titleEl.style.borderColor = 'var(--error)';
      titleEl.focus();
      return;
    }

    const description = descEl?.value.trim() || '';

    if (btn) {
      btn.innerHTML = '<span class="vp-spinner"></span> Gemmer...';
      btn.disabled = true;
    }

    try {
      if (this._editingId) {
        await TrainingAPI.update(this._editingId, { title, description });
        (window as any).App.toast('Emne opdateret', 'success');
      } else {
        await TrainingAPI.create({ title, description });
        (window as any).App.toast('Emne tilf\u00f8jet', 'success');
      }
      this.closeModal();
      (window as any).App.render();
    } catch (err: any) {
      if (btn) {
        btn.innerHTML = this._editingId ? 'Gem \u00e6ndringer' : 'Tilf\u00f8j emne';
        btn.disabled = false;
      }
      (window as any).App.toast(err.message || 'Noget gik galt', 'error');
    }
  },

  async deleteItem(id: string): Promise<void> {
    if (!confirm('Er du sikker p\u00e5 du vil slette dette emne?')) return;
    try {
      await TrainingAPI.delete(id);
      (window as any).App.toast('Emne slettet', 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke slette emnet', 'error');
    }
  },
};

// Expose globally for onclick handlers
(window as any).TrainingList = TrainingList;
