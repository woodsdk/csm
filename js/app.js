/* ═══════════════════════════════════════════
   SynergyHub App — Main controller
   ═══════════════════════════════════════════ */

const App = {
  state: {
    tab: 'csm',             // csm | marketing
    view: 'list',           // list | kanban | calendar
    filters: {
      search: '',
      status: '',
      priority: '',
      type: '',
      assignee_id: ''
    }
  },

  tabs: {
    csm: { label: 'CSM', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
    marketing: { label: 'Marketing', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>' }
  },

  setTab(tab) {
    this.state.tab = tab;
    this.state.filters = { search: '', status: '', priority: '', type: '', assignee_id: '' };
    this.render();
  },

  async init() {
    TaskModal.init();
    EventModal.init();
    CalendarSettings.init();
    GoogleCal.tryRestore();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      // Close shortcuts overlay on Escape
      if (e.key === 'Escape') {
        this.hideShortcuts();
        return;
      }
      if (e.key === '?') { e.preventDefault(); this.toggleShortcuts(); return; }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); TaskModal.open(); return; }
      if (e.key === '/') {
        e.preventDefault();
        const search = document.querySelector('.filter-search');
        if (search) search.focus();
        return;
      }
      if (e.key === '1') { e.preventDefault(); this.setView('list'); return; }
      if (e.key === '2') { e.preventDefault(); this.setView('kanban'); return; }
      if (e.key === '3') { e.preventDefault(); this.setView('calendar'); return; }
    });

    await this.render();
  },

  async render() {
    const sidebarEl = document.getElementById('sidebar');
    const mainEl = document.getElementById('main');

    sidebarEl.innerHTML = await Sidebar.render();

    if (this.state.view === 'calendar') {
      await this._renderCalendarPage(mainEl);
    } else {
      await this._renderTasksPage(mainEl);
    }
  },

  async _renderTasksPage(container) {
    const filters = { ...this.state.filters, tab: this.state.tab };
    const tasks = await TaskAPI.getAll(filters);
    const filtersHTML = await Filters.render();
    const contentHTML = this.state.view === 'kanban'
      ? await KanbanView.render(tasks)
      : await ListView.render(tasks);

    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <h2>${this.tabs[this.state.tab].label}</h2>
          <span class="text-tertiary text-sm">${tasks.length} opgave${tasks.length !== 1 ? 'r' : ''}</span>
          <div class="status-counts">${this._statusCounts(tasks)}</div>
        </div>
        <div class="main-header-right">
          <div class="view-toggle">
            <button class="btn btn-sm ${this.state.view === 'list' ? 'btn-active' : 'btn-ghost'}" onclick="App.setView('list')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Liste
            </button>
            <button class="btn btn-sm ${this.state.view === 'kanban' ? 'btn-active' : 'btn-ghost'}" onclick="App.setView('kanban')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/></svg>
              Kanban
            </button>
            <button class="btn btn-sm ${this.state.view === 'calendar' ? 'btn-active' : 'btn-ghost'}" onclick="App.setView('calendar')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Kalender
            </button>
          </div>
        </div>
      </div>
      ${filtersHTML}
      <div class="main-content">
        ${contentHTML}
      </div>
    `;
  },

  async _renderCalendarPage(container) {
    const tasks = await TaskAPI.getAll({});
    const calendarHTML = await CalendarView.render(tasks);

    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <h2>Kalender</h2>
          <span class="text-tertiary text-sm">Opgaver & events</span>
        </div>
        <div class="main-header-right">
          <div class="view-toggle">
            <button class="btn btn-sm btn-ghost" onclick="App.setView('list')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Liste
            </button>
            <button class="btn btn-sm btn-ghost" onclick="App.setView('kanban')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/></svg>
              Kanban
            </button>
            <button class="btn btn-sm btn-active" onclick="App.setView('calendar')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Kalender
            </button>
          </div>
        </div>
      </div>
      <div class="main-content">
        ${calendarHTML}
      </div>
    `;
  },

  setView(view) {
    this.state.view = view;
    this.render();
  },

  // ── Keyboard Shortcuts Overlay ──

  toggleShortcuts() {
    const el = document.getElementById('shortcuts-overlay');
    if (!el) return;
    el.classList.toggle('open');
  },

  showShortcuts() {
    const el = document.getElementById('shortcuts-overlay');
    if (el) el.classList.add('open');
  },

  hideShortcuts() {
    const el = document.getElementById('shortcuts-overlay');
    if (el) el.classList.remove('open');
  },

  // ── Status Counts ──

  _statusCounts(tasks) {
    const counts = { todo: 0, 'in-progress': 0, review: 0 };
    const labels = { todo: 'To Do', 'in-progress': 'In Progress', review: 'Review' };
    tasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
    return Object.entries(counts)
      .filter(([, c]) => c > 0)
      .map(([s, c]) => `<span class="status-count-item"><span class="status-dot status-dot-${s}"></span>${c} ${labels[s]}</span>`)
      .join(' ');
  },

  // ── Toast ──

  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
