/* ═══════════════════════════════════════════
   Kanban View — Drag-and-drop board
   ═══════════════════════════════════════════ */

import { TaskAPI, TeamAPI } from '../api';
import { escapeHtml } from '../utils';
import type { Task, TeamMember } from '../types';

export const KanbanView = {
  _columns: [
    { status: 'todo', label: 'To Do' },
    { status: 'in-progress', label: 'In Progress' },
    { status: 'blocked', label: 'Blocked' },
    { status: 'review', label: 'Review' },
    { status: 'done', label: 'Done' }
  ] as Array<{ status: string; label: string }>,
  _wasDragging: false,

  async render(tasks: Task[]): Promise<string> {
    const members: TeamMember[] = await TeamAPI.getAll();
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

  _renderCard(task: Task, members: TeamMember[], today: string): string {
    const member = members.find(m => m.id === task.assignee_id);
    const isOverdue = task.deadline && task.deadline < today && task.status !== 'done';
    const typeLabels: Record<string, string> = { onboarding: 'Onboarding', support: 'Support', bug: 'Bug', 'feature-request': 'Feature', 'cs-followup': 'CS Follow-up', internal: 'Internal' };

    return `
      <div class="kanban-card priority-border-${task.priority}"
           draggable="true"
           data-task-id="${task.id}"
           ondragstart="KanbanView._onDragStart(event)"
           ondragend="KanbanView._onDragEnd(event)"
           onclick="KanbanView._onCardClick('${task.id}')">
        <div class="kanban-card-header">
          <span class="tag text-xs">${typeLabels[task.type] || task.type}</span>
          <span class="badge badge-${task.priority} text-xs">${task.priority}</span>
        </div>
        <div class="kanban-card-title">${escapeHtml(task.title)}</div>
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

  _onCardClick(taskId: string): void {
    if (this._wasDragging) {
      this._wasDragging = false;
      return;
    }
    (window as any).TaskModal.open(taskId);
  },

  _onDragStart(e: DragEvent): void {
    const card = (e.target as HTMLElement).closest('.kanban-card') as HTMLElement | null;
    if (!card) return;
    this._wasDragging = true;
    e.dataTransfer!.setData('text/plain', card.dataset.taskId!);
    e.dataTransfer!.effectAllowed = 'move';
    requestAnimationFrame(() => card.classList.add('dragging'));
  },

  _onDragEnd(e: DragEvent): void {
    const card = (e.target as HTMLElement).closest('.kanban-card') as HTMLElement | null;
    if (card) card.classList.remove('dragging');
    // Remove all drag-over states
    document.querySelectorAll('.kanban-column.drag-over').forEach(col => col.classList.remove('drag-over'));
    // Reset drag flag after click event fires
    setTimeout(() => { this._wasDragging = false; }, 0);
  },

  _onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    const col = (e.target as HTMLElement).closest('.kanban-column');
    if (col) col.classList.add('drag-over');
  },

  _onDragLeave(e: DragEvent): void {
    const col = (e.target as HTMLElement).closest('.kanban-column');
    if (col && !col.contains(e.relatedTarget as Node)) {
      col.classList.remove('drag-over');
    }
  },

  async _onDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    const col = (e.target as HTMLElement).closest('.kanban-column') as HTMLElement | null;
    if (!col) return;
    col.classList.remove('drag-over');

    const taskId = e.dataTransfer!.getData('text/plain');
    const newStatus = col.dataset.status;
    if (!taskId || !newStatus) return;

    const task = await TaskAPI.get(taskId);
    if (task && task.status !== newStatus) {
      await TaskAPI.update(taskId, { status: newStatus } as Partial<Task>);
      (window as any).App.toast(`Opgave flyttet til ${newStatus.replace('-', ' ')}`, 'success');
      (window as any).App.render();
    }
  },

  _formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  }
};

(window as any).KanbanView = KanbanView;
