/* ═══════════════════════════════════════════
   Filters — Search + dropdown filters
   ═══════════════════════════════════════════ */

const Filters = {
  _debounceTimer: null,

  async render() {
    const members = await TeamAPI.getAll();
    const f = App.state.filters;
    const hasFilters = f.search || f.status || f.priority || f.type || f.assignee_id;

    const view = App.state.view;

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
          <button class="view-toggle-btn ${view === 'calendar' ? 'active' : ''}" onclick="App.setView('calendar')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Kalender
          </button>
        </div>

        <div class="filter-divider"></div>

        <div class="filter-search">
          <svg class="filter-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="input filter-search-input" type="text" placeholder="Søg..."
                 value="${this._esc(f.search || '')}"
                 oninput="Filters.onSearch(this.value)">
        </div>

        <select class="select filter-select" onchange="Filters.set('status', this.value)">
          <option value="">Status</option>
          <option value="todo" ${f.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="in-progress" ${f.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
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

  onSearch(value) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      App.state.filters.search = value;
      App.render();
    }, 200);
  },

  set(key, value) {
    App.state.filters[key] = value || '';
    App.render();
  },

  clear() {
    App.state.filters = { search: '', status: '', priority: '', type: '', assignee_id: '' };
    App.render();
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};
