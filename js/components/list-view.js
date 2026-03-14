/* ═══════════════════════════════════════════
   List View — Sortable task table
   ═══════════════════════════════════════════ */

const ListView = {
  _sort: { column: 'deadline', dir: 'asc' },
  _doneExpanded: false,
  _dragId: null,
  _selected: new Set(),
  _undoQueue: [],        // for undo-toast

  async render(tasks) {
    const members = await TeamAPI.getAll();
    const today = new Date().toISOString().split('T')[0];

    const activeTasks = this._sortTasks(tasks.filter(t => t.status !== 'done'));
    const doneTasks = this._sortTasks(tasks.filter(t => t.status === 'done'));

    const isEmpty = activeTasks.length === 0 && doneTasks.length === 0;
    const allActiveIds = activeTasks.map(t => t.id);
    const allChecked = allActiveIds.length > 0 && allActiveIds.every(id => this._selected.has(id));

    // ── Quick filter chips ──
    const quickFiltersHtml = `
      <div class="quick-filters">
        <button class="quick-filter-chip ${App.state.filters.assignee_id === 'morten' ? 'active' : ''}" onclick="ListView.quickFilter('mine')">Mine opgaver</button>
        <button class="quick-filter-chip ${App.state._quickFilter === 'overdue' ? 'active' : ''}" onclick="ListView.quickFilter('overdue')">Forfaldne</button>
        <button class="quick-filter-chip ${App.state._quickFilter === 'week' ? 'active' : ''}" onclick="ListView.quickFilter('week')">Denne uge</button>
        ${App.state._quickFilter ? '<button class="quick-filter-chip quick-filter-clear" onclick="ListView.quickFilter(\'clear\')">✕ Ryd</button>' : ''}
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
      ${quickFiltersHtml}
      ${bulkBarHtml}
      <div class="list-table-wrap">
        <table class="list-table">
          ${theadHtml}
          <tbody id="task-tbody">
            <tr class="quick-add-row">
              <td colspan="10">
                <div class="quick-add-cell">
                  <svg class="quick-add-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <input class="quick-add-input" type="text" placeholder="Skriv titel og tryk Enter..."
                         onkeydown="if(event.key==='Enter')ListView.quickAdd(this.value)"
                         id="quick-add-input">
                </div>
              </td>
            </tr>
            ${activeTasks.length > 0
              ? activeTasks.map(t => this._renderRow(t, members, today, false)).join('')
              : isEmpty ? `<tr class="empty-row"><td colspan="10"><div class="empty-state-inline"><p>Ingen opgaver endnu — skriv en titel ovenfor</p></div></td></tr>` : ''
            }
          </tbody>
        </table>
      </div>
      ${doneSection}
    `;
  },

  // ── Quick Filters ──

  quickFilter(type) {
    if (type === 'clear') {
      App.state.filters.assignee_id = '';
      App.state._quickFilter = null;
      App.render();
      return;
    }
    if (type === 'mine') {
      // Toggle
      if (App.state.filters.assignee_id === 'morten') {
        App.state.filters.assignee_id = '';
        App.state._quickFilter = null;
      } else {
        App.state.filters.assignee_id = 'morten';
        App.state._quickFilter = 'mine';
      }
      App.render();
      return;
    }
    if (type === 'overdue') {
      if (App.state._quickFilter === 'overdue') {
        App.state._quickFilter = null;
      } else {
        App.state._quickFilter = 'overdue';
      }
      App.render();
      return;
    }
    if (type === 'week') {
      if (App.state._quickFilter === 'week') {
        App.state._quickFilter = null;
      } else {
        App.state._quickFilter = 'week';
      }
      App.render();
      return;
    }
  },

  // ── Selection / Bulk ──

  toggleSelect(taskId, checked) {
    if (checked) this._selected.add(taskId);
    else this._selected.delete(taskId);
    App.render();
  },

  toggleAll(checked) {
    const tbody = document.getElementById('task-tbody');
    if (!tbody) return;
    const ids = Array.from(tbody.querySelectorAll('tr.task-row[data-id]')).map(r => r.dataset.id);
    if (checked) ids.forEach(id => this._selected.add(id));
    else this._selected.clear();
    App.render();
  },

  clearSelection() {
    this._selected.clear();
    App.render();
  },

  async bulkAction(field, value) {
    if (!value) return;
    const ids = Array.from(this._selected);
    if (ids.length === 0) return;
    await TaskAPI.bulkUpdate(ids, { [field]: value });
    this._selected.clear();
    App.render();
  },

  async bulkDelete() {
    const ids = Array.from(this._selected);
    if (ids.length === 0) return;
    await TaskAPI.bulkDelete(ids);
    this._selected.clear();
    this._showUndoToast(`${ids.length} opgave${ids.length > 1 ? 'r' : ''} slettet`);
    App.render();
  },

  // ── Core Actions ──

  toggleDone() {
    this._doneExpanded = !this._doneExpanded;
    App.render();
  },

  async quickAdd(title) {
    title = title.trim();
    if (!title) return;
    await TaskAPI.create({ title, tab: App.state.tab });
    await App.render();
    const input = document.getElementById('quick-add-input');
    if (input) input.focus();
  },

  editTitle(span, taskId) {
    if (span.querySelector('input')) return;
    const current = span.textContent.trim();
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
      App.render();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { App.render(); }
    });
    input.addEventListener('blur', save);
  },

  async inlineUpdate(taskId, field, value) {
    await TaskAPI.update(taskId, { [field]: value || null });
    App.render();
  },

  // ── Undo Toast (replaces confirm dialog) ──

  async deleteTask(taskId) {
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
        App.render();
      }
    });
    App.render();
  },

  _showUndoToast(message, undoFn) {
    const container = document.getElementById('toast-container');
    // Remove existing undo toasts
    container.querySelectorAll('.toast-undo').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'toast toast-undo';
    toast.innerHTML = `
      <span>${message}</span>
      ${undoFn ? '<button class="toast-undo-btn">Fortryd</button>' : ''}
    `;

    if (undoFn) {
      toast.querySelector('.toast-undo-btn').addEventListener('click', () => {
        toast.remove();
        undoFn();
      });
    }

    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
  },

  // ── Duplicate ──

  async duplicateTask(taskId) {
    await TaskAPI.duplicate(taskId);
    this._showUndoToast('Opgave duplikeret');
    App.render();
  },

  // ── Drag & Drop ──

  dragStart(e, taskId) {
    this._dragId = taskId;
    e.dataTransfer.effectAllowed = 'move';
    e.target.closest('tr').classList.add('dragging');
  },

  dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const row = e.target.closest('tr.task-row');
    if (!row) return;
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    row.classList.add('drag-over');
  },

  dragEnd(e) {
    this._dragId = null;
    document.querySelectorAll('.dragging, .drag-over').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });
  },

  async drop(e) {
    e.preventDefault();
    document.querySelectorAll('.dragging, .drag-over').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });
    const tbody = document.getElementById('task-tbody');
    if (!tbody) return;
    const ids = Array.from(tbody.querySelectorAll('tr.task-row[data-id]'))
      .map(row => row.dataset.id);
    if (ids.length > 0) {
      await TaskAPI.reorder(ids);
      App.render();
    }
    this._dragId = null;
  },

  // ── Description Popup (with checklist) ──

  openDescPopup(cell, taskId) {
    const existing = document.getElementById('desc-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'desc-popup';
    popup.className = 'desc-popup';
    popup.onclick = (e) => e.stopPropagation();

    // Two sections: textarea + checklist
    popup.innerHTML = `
      <textarea class="desc-popup-textarea" placeholder="Skriv beskrivelse..." id="desc-popup-ta"></textarea>
      <div class="desc-popup-divider"></div>
      <div class="desc-popup-checklist" id="desc-popup-checklist"></div>
      <div class="desc-popup-add-item">
        <input type="text" class="desc-popup-add-input" placeholder="+ Tilføj punkt..." id="desc-popup-add"
               onkeydown="if(event.key==='Enter'){ListView._addCheckItem(this.value);this.value=''}">
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
      const ta = document.getElementById('desc-popup-ta');
      if (ta) ta.value = task.description || '';
      this._popupChecklist = Array.isArray(task.checklist) ? [...task.checklist] : [];
      this._renderChecklist();
    });

    const ta = document.getElementById('desc-popup-ta');
    if (ta) ta.focus();

    // Close + save on outside click
    const closePopup = async (e) => {
      if (popup.contains(e.target)) return;
      document.removeEventListener('mousedown', closePopup);
      await this._savePopup();
      popup.remove();
      App.render();
    };
    setTimeout(() => document.addEventListener('mousedown', closePopup), 0);

    ta.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('mousedown', closePopup);
        await this._savePopup();
        popup.remove();
        App.render();
      }
    });
  },

  async _savePopup() {
    const ta = document.getElementById('desc-popup-ta');
    if (!ta || !this._popupTaskId) return;
    await TaskAPI.update(this._popupTaskId, {
      description: ta.value,
      checklist: this._popupChecklist
    });
  },

  _renderChecklist() {
    const container = document.getElementById('desc-popup-checklist');
    if (!container) return;
    container.innerHTML = this._popupChecklist.map((item, i) => `
      <label class="check-item ${item.done ? 'check-done' : ''}">
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="ListView._toggleCheckItem(${i}, this.checked)">
        <span>${this._esc(item.text)}</span>
        <button class="check-item-delete" onclick="ListView._removeCheckItem(${i})">✕</button>
      </label>
    `).join('');
  },

  _addCheckItem(text) {
    text = text.trim();
    if (!text) return;
    this._popupChecklist.push({ text, done: false });
    this._renderChecklist();
  },

  _toggleCheckItem(index, done) {
    if (this._popupChecklist[index]) {
      this._popupChecklist[index].done = done;
      this._renderChecklist();
    }
  },

  _removeCheckItem(index) {
    this._popupChecklist.splice(index, 1);
    this._renderChecklist();
  },

  // ── Render Row ──

  _renderRow(task, members, today, isDone = false) {
    const member = members.find(m => m.id === task.assignee_id);
    const isOverdue = task.deadline && task.deadline < today && task.status !== 'done';
    const statusLabels = { todo: 'To Do', 'in-progress': 'In Progress', review: 'Review', done: 'Done' };
    const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
    const typeLabels = { onboarding: 'Onboarding', support: 'Support', bug: 'Bug', 'feature-request': 'Feature', 'cs-followup': 'CS Follow-up', internal: 'Internal' };

    const hasDesc = task.description && task.description.trim().length > 0;
    const descPreview = hasDesc ? task.description.trim().substring(0, 30).replace(/\n/g, ' ') : '';
    const checklist = Array.isArray(task.checklist) ? task.checklist : [];
    const checkDone = checklist.filter(c => c.done).length;
    const checkTotal = checklist.length;
    const checkProgress = checkTotal > 0 ? `<span class="check-progress">${checkDone}/${checkTotal}</span>` : '';
    const isSelected = this._selected.has(task.id);

    // Apply quick filters client-side
    if (App.state._quickFilter === 'overdue' && !(task.deadline && task.deadline < today && task.status !== 'done')) return '';
    if (App.state._quickFilter === 'week') {
      const weekEnd = new Date(today + 'T00:00:00');
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      if (!(task.deadline && task.deadline >= today && task.deadline <= weekEndStr)) return '';
    }

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
            <span class="inline-title truncate" onclick="ListView.editTitle(this, '${task.id}')">${this._esc(task.title)}</span>
          </div>
        </td>
        <td class="col-desc" onclick="event.stopPropagation()">
          <div class="desc-cell ${hasDesc || checkTotal > 0 ? 'has-note' : ''}" onclick="ListView.openDescPopup(this, '${task.id}')">
            ${hasDesc
              ? `<span class="desc-preview-text">${this._esc(descPreview)}${task.description.trim().length > 30 ? '...' : ''}</span>`
              : checkTotal > 0 ? '' : `<span class="desc-add-hint">Tilføj beskrivelse</span>`
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

  toggleSort(column) {
    if (this._sort.column === column) {
      this._sort.dir = this._sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      this._sort.column = column;
      this._sort.dir = 'asc';
    }
    App.render();
  },

  _sortTasks(tasks) {
    const { column, dir } = this._sort;
    const mul = dir === 'asc' ? 1 : -1;

    const statusOrder = ['todo', 'in-progress', 'review', 'done'];
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

  _sortIcon(column) {
    if (this._sort.column !== column) return '<span class="sort-arrow"></span>';
    return this._sort.dir === 'asc'
      ? '<span class="sort-arrow active">\u2191</span>'
      : '<span class="sort-arrow active">\u2193</span>';
  },

  _relativeDate(dateStr, today) {
    const d = new Date(dateStr + 'T00:00:00');
    const t = new Date(today + 'T00:00:00');
    const diffDays = Math.round((d - t) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'I dag';
    if (diffDays === 1) return 'I morgen';
    if (diffDays === -1) return 'I går';
    if (diffDays > 1 && diffDays <= 6) return `Om ${diffDays} dage`;
    if (diffDays < -1 && diffDays >= -6) return `${Math.abs(diffDays)} dage siden`;

    return this._formatDate(dateStr);
  },

  _formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    if (sameYear) {
      return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
    }
    const base = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
    return base + " '" + String(d.getFullYear()).slice(-2).padStart(2, '0');
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};
