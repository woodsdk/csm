/* ═══════════════════════════════════════════
   List View — Sortable task table
   ═══════════════════════════════════════════ */

const ListView = {
  _sort: { column: 'deadline', dir: 'asc' },

  async render(tasks) {
    const members = await TeamAPI.getAll();
    const sorted = this._sortTasks([...tasks]);
    const today = new Date().toISOString().split('T')[0];

    if (sorted.length === 0) {
      return `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
          <p>Ingen opgaver matcher dine filtre</p>
        </div>
      `;
    }

    return `
      <div class="list-table-wrap">
        <table class="list-table">
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
          </thead>
          <tbody>
            ${sorted.map(t => this._renderRow(t, members, today)).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  _renderRow(task, members, today) {
    const member = members.find(m => m.id === task.assignee_id);
    const isOverdue = task.deadline && task.deadline < today && task.status !== 'done';
    const statusLabels = { todo: 'To Do', 'in-progress': 'In Progress', review: 'Review', done: 'Done' };
    const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
    const typeLabels = { onboarding: 'Onboarding', support: 'Support', bug: 'Bug', 'feature-request': 'Feature', 'cs-followup': 'CS Follow-up', internal: 'Internal' };

    return `
      <tr class="task-row" onclick="TaskModal.open('${task.id}')">
        <td class="col-title">
          <div class="task-title-cell">
            <span class="priority-dot priority-dot-${task.priority}"></span>
            <span class="truncate">${this._esc(task.title)}</span>
          </div>
        </td>
        <td class="col-status">
          <span class="badge badge-${task.status}">${statusLabels[task.status] || task.status}</span>
        </td>
        <td class="col-priority">
          <span class="badge badge-${task.priority}">${priorityLabels[task.priority] || task.priority}</span>
        </td>
        <td class="col-assignee">
          ${member
            ? `<span class="assignee-cell"><span class="avatar avatar-sm" style="background:${member.avatar_color}">${member.name[0]}</span> <span class="text-sm">${member.name}</span></span>`
            : '<span class="text-tertiary text-sm">-</span>'
          }
        </td>
        <td class="col-type"><span class="tag">${typeLabels[task.type] || task.type}</span></td>
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
