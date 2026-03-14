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
    csm: { label: 'Customer Success', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
    marketing: { label: 'Marketing', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>' }
  },

  setTab(tab) {
    this.state.tab = tab;
    this.state.filters = { search: '', status: '', priority: '', type: '', assignee_id: '' };
    this.closeMobileMenu();
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
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>${this.tabs[this.state.tab].label}</h2>
        </div>
        <div class="main-header-right">
          ${this._headerStats(tasks)}
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
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>${this.tabs[this.state.tab].label}</h2>
        </div>
        <div class="main-header-right">
          ${this._headerStats(tasks)}
        </div>
      </div>
      ${await Filters.render()}
      <div class="main-content">
        ${calendarHTML}
      </div>
    `;
  },

  setView(view) {
    this.state.view = view;
    this.render();
  },

  // ── Mobile Menu ──

  toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (!sidebar) return;
    const isOpen = sidebar.classList.contains('open');
    sidebar.classList.toggle('open', !isOpen);
    if (overlay) overlay.classList.toggle('open', !isOpen);
  },

  closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
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

  // ── Header Stats (compact, top-right) ──

  _headerStats(tasks) {
    const today = new Date().toISOString().split('T')[0];
    const open = tasks.filter(t => t.status !== 'done').length;
    const critical = tasks.filter(t => t.priority === 'critical' && t.status !== 'done').length;
    const overdue = tasks.filter(t => t.deadline && t.deadline < today && t.status !== 'done').length;
    const dueThisWeek = (() => {
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + (7 - now.getDay()));
      return tasks.filter(t => {
        if (!t.deadline || t.status === 'done') return false;
        const d = new Date(t.deadline + 'T00:00:00');
        return d <= weekEnd;
      }).length;
    })();

    return `
      <div class="header-stats">
        <span class="header-stat"><strong>${open}</strong> Åbne</span>
        ${critical > 0 ? `<span class="header-stat header-stat-critical"><strong>${critical}</strong> Kritiske</span>` : ''}
        ${overdue > 0 ? `<span class="header-stat header-stat-overdue"><strong>${overdue}</strong> Forfaldne</span>` : ''}
        ${dueThisWeek > 0 ? `<span class="header-stat"><strong>${dueThisWeek}</strong> Denne uge</span>` : ''}
      </div>
    `;
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
