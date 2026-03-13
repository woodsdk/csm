/* ═══════════════════════════════════════════
   SynergyHub App — Main controller
   ═══════════════════════════════════════════ */

const App = {
  state: {
    view: 'list',           // list | kanban | calendar
    filters: {
      search: '',
      status: '',
      priority: '',
      type: '',
      assignee_id: ''
    }
  },

  async init() {
    Store.seedIfEmpty();
    TaskModal.init();
    EventModal.init();
    CalendarSettings.init();
    GoogleCal.tryRestore();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        TaskModal.open();
      }
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
    const tasks = await TaskAPI.getAll(this.state.filters);
    const filtersHTML = await Filters.render();
    const contentHTML = this.state.view === 'kanban'
      ? await KanbanView.render(tasks)
      : await ListView.render(tasks);

    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <h2>Opgaver</h2>
          <span class="text-tertiary text-sm">${tasks.length} opgave${tasks.length !== 1 ? 'r' : ''}</span>
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
          <button class="btn btn-primary" onclick="TaskModal.open()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ny opgave
          </button>
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
          <button class="btn btn-primary" onclick="TaskModal.open()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ny opgave
          </button>
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
