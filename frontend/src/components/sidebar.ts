/* ═══════════════════════════════════════════
   Sidebar — Navigation
   ═══════════════════════════════════════════ */

export const Sidebar = {
  async render(): Promise<string> {
    const app = (window as any).App;
    const isHelpdeskPage = app.state.page === 'helpdesk' || app.state.page === 'helpdesk-detail';
    const isAskPage = app.state.page === 'ask-synergyhub';
    const isTaskPage = app.state.page === 'tasks';
    const isCalendarPage = app.state.page === 'calendar';
    const isOnboardingPage = app.state.page === 'onboarding';
    const isVagtplanPage = app.state.page === 'vagtplan';
    const isTeamPage = app.state.page === 'team';
    const isTrainingPage = app.state.page === 'training';
    const isSettingsPage = app.state.page === 'settings';

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

          <button class="sidebar-nav-item sidebar-ask-btn ${isAskPage ? 'active' : ''}" onclick="App.navigateTo('ask-synergyhub')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            </svg>
            Ask SynergyHub
          </button>

          ${Object.entries(app.tabs).map(([key, tab]: [string, any]) => `
            <button class="sidebar-nav-item ${isTaskPage && app.state.tab === key ? 'active' : ''}" onclick="App.navigateTo('tasks', '${key}')">
              ${tab.icon}
              ${tab.label}
            </button>
          `).join('')}

          <button class="sidebar-nav-item ${isOnboardingPage ? 'active' : ''}" onclick="App.navigateTo('onboarding')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            Dashboard
          </button>

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
          <button class="sidebar-nav-item ${isSettingsPage ? 'active' : ''}" onclick="App.navigateTo('settings')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Indstillinger
          </button>
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
