/* ═══════════════════════════════════════════
   List View — Sortable task table
   ═══════════════════════════════════════════ */

const ListView = {
  _sort: { column: 'deadline', dir: 'asc' },
  _doneExpanded: false,

  async render(tasks) {
    const members = await TeamAPI.getAll();
    const today = new Date().toISOString().split('T')[0];

    const activeTasks = this._sortTasks(tasks.filter(t => t.status !== 'done'));
    const doneTasks = this._sortTasks(tasks.filter(t => t.status === 'done'));

    if (activeTasks.length === 0 && doneTasks.length === 0) {
      return `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
          <p>Ingen opgaver matcher dine filtre</p>
        </div>
      `;
    }

    const theadHtml = `
      <thead>
        <tr>
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
          <tbody>
            <tr class="quick-add-row">
              <td colspan="6">
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
              : ''
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

  async inlineUpdate(taskId, field, value) {
    await TaskAPI.update(taskId, { [field]: value || null });
    App.render();
  },

  async openDesc(taskId) {
    const task = await TaskAPI.get(taskId);
    if (!task) return;
    const overlay = document.getElementById('task-modal');
    overlay.innerHTML = `
      <div class="modal-panel modal-desc">
        <div class="modal-header">
          <h3>${this._esc(task.title)}</h3>
          <button class="btn-icon" onclick="ListView.closeDesc()" aria-label="Luk">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <textarea class="textarea" id="desc-textarea" rows="8" placeholder="Skriv beskrivelse...">${this._esc(task.description || '')}</textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="ListView.closeDesc()">Annuller</button>
          <button class="btn btn-primary" onclick="ListView.saveDesc('${taskId}')">Gem</button>
        </div>
      </div>
    `;
    overlay.classList.add('open');
    document.getElementById('desc-textarea').focus();
  },

  async saveDesc(taskId) {
    const desc = document.getElementById('desc-textarea').value;
    await TaskAPI.update(taskId, { description: desc });
    this.closeDesc();
    App.render();
  },

  closeDesc() {
    const overlay = document.getElementById('task-modal');
    overlay.classList.remove('open');
    overlay.innerHTML = '';
  },

  _renderRow(task, members, today, isDone = false) {
    const member = members.find(m => m.id === task.assignee_id);
    const isOverdue = task.deadline && task.deadline < today && task.status !== 'done';
    const statusLabels = { todo: 'To Do', 'in-progress': 'In Progress', review: 'Review', done: 'Done' };
    const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
    const typeLabels = { onboarding: 'Onboarding', support: 'Support', bug: 'Bug', 'feature-request': 'Feature', 'cs-followup': 'CS Follow-up', internal: 'Internal' };

    const hasDesc = task.description && task.description.trim().length > 0;

    return `
      <tr class="task-row ${isDone ? 'task-row-done' : ''}">
        <td class="col-title">
          <div class="task-title-cell">
            <span class="priority-dot priority-dot-${task.priority}"></span>
            <span class="truncate">${this._esc(task.title)}</span>
            <button class="btn-desc ${hasDesc ? 'has-content' : ''}" onclick="event.stopPropagation(); ListView.openDesc('${task.id}')" title="${hasDesc ? 'Læs/rediger beskrivelse' : 'Tilføj beskrivelse'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </button>
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
        <td class="col-deadline ${isOverdue ? 'text-overdue' : ''}">
          ${task.deadline ? this._formatDate(task.deadline) + (isOverdue ? ' !' : '') : '<span class="text-tertiary">-</span>'}
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

  _formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};
