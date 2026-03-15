/* ═══════════════════════════════════════════
   List View — Sortable task table
   ═══════════════════════════════════════════ */

import { TaskAPI, TeamAPI } from '../api';
import { escapeHtml } from '../utils';
import type { Task, TeamMember, ChecklistItem } from '../types';

export const ListView = {
  _sort: { column: 'deadline', dir: 'asc' } as { column: string; dir: string },
  _doneExpanded: false,
  _dragId: null as string | null,
  _selected: new Set<string>(),
  _undoQueue: [] as any[],
  _popupTaskId: null as string | null,
  _popupChecklist: [] as ChecklistItem[],

  async render(tasks: Task[]): Promise<string> {
    const members: TeamMember[] = await TeamAPI.getAll();
    const today = new Date().toISOString().split('T')[0];

    const activeTasks = this._sortTasks(tasks.filter(t => t.status !== 'done'));
    const doneTasks = this._sortTasks(tasks.filter(t => t.status === 'done'));

    const isEmpty = activeTasks.length === 0 && doneTasks.length === 0;
    const allActiveIds = activeTasks.map(t => t.id);
    const allChecked = allActiveIds.length > 0 && allActiveIds.every(id => this._selected.has(id));

    // ── Quick-add bar (above table) ──
    const quickAddHtml = `
      <div class="quick-add-bar">
        <div class="quick-add-bar-inner">
          <svg class="quick-add-bar-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <input class="quick-add-bar-input" type="text" placeholder="Ny opgave — skriv titel og tryk Enter..."
                 onkeydown="if(event.key==='Enter')ListView.quickAdd(this.value)"
                 id="quick-add-input" autocomplete="off">
          <button class="quick-add-bar-btn" onclick="ListView.quickAdd(document.getElementById('quick-add-input').value)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Opret opgave
          </button>
        </div>
      </div>
    `;

    // ── Bulk action bar ──
    const selCount = this._selected.size;
    const bulkBarHtml = selCount > 0 ? `
      <div class="bulk-bar">
        <span class="bulk-bar-count">${selCount} valgt</span>
        <select class="bulk-bar-select" onchange="ListView.bulkAction('status', this.value); this.selectedIndex=0">
          <option value="">Skift status...</option>
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <select class="bulk-bar-select" onchange="ListView.bulkAction('priority', this.value); this.selectedIndex=0">
          <option value="">Skift prioritet...</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <button class="bulk-bar-btn bulk-bar-delete" onclick="ListView.bulkDelete()">Slet valgte</button>
        <button class="bulk-bar-btn" onclick="ListView.clearSelection()">Annuller</button>
      </div>
    ` : '';

    const theadHtml = `
      <thead>
        <tr>
          <th class="col-check"><input type="checkbox" ${allChecked && allActiveIds.length > 0 ? 'checked' : ''} onchange="ListView.toggleAll(this.checked)"></th>
          <th class="col-drag"></th>
          <th class="col-title sortable ${this._sort.column === 'title' ? 'sort-active' : ''}" onclick="ListView.toggleSort('title')">
            Titel ${this._sortIcon('title')}
          </th>
          <th class="col-desc-header">Beskrivelse</th>
          <th class="col-status sortable ${this._sort.column === 'status' ? 'sort-active' : ''}" onclick="ListView.toggleSort('status')">
            Status ${this._sortIcon('status')}
          </th>
          <th class="col-priority sortable ${this._sort.column === 'priority' ? 'sort-active' : ''}" onclick="ListView.toggleSort('priority')">
            Prioritet ${this._sortIcon('priority')}
          </th>
          <th class="col-assignee sortable ${this._sort.column === 'assignee' ? 'sort-active' : ''}" onclick="ListView.toggleSort('assignee')">
            Ansvarlig ${this._sortIcon('assignee')}
          </th>
          <th class="col-type">Type</th>
          <th class="col-deadline sortable ${this._sort.column === 'deadline' ? 'sort-active' : ''}" onclick="ListView.toggleSort('deadline')">
            Deadline ${this._sortIcon('deadline')}
          </th>
          <th class="col-actions"></th>
        </tr>
      </thead>`;

    const doneSection = doneTasks.length > 0 ? `
      <div class="done-group">
        <button class="done-group-toggle" onclick="ListView.toggleDone()">
          <svg class="done-group-chevron ${this._doneExpanded ? 'expanded' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          Done <span class="done-group-count">${doneTasks.length}</span>
        </button>
        ${this._doneExpanded ? `
          <div class="list-table-wrap">
            <table class="list-table list-table-done">
              <tbody>
                ${doneTasks.map(t => this._renderRow(t, members, today, true)).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    ` : '';

    return `
      ${quickAddHtml}
      ${bulkBarHtml}
      <div class="list-table-wrap">
        <table class="list-table">
          ${theadHtml}
          <tbody id="task-tbody">
            ${activeTasks.length > 0
              ? activeTasks.map(t => this._renderRow(t, members, today, false)).join('')
              : isEmpty ? `<tr class="empty-row"><td colspan="10"><div class="empty-state-inline"><p>Ingen opgaver endnu — brug feltet ovenfor</p></div></td></tr>` : ''
            }
          </tbody>
        </table>
      </div>
      ${doneSection}
    `;
  },

  // ── Selection / Bulk ──

  toggleSelect(taskId: string, checked: boolean): void {
    if (checked) this._selected.add(taskId);
    else this._selected.delete(taskId);
    (window as any).App.render();
  },

  toggleAll(checked: boolean): void {
    const tbody = document.getElementById('task-tbody');
    if (!tbody) return;
    const ids = Array.from(tbody.querySelectorAll('tr.task-row[data-id]')).map(r => (r as HTMLElement).dataset.id!);
    if (checked) ids.forEach(id => this._selected.add(id));
    else this._selected.clear();
    (window as any).App.render();
  },

  clearSelection(): void {
    this._selected.clear();
    (window as any).App.render();
  },

  async bulkAction(field: string, value: string): Promise<void> {
    if (!value) return;
    const ids = Array.from(this._selected);
    if (ids.length === 0) return;
    await TaskAPI.bulkUpdate(ids, { [field]: value } as Partial<Task>);
    this._selected.clear();
    (window as any).App.render();
  },

  async bulkDelete(): Promise<void> {
    const ids = Array.from(this._selected);
    if (ids.length === 0) return;
    await TaskAPI.bulkDelete(ids);
    this._selected.clear();
    this._showUndoToast(`${ids.length} opgave${ids.length > 1 ? 'r' : ''} slettet`);
    (window as any).App.render();
  },

  // ── Core Actions ──

  toggleDone(): void {
    this._doneExpanded = !this._doneExpanded;
    (window as any).App.render();
  },

  async quickAdd(title: string): Promise<void> {
    title = title.trim();
    if (!title) return;
    await TaskAPI.create({ title, tab: (window as any).App.state.tab });
    await (window as any).App.render();
    const input = document.getElementById('quick-add-input') as HTMLInputElement | null;
    if (input) input.focus();
  },

  editTitle(span: HTMLElement, taskId: string): void {
    if (span.querySelector('input')) return;
    const current = span.textContent!.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-title-input';
    input.value = current;
    span.textContent = '';
    span.appendChild(input);
    input.focus();
    input.select();

    const save = async () => {
      const val = input.value.trim();
      if (val && val !== current) {
        await TaskAPI.update(taskId, { title: val });
      }
      (window as any).App.render();
    };

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { (window as any).App.render(); }
    });
    input.addEventListener('blur', save);
  },

  async inlineUpdate(taskId: string, field: string, value: string): Promise<void> {
    await TaskAPI.update(taskId, { [field]: value || null } as Partial<Task>);
    (window as any).App.render();
  },

  // ── Undo Toast (replaces confirm dialog) ──

  async deleteTask(taskId: string): Promise<void> {
    // Get task data for undo
    const task = await TaskAPI.get(taskId);
    await TaskAPI.delete(taskId);
    this._showUndoToast('Opgave slettet', async () => {
      // Recreate task on undo
      if (task) {
        await TaskAPI.create({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          type: task.type,
          assignee_id: task.assignee_id,
          deadline: task.deadline,
          tab: task.tab,
          checklist: task.checklist || []
        });
        (window as any).App.render();
      }
    });
    (window as any).App.render();
  },

  _showUndoToast(message: string, undoFn?: () => void): void {
    const container = document.getElementById('toast-container');
    if (!container) return;
    // Remove existing undo toasts
    container.querySelectorAll('.toast-undo').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'toast toast-undo';
    toast.innerHTML = `
      <span>${message}</span>
      ${undoFn ? '<button class="toast-undo-btn">Fortryd</button>' : ''}
    `;

    if (undoFn) {
      toast.querySelector('.toast-undo-btn')!.addEventListener('click', () => {
        toast.remove();
        undoFn();
      });
    }

    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
  },

  // ── Duplicate ──

  async duplicateTask(taskId: string): Promise<void> {
    await TaskAPI.duplicate(taskId);
    this._showUndoToast('Opgave duplikeret');
    (window as any).App.render();
  },

  // ── Drag & Drop ──

  dragStart(e: DragEvent, taskId: string): void {
    this._dragId = taskId;
    e.dataTransfer!.effectAllowed = 'move';
    (e.target as HTMLElement).closest('tr')!.classList.add('dragging');
  },

  dragOver(e: DragEvent): void {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    const row = (e.target as HTMLElement).closest('tr.task-row');
    if (!row) return;
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    row.classList.add('drag-over');
  },

  dragEnd(e: DragEvent): void {
    this._dragId = null;
    document.querySelectorAll('.dragging, .drag-over').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });
  },

  async drop(e: DragEvent): Promise<void> {
    e.preventDefault();
    const dropTarget = (e.target as HTMLElement).closest('tr.task-row') as HTMLElement | null;

    document.querySelectorAll('.dragging, .drag-over').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });

    const tbody = document.getElementById('task-tbody');
    if (!tbody || !this._dragId || !dropTarget) { this._dragId = null; return; }

    // Move the dragged row in the DOM before the drop target
    const draggedRow = tbody.querySelector(`tr[data-id="${this._dragId}"]`);
    if (draggedRow && draggedRow !== dropTarget) {
      const dragRect = draggedRow.getBoundingClientRect();
      const dropRect = dropTarget.getBoundingClientRect();
      if (dragRect.top < dropRect.top) {
        // Dragged from above: insert after drop target
        dropTarget.after(draggedRow);
      } else {
        // Dragged from below: insert before drop target
        dropTarget.before(draggedRow);
      }
    }

    // Now read the new DOM order and persist
    const ids = Array.from(tbody.querySelectorAll('tr.task-row[data-id]'))
      .map(row => (row as HTMLElement).dataset.id!);
    if (ids.length > 0) {
      await TaskAPI.reorder(ids);
      (window as any).App.render();
    }
    this._dragId = null;
  },

  // ── Description Popup (with checklist) ──

  openDescPopup(cell: HTMLElement, taskId: string): void {
    const existing = document.getElementById('desc-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'desc-popup';
    popup.className = 'desc-popup';
    popup.onclick = (e) => e.stopPropagation();

    popup.innerHTML = `
      <div class="desc-popup-links" id="desc-popup-links"></div>
      <textarea class="desc-popup-textarea" placeholder="Skriv beskrivelse..." id="desc-popup-ta"></textarea>
      <div class="desc-popup-footer">
        <button class="btn btn-sm btn-primary desc-popup-save" onclick="ListView.saveDesc()">Tilføj beskrivelse</button>
      </div>
    `;

    const rect = cell.getBoundingClientRect();
    popup.style.position = 'fixed';
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + 360 > window.innerWidth) left = window.innerWidth - 370;
    if (top + 380 > window.innerHeight) top = rect.top - 384;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    document.body.appendChild(popup);

    // Store current task id for checklist operations
    this._popupTaskId = taskId;
    this._popupChecklist = [];

    // Load data
    TaskAPI.get(taskId).then(task => {
      if (!task) return;
      const ta = document.getElementById('desc-popup-ta') as HTMLTextAreaElement | null;
      if (ta) ta.value = task.description || '';
      this._popupChecklist = Array.isArray(task.checklist) ? [...task.checklist] : [];
      this._renderChecklist();

      // Render clickable links from description
      const linksEl = document.getElementById('desc-popup-links');
      if (linksEl && task.description) {
        const urls = task.description.match(/https?:\/\/[^\s]+/g);
        if (urls && urls.length > 0) {
          linksEl.innerHTML = urls.map(url => {
            const isMeet = url.includes('meet.google.com') || url.includes('meet.jit.si');
            const icon = isMeet
              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>'
              : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
            const label = isMeet ? 'Åbn video-link' : url.replace(/^https?:\/\//, '').substring(0, 35);
            return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="desc-link-btn ${isMeet ? 'desc-link-meet' : ''}" onclick="event.stopPropagation()">${icon} ${escapeHtml(label)}</a>`;
          }).join('');
        }
      }
    });

    const ta = document.getElementById('desc-popup-ta') as HTMLTextAreaElement | null;
    if (ta) ta.focus();

    // Close + save on outside click
    const closePopup = async (e: MouseEvent) => {
      if (popup.contains(e.target as Node)) return;
      document.removeEventListener('mousedown', closePopup);
      await this._savePopup();
      popup.remove();
      (window as any).App.render();
    };
    setTimeout(() => document.addEventListener('mousedown', closePopup), 0);

    if (ta) {
      ta.addEventListener('keydown', async (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          document.removeEventListener('mousedown', closePopup);
          await this._savePopup();
          popup.remove();
          (window as any).App.render();
        }
      });
    }
  },

  async _savePopup(): Promise<void> {
    const ta = document.getElementById('desc-popup-ta') as HTMLTextAreaElement | null;
    if (!ta || !this._popupTaskId) return;
    await TaskAPI.update(this._popupTaskId, {
      description: ta.value,
      checklist: this._popupChecklist
    });
  },

  async saveDesc(): Promise<void> {
    await this._savePopup();
    const popup = document.getElementById('desc-popup');
    if (popup) popup.remove();
    (window as any).App.render();
  },

  _renderChecklist(): void {
    const container = document.getElementById('desc-popup-checklist');
    if (!container) return;
    container.innerHTML = this._popupChecklist.map((item: ChecklistItem, i: number) => `
      <label class="check-item ${item.done ? 'check-done' : ''}">
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="ListView._toggleCheckItem(${i}, this.checked)">
        <span>${escapeHtml(item.text)}</span>
        <button class="check-item-delete" onclick="ListView._removeCheckItem(${i})">✕</button>
      </label>
    `).join('');
  },

  _addCheckItem(text: string): void {
    text = text.trim();
    if (!text) return;
    this._popupChecklist.push({ text, done: false });
    this._renderChecklist();
  },

  _toggleCheckItem(index: number, done: boolean): void {
    if (this._popupChecklist[index]) {
      this._popupChecklist[index].done = done;
      this._renderChecklist();
    }
  },

  _removeCheckItem(index: number): void {
    this._popupChecklist.splice(index, 1);
    this._renderChecklist();
  },

  // ── Render Row ──

  _renderRow(task: Task, members: TeamMember[], today: string, isDone: boolean = false): string {
    const member = members.find(m => m.id === task.assignee_id);
    const isOverdue = task.deadline && task.deadline < today && task.status !== 'done';
    const statusLabels: Record<string, string> = { todo: 'To Do', 'in-progress': 'In Progress', blocked: 'Blocked', review: 'Review', done: 'Done' };
    const priorityLabels: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
    const typeLabels: Record<string, string> = { onboarding: 'Onboarding', support: 'Support', bug: 'Bug', 'feature-request': 'Feature', 'cs-followup': 'CS Follow-up', internal: 'Internal' };

    const hasDesc = task.description && task.description.trim().length > 0;
    const descPreview = hasDesc ? task.description.trim().substring(0, 30).replace(/\n/g, ' ') : '';
    const checklist = Array.isArray(task.checklist) ? task.checklist : [];
    const checkDone = checklist.filter(c => c.done).length;
    const checkTotal = checklist.length;
    const checkProgress = checkTotal > 0 ? `<span class="check-progress">${checkDone}/${checkTotal}</span>` : '';
    const isSelected = this._selected.has(task.id);

    // Detect meet link in description for quick-access icon
    const meetMatch = hasDesc ? task.description.match(/https?:\/\/(?:meet\.google\.com|meet\.jit\.si)\/[^\s]+/) : null;
    const meetLink = meetMatch ? meetMatch[0] : '';

    return `
      <tr class="task-row ${isDone ? 'task-row-done' : ''} ${isSelected ? 'task-row-selected' : ''}" data-id="${task.id}"
          draggable="${!isDone}" ondragstart="ListView.dragStart(event, '${task.id}')"
          ondragover="ListView.dragOver(event)" ondrop="ListView.drop(event)"
          ondragend="ListView.dragEnd(event)">
        <td class="col-check" onclick="event.stopPropagation()">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="ListView.toggleSelect('${task.id}', this.checked)">
        </td>
        <td class="col-drag" onclick="event.stopPropagation()">
          ${!isDone ? '<span class="drag-handle" title="Træk for at sortere">⠿</span>' : ''}
        </td>
        <td class="col-title" onclick="event.stopPropagation()">
          <div class="task-title-cell">
            <span class="priority-dot priority-dot-${task.priority}"></span>
            <span class="inline-title truncate" onclick="ListView.editTitle(this, '${task.id}')">${escapeHtml(task.title)}</span>
          </div>
        </td>
        <td class="col-desc" onclick="event.stopPropagation()">
          <div class="desc-cell ${hasDesc || checkTotal > 0 ? 'has-note' : ''}" onclick="ListView.openDescPopup(this, '${task.id}')">
            ${meetLink ? `<a href="${escapeHtml(meetLink)}" target="_blank" rel="noopener" class="desc-meet-icon" title="Åbn video-link" onclick="event.stopPropagation()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></a>` : ''}
            ${hasDesc
              ? `<span class="desc-preview-text">${escapeHtml(descPreview)}${task.description.trim().length > 30 ? '...' : ''}</span>`
              : checkTotal > 0 ? '' : `<span class="desc-add-hint"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Beskrivelse</span>`
            }
            ${checkProgress}
          </div>
        </td>
        <td class="col-status" onclick="event.stopPropagation()">
          <select class="inline-select badge badge-${task.status}" onchange="ListView.inlineUpdate('${task.id}', 'status', this.value)">
            ${Object.entries(statusLabels).map(([val, label]) =>
              `<option value="${val}" ${task.status === val ? 'selected' : ''}>${label}</option>`
            ).join('')}
          </select>
        </td>
        <td class="col-priority" onclick="event.stopPropagation()">
          <select class="inline-select badge badge-${task.priority}" onchange="ListView.inlineUpdate('${task.id}', 'priority', this.value)">
            ${Object.entries(priorityLabels).map(([val, label]) =>
              `<option value="${val}" ${task.priority === val ? 'selected' : ''}>${label}</option>`
            ).join('')}
          </select>
        </td>
        <td class="col-assignee" onclick="event.stopPropagation()">
          <select class="inline-select" onchange="ListView.inlineUpdate('${task.id}', 'assignee_id', this.value)">
            <option value="">-</option>
            ${members.map(m =>
              `<option value="${m.id}" ${task.assignee_id === m.id ? 'selected' : ''}>${m.name}</option>`
            ).join('')}
          </select>
        </td>
        <td class="col-type" onclick="event.stopPropagation()">
          <select class="inline-select inline-select-plain" onchange="ListView.inlineUpdate('${task.id}', 'type', this.value)">
            ${Object.entries(typeLabels).map(([val, label]) =>
              `<option value="${val}" ${task.type === val ? 'selected' : ''}>${label}</option>`
            ).join('')}
          </select>
        </td>
        <td class="col-deadline" onclick="event.stopPropagation()">
          <div class="deadline-cell">
            <span class="deadline-label ${isOverdue ? 'text-overdue' : ''} ${!task.deadline ? 'text-tertiary' : ''}" onclick="this.nextElementSibling.showPicker()">${task.deadline ? this._relativeDate(task.deadline, today) : 'Ingen'}</span>
            <input type="date" class="deadline-input" value="${task.deadline || ''}"
                   onchange="ListView.inlineUpdate('${task.id}', 'deadline', this.value)">
          </div>
        </td>
        <td class="col-actions" onclick="event.stopPropagation()">
          <div class="actions-cell">
            <button class="btn-action btn-duplicate" onclick="ListView.duplicateTask('${task.id}')" title="Dupliker">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="btn-action btn-delete" onclick="ListView.deleteTask('${task.id}')" title="Slet">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  toggleSort(column: string): void {
    if (this._sort.column === column) {
      this._sort.dir = this._sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      this._sort.column = column;
      this._sort.dir = 'asc';
    }
    (window as any).App.render();
  },

  _sortTasks(tasks: Task[]): Task[] {
    const { column, dir } = this._sort;
    const mul = dir === 'asc' ? 1 : -1;

    const statusOrder = ['todo', 'in-progress', 'blocked', 'review', 'done'];
    const priorityOrder = ['critical', 'high', 'medium', 'low'];

    return tasks.sort((a, b) => {
      let cmp = 0;
      switch (column) {
        case 'title':
          cmp = (a.title || '').localeCompare(b.title || '');
          break;
        case 'status':
          cmp = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
          break;
        case 'priority':
          cmp = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
          break;
        case 'assignee': {
          const nameA = a.assignee_id || 'zzz';
          const nameB = b.assignee_id || 'zzz';
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case 'deadline': {
          const da = a.deadline || '9999-12-31';
          const db = b.deadline || '9999-12-31';
          cmp = da.localeCompare(db);
          break;
        }
        default:
          cmp = 0;
      }
      return cmp * mul;
    });
  },

  _sortIcon(column: string): string {
    if (this._sort.column !== column) return '<span class="sort-arrow"></span>';
    return this._sort.dir === 'asc'
      ? '<span class="sort-arrow active">\u2191</span>'
      : '<span class="sort-arrow active">\u2193</span>';
  },

  _relativeDate(dateStr: string, today: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const t = new Date(today + 'T00:00:00');
    const diffDays = Math.round((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'I dag';
    if (diffDays === 1) return 'I morgen';
    if (diffDays === -1) return 'I g\u00e5r';
    if (diffDays > 1 && diffDays <= 6) return `Om ${diffDays} dage`;
    if (diffDays < -1 && diffDays >= -6) return `${Math.abs(diffDays)} dage siden`;

    return this._formatDate(dateStr);
  },

  _formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    if (sameYear) {
      return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
    }
    const base = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
    return base + " '" + String(d.getFullYear()).slice(-2).padStart(2, '0');
  }
};

(window as any).ListView = ListView;
