/* ═══════════════════════════════════════════
   Training List — Oplæringscheckliste
   Drag-and-drop sortable checklist
   ═══════════════════════════════════════════ */

import { TrainingAPI } from '../api';
import { escapeHtml } from '../utils';
import type { TrainingItem } from '../types';

export const TrainingList = {
  _items: [] as TrainingItem[],
  _editingId: null as string | null,
  _dragId: null as string | null,

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
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <p>Ingen emner endnu. Tilf\u00f8j det f\u00f8rste emne.</p>
        </div>`;
    } else {
      const rows = this._items.map((item, index) => this._renderItem(item, index)).join('');
      listHTML = `<div class="tr-list" id="tr-list">${rows}</div>`;
    }

    return `
      <div class="tr-container">
        <div class="tr-header">
          <span class="tr-stat"><strong>${count}</strong> emne${count !== 1 ? 'r' : ''}</span>
          <button class="btn btn-primary btn-sm" onclick="TrainingList.openModal()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tilf\u00f8j
          </button>
        </div>
        ${listHTML}
      </div>
    `;
  },

  /* ── Single item ── */
  _renderItem(item: TrainingItem, index: number): string {
    return `
      <div class="tr-item" data-id="${item.id}" draggable="true"
           ondragstart="TrainingList.onDragStart(event, '${item.id}')"
           ondragover="TrainingList.onDragOver(event)"
           ondrop="TrainingList.onDrop(event, '${item.id}')"
           ondragend="TrainingList.onDragEnd(event)">
        <div class="tr-grip" title="Tr\u00e6k for at sortere">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
        </div>
        <div class="tr-num">${index + 1}</div>
        <div class="tr-body">
          <span class="tr-title">${escapeHtml(item.title)}</span>
          ${item.description ? `<span class="tr-desc">${escapeHtml(item.description)}</span>` : ''}
        </div>
        <div class="tr-actions">
          <button class="tr-btn" onclick="event.stopPropagation(); TrainingList.openModal('${item.id}')" title="Rediger">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="tr-btn tr-btn-danger" onclick="event.stopPropagation(); TrainingList.deleteItem('${item.id}')" title="Slet">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`;
  },

  /* ── Drag and drop ── */
  onDragStart(e: DragEvent, id: string): void {
    this._dragId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
    const el = (e.target as HTMLElement).closest('.tr-item') as HTMLElement;
    if (el) {
      requestAnimationFrame(() => el.classList.add('tr-dragging'));
    }
  },

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    const target = (e.target as HTMLElement).closest('.tr-item') as HTMLElement;
    if (!target) return;

    // Remove all drag-over classes
    document.querySelectorAll('.tr-drag-above, .tr-drag-below').forEach(el => {
      el.classList.remove('tr-drag-above', 'tr-drag-below');
    });

    // Determine if above or below midpoint
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      target.classList.add('tr-drag-above');
    } else {
      target.classList.add('tr-drag-below');
    }
  },

  onDrop(e: DragEvent, targetId: string): void {
    e.preventDefault();
    document.querySelectorAll('.tr-drag-above, .tr-drag-below').forEach(el => {
      el.classList.remove('tr-drag-above', 'tr-drag-below');
    });

    if (!this._dragId || this._dragId === targetId) return;

    const ids = this._items.map(i => i.id);
    const fromIdx = ids.indexOf(this._dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    // Determine drop position based on mouse
    const target = (e.target as HTMLElement).closest('.tr-item') as HTMLElement;
    let insertIdx = toIdx;
    if (target) {
      const rect = target.getBoundingClientRect();
      if (e.clientY >= rect.top + rect.height / 2) {
        insertIdx = toIdx + (fromIdx < toIdx ? 0 : 1);
      } else {
        insertIdx = toIdx - (fromIdx < toIdx ? 1 : 0);
      }
    }

    // Remove from old position, insert at new
    ids.splice(fromIdx, 1);
    ids.splice(insertIdx, 0, this._dragId);

    this._dragId = null;

    TrainingAPI.reorder(ids).then(() => {
      (window as any).App.render();
    }).catch(() => {
      (window as any).App.toast('Kunne ikke \u00e6ndre r\u00e6kkef\u00f8lge', 'error');
    });
  },

  onDragEnd(e: DragEvent): void {
    this._dragId = null;
    document.querySelectorAll('.tr-dragging, .tr-drag-above, .tr-drag-below').forEach(el => {
      el.classList.remove('tr-dragging', 'tr-drag-above', 'tr-drag-below');
    });
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
