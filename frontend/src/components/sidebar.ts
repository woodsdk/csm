/* ═══════════════════════════════════════════
   Sidebar — Navigation
   ═══════════════════════════════════════════ */

export const Sidebar = {
  async render(): Promise<string> {
    const app = (window as any).App;
    const isHelpdeskPage = app.state.page === 'helpdesk' || app.state.page === 'helpdesk-detail';
    const isTaskPage = app.state.page === 'tasks';
    const isCalendarPage = app.state.page === 'calendar';
    const isVagtplanPage = app.state.page === 'vagtplan';
    const isTeamPage = app.state.page === 'team';
    const isTrainingPage = app.state.page === 'training';

    return `
      <aside class="sidebar">
        <div class="sidebar-brand">
          <img src="/assets/peoples-clinic.svg" alt="People's Clinic" class="sidebar-logo-img">
        </div>

        <nav class="sidebar-nav">
          <div class="sidebar-section-title">Customer Success</div>

          <button class="sidebar-nav-item ${isHelpdeskPage ? 'active' : ''}" onclick="App.navigateTo('helpdesk')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            Helpdesk
          </button>

          ${Object.entries(app.tabs).map(([key, tab]: [string, any]) => `
            <button class="sidebar-nav-item ${isTaskPage && app.state.tab === key ? 'active' : ''}" onclick="App.navigateTo('tasks', '${key}')">
              ${tab.icon}
              ${tab.label}
            </button>
          `).join('')}

          <button class="sidebar-nav-item ${isCalendarPage ? 'active' : ''}" onclick="App.navigateTo('calendar')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Kalender
          </button>

          <div class="sidebar-section-title" style="margin-top: var(--space-4)">Internt</div>

          <button class="sidebar-nav-item ${isVagtplanPage ? 'active' : ''}" onclick="App.navigateTo('vagtplan')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Vagtplan
          </button>

          <button class="sidebar-nav-item ${isTeamPage ? 'active' : ''}" onclick="App.navigateTo('team')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Medarbejdere
          </button>

          <button class="sidebar-nav-item ${isTrainingPage ? 'active' : ''}" onclick="App.navigateTo('training')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            Opl\u00e6ring
          </button>
        </nav>

        <div class="sidebar-footer">
          <a href="/book-demo" target="_blank" class="sidebar-demo-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            Book demo
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto;opacity:0.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
          <span class="text-xs text-tertiary">v0.3</span>
        </div>
      </aside>
    `;
  }
};

(window as any).Sidebar = Sidebar;
