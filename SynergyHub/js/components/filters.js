/* ═══════════════════════════════════════════
   Filters — Search + dropdown filters
   ═══════════════════════════════════════════ */

const Filters = {
  _debounceTimer: null,

  async render() {
    const members = await TeamAPI.getAll();
    const customers = await CustomerAPI.getAll();
    const f = App.state.filters;
    const hasFilters = f.search || f.status || f.priority || f.type || f.assignee_id || f.customer_id;

    return `
      <div class="filter-bar">
        <div class="filter-search">
          <svg class="filter-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="input filter-search-input" type="text" placeholder="Søg opgaver..."
                 value="${this._esc(f.search || '')}"
                 oninput="Filters.onSearch(this.value)">
        </div>

        <select class="select filter-select" onchange="Filters.set('status', this.value)">
          <option value="">Alle status</option>
          <option value="todo" ${f.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="in-progress" ${f.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="review" ${f.status === 'review' ? 'selected' : ''}>Review</option>
          <option value="done" ${f.status === 'done' ? 'selected' : ''}>Done</option>
        </select>

        <select class="select filter-select" onchange="Filters.set('priority', this.value)">
          <option value="">Alle prioriteter</option>
          <option value="critical" ${f.priority === 'critical' ? 'selected' : ''}>Critical</option>
          <option value="high" ${f.priority === 'high' ? 'selected' : ''}>High</option>
          <option value="medium" ${f.priority === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="low" ${f.priority === 'low' ? 'selected' : ''}>Low</option>
        </select>

        <select class="select filter-select" onchange="Filters.set('type', this.value)">
          <option value="">Alle typer</option>
          <option value="onboarding" ${f.type === 'onboarding' ? 'selected' : ''}>Onboarding</option>
          <option value="support" ${f.type === 'support' ? 'selected' : ''}>Support</option>
          <option value="bug" ${f.type === 'bug' ? 'selected' : ''}>Bug</option>
          <option value="feature-request" ${f.type === 'feature-request' ? 'selected' : ''}>Feature Request</option>
          <option value="cs-followup" ${f.type === 'cs-followup' ? 'selected' : ''}>CS Follow-up</option>
          <option value="internal" ${f.type === 'internal' ? 'selected' : ''}>Internal</option>
        </select>

        <select class="select filter-select" onchange="Filters.set('assignee_id', this.value)">
          <option value="">Alle ansvarlige</option>
          ${members.map(m => `<option value="${m.id}" ${f.assignee_id === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select>

        <select class="select filter-select filter-select-wide" onchange="Filters.set('customer_id', this.value)">
          <option value="">Alle kunder</option>
          ${customers.map(c => `<option value="${c.id}" ${f.customer_id === c.id ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('')}
        </select>

        ${hasFilters ? '<button class="btn btn-ghost btn-sm" onclick="Filters.clear()">Nulstil</button>' : ''}
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
    App.state.filters = { search: '', status: '', priority: '', type: '', assignee_id: '', customer_id: '' };
    App.render();
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};
