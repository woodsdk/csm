/* ═══════════════════════════════════════════
   Filters — Search + dropdown filters
   ═══════════════════════════════════════════ */

import { TeamAPI } from '../api';
import { escapeHtml } from '../utils';
import type { TeamMember } from '../types';

export const Filters = {
  _debounceTimer: null as ReturnType<typeof setTimeout> | null,

  async render(): Promise<string> {
    const members: TeamMember[] = await TeamAPI.getAll();
    const f = (window as any).App.state.filters;
    const hasFilters = f.search || f.status || f.priority || f.type || f.assignee_id;

    const view = (window as any).App.state.view;

    return `
      <div class="filter-bar">
        <div class="view-toggle">
          <button class="view-toggle-btn ${view === 'list' ? 'active' : ''}" onclick="App.setView('list')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Liste
          </button>
          <button class="view-toggle-btn ${view === 'kanban' ? 'active' : ''}" onclick="App.setView('kanban')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/></svg>
            Kanban
          </button>
        </div>

        <div class="filter-divider"></div>

        <div class="filter-search">
          <svg class="filter-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="input filter-search-input" type="text" placeholder="Søg..."
                 value="${escapeHtml(f.search || '')}"
                 oninput="Filters.onSearch(this.value)">
        </div>

        <select class="select filter-select" onchange="Filters.set('status', this.value)">
          <option value="">Status</option>
          <option value="todo" ${f.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="in-progress" ${f.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="blocked" ${f.status === 'blocked' ? 'selected' : ''}>Blocked</option>
          <option value="review" ${f.status === 'review' ? 'selected' : ''}>Review</option>
          <option value="done" ${f.status === 'done' ? 'selected' : ''}>Done</option>
        </select>

        <select class="select filter-select" onchange="Filters.set('priority', this.value)">
          <option value="">Prioritet</option>
          <option value="critical" ${f.priority === 'critical' ? 'selected' : ''}>Critical</option>
          <option value="high" ${f.priority === 'high' ? 'selected' : ''}>High</option>
          <option value="medium" ${f.priority === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="low" ${f.priority === 'low' ? 'selected' : ''}>Low</option>
        </select>

        <select class="select filter-select" onchange="Filters.set('type', this.value)">
          <option value="">Type</option>
          <option value="onboarding" ${f.type === 'onboarding' ? 'selected' : ''}>Onboarding</option>
          <option value="support" ${f.type === 'support' ? 'selected' : ''}>Support</option>
          <option value="bug" ${f.type === 'bug' ? 'selected' : ''}>Bug</option>
          <option value="feature-request" ${f.type === 'feature-request' ? 'selected' : ''}>Feature</option>
          <option value="cs-followup" ${f.type === 'cs-followup' ? 'selected' : ''}>CS Follow-up</option>
          <option value="internal" ${f.type === 'internal' ? 'selected' : ''}>Internal</option>
        </select>

        <select class="select filter-select" onchange="Filters.set('assignee_id', this.value)">
          <option value="">Ansvarlig</option>
          ${members.map(m => `<option value="${m.id}" ${f.assignee_id === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select>

        ${hasFilters ? '<button class="filter-clear-btn" onclick="Filters.clear()">✕</button>' : ''}
      </div>
    `;
  },

  onSearch(value: string): void {
    clearTimeout(this._debounceTimer!);
    this._debounceTimer = setTimeout(() => {
      (window as any).App.state.filters.search = value;
      (window as any).App.render();
    }, 200);
  },

  set(key: string, value: string): void {
    (window as any).App.state.filters[key] = value || '';
    (window as any).App.render();
  },

  clear(): void {
    (window as any).App.state.filters = { search: '', status: '', priority: '', type: '', assignee_id: '' };
    (window as any).App.render();
  }
};

(window as any).Filters = Filters;
