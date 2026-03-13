/* ═══════════════════════════════════════════
   Kanban View — Drag-and-drop board
   ═══════════════════════════════════════════ */

const KanbanView = {
  _columns: [
    { status: 'todo', label: 'To Do' },
    { status: 'in-progress', label: 'In Progress' },
    { status: 'review', label: 'Review' },
    { status: 'done', label: 'Done' }
  ],

  async render(tasks) {
    const members = await TeamAPI.getAll();
    const today = new Date().toISOString().split('T')[0];

    return `
      <div class="kanban-board">
        ${this._columns.map(col => {
          const colTasks = tasks
            .filter(t => t.status === col.status)
            .sort((a, b) => {
              // Sort by priority first (critical first), then deadline
              const po = ['critical', 'high', 'medium', 'low'];
              const pCmp = po.indexOf(a.priority) - po.indexOf(b.priority);
              if (pCmp !== 0) return pCmp;
              const da = a.deadline || '9999-12-31';
              const db = b.deadline || '9999-12-31';
              return da.localeCompare(db);
            });

          return `
            <div class="kanban-column" data-status="${col.status}"
                 ondragover="KanbanView._onDragOver(event)"
                 ondragleave="KanbanView._onDragLeave(event)"
                 ondrop="KanbanView._onDrop(event)">
              <div class="kanban-column-header">
                <span class="kanban-column-title">${col.label}</span>
                <span class="kanban-column-count">${colTasks.length}</span>
              </div>
              <div class="kanban-column-body">
                ${colTasks.map(t => this._renderCard(t, members, today)).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  _renderCard(task, members, today) {
    const member = members.find(m => m.id === task.assignee_id);
    const isOverdue = task.deadline && task.deadline < today && task.status !== 'done';
    const typeLabels = { onboarding: 'Onboarding', support: 'Support', bug: 'Bug', 'feature-request': 'Feature', 'cs-followup': 'CS Follow-up', internal: 'Internal' };

    return `
      <div class="kanban-card priority-border-${task.priority}"
           draggable="true"
           data-task-id="${task.id}"
           ondragstart="KanbanView._onDragStart(event)"
           ondragend="KanbanView._onDragEnd(event)"
           onclick="TaskModal.open('${task.id}')">
        <div class="kanban-card-header">
          <span class="tag text-xs">${typeLabels[task.type] || task.type}</span>
          <span class="badge badge-${task.priority} text-xs">${task.priority}</span>
        </div>
        <div class="kanban-card-title">${this._esc(task.title)}</div>
        <div class="kanban-card-footer">
          <span class="${isOverdue ? 'text-overdue' : 'text-tertiary'} text-xs">
            ${task.deadline ? this._formatDate(task.deadline) + (isOverdue ? ' !' : '') : ''}
          </span>
          ${member
            ? `<span class="avatar avatar-sm" style="background:${member.avatar_color}" title="${member.name}">${member.name[0]}</span>`
            : ''
          }
        </div>
      </div>
    `;
  },

  // ── Drag & Drop ──

  _onDragStart(e) {
    const card = e.target.closest('.kanban-card');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.taskId);
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => card.classList.add('dragging'));
  },

  _onDragEnd(e) {
    const card = e.target.closest('.kanban-card');
    if (card) card.classList.remove('dragging');
    // Remove all drag-over states
    document.querySelectorAll('.kanban-column.drag-over').forEach(col => col.classList.remove('drag-over'));
  },

  _onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const col = e.target.closest('.kanban-column');
    if (col) col.classList.add('drag-over');
  },

  _onDragLeave(e) {
    const col = e.target.closest('.kanban-column');
    if (col && !col.contains(e.relatedTarget)) {
      col.classList.remove('drag-over');
    }
  },

  async _onDrop(e) {
    e.preventDefault();
    const col = e.target.closest('.kanban-column');
    if (!col) return;
    col.classList.remove('drag-over');

    const taskId = e.dataTransfer.getData('text/plain');
    const newStatus = col.dataset.status;
    if (!taskId || !newStatus) return;

    const task = await TaskAPI.get(taskId);
    if (task && task.status !== newStatus) {
      await TaskAPI.update(taskId, { status: newStatus });
      App.toast(`Opgave flyttet til ${newStatus.replace('-', ' ')}`, 'success');
      App.render();
    }
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
