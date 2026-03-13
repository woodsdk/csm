/* ═══════════════════════════════════════════
   List View — Sortable task table
   ═══════════════════════════════════════════ */

const ListView = {
  _sort: { column: 'deadline', dir: 'asc' },
  _doneExpanded: false,
  _dragId: null,
  _expandedDesc: null, // task id with description open

  async render(tasks) {
    const members = await TeamAPI.getAll();
    const today = new Date().toISOString().split('T')[0];

    const activeTasks = this._sortTasks(tasks.filter(t => t.status !== 'done'));
    const doneTasks = this._sortTasks(tasks.filter(t => t.status === 'done'));

    const isEmpty = activeTasks.length === 0 && doneTasks.length === 0;

    const theadHtml = `
      <thead>
        <tr>
          <th class="col-drag"></th>
          <th class="col-title sortable ${this._sort.column === 'title' ? 'sort-active' : ''}" onclick="ListView.toggleSort('title')">
            Titel ${this._sortIcon('title')}
          </th>
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
      <div class="list-table-wrap">
        <table class="list-table">
          ${theadHtml}
          <tbody id="task-tbody">
            <tr class="quick-add-row">
              <td colspan="8">
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
              : isEmpty ? `<tr class="empty-row"><td colspan="8"><div class="empty-state-inline"><p>Ingen opgaver endnu — skriv en titel ovenfor</p></div></td></tr>` : ''
            }
          </tbody>
        </table>
      </div>
      ${doneSection}
    `;
  },

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

  async deleteTask(taskId) {
    if (!confirm('Er du sikker på, at du vil slette denne opgave?')) return;
    await TaskAPI.delete(taskId);
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

  // ── Inline Description ──

  toggleDesc(taskId) {
    if (this._expandedDesc === taskId) {
      this._expandedDesc = null;
    } else {
      this._expandedDesc = taskId;
    }
    App.render().then(() => {
      const ta = document.getElementById('desc-inline-' + taskId);
      if (ta) ta.focus();
    });
  },

  async saveDesc(taskId) {
    const ta = document.getElementById('desc-inline-' + taskId);
    if (!ta) return;
    await TaskAPI.update(taskId, { description: ta.value });
    // Keep it open so user sees the saved state
    App.render();
  },

  _renderRow(task, members, today, isDone = false) {
    const member = members.find(m => m.id === task.assignee_id);
    const isOverdue = task.deadline && task.deadline < today && task.status !== 'done';
    const statusLabels = { todo: 'To Do', 'in-progress': 'In Progress', review: 'Review', done: 'Done' };
    const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
    const typeLabels = { onboarding: 'Onboarding', support: 'Support', bug: 'Bug', 'feature-request': 'Feature', 'cs-followup': 'CS Follow-up', internal: 'Internal' };

    const hasDesc = task.description && task.description.trim().length > 0;
    const descPreview = hasDesc ? task.description.trim().substring(0, 80).replace(/\n/g, ' ') : '';
    const isDescOpen = this._expandedDesc === task.id;

    // Description fold-out row
    const descRow = isDescOpen ? `
      <tr class="desc-row">
        <td></td>
        <td colspan="7">
          <div class="desc-inline-wrap">
            <textarea class="desc-inline-textarea" id="desc-inline-${task.id}" rows="3"
                      placeholder="Skriv beskrivelse..."
                      onblur="ListView.saveDesc('${task.id}')"
                      onkeydown="if(event.key==='Escape'){ListView.toggleDesc('${task.id}')}">${this._esc(task.description || '')}</textarea>
          </div>
        </td>
      </tr>
    ` : '';

    return `
      <tr class="task-row ${isDone ? 'task-row-done' : ''} ${isDescOpen ? 'task-row-desc-open' : ''}" data-id="${task.id}"
          draggable="${!isDone}" ondragstart="ListView.dragStart(event, '${task.id}')"
          ondragover="ListView.dragOver(event)" ondrop="ListView.drop(event)"
          ondragend="ListView.dragEnd(event)">
        <td class="col-drag" onclick="event.stopPropagation()">
          ${!isDone ? '<span class="drag-handle" title="Træk for at sortere">⠿</span>' : ''}
        </td>
        <td class="col-title" onclick="event.stopPropagation()">
          <div class="task-title-cell">
            <span class="priority-dot priority-dot-${task.priority}"></span>
            <div class="title-and-desc">
              <div class="title-row">
                <span class="inline-title truncate" onclick="ListView.editTitle(this, '${task.id}')">${this._esc(task.title)}</span>
                <button class="btn-desc ${hasDesc ? 'has-content' : ''}" onclick="event.stopPropagation(); ListView.toggleDesc('${task.id}')" title="${hasDesc ? 'Vis/rediger beskrivelse' : 'Tilføj beskrivelse'}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </button>
              </div>
              ${hasDesc && !isDescOpen ? `<span class="desc-preview" onclick="ListView.toggleDesc('${task.id}')">${this._esc(descPreview)}${task.description.trim().length > 80 ? '...' : ''}</span>` : ''}
            </div>
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
          <button class="btn-delete" onclick="ListView.deleteTask('${task.id}')" title="Slet opgave">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
      ${descRow}
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
