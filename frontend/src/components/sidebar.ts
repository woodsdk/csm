/* ═══════════════════════════════════════════
   Sidebar — Navigation
   ═══════════════════════════════════════════ */

export const Sidebar = {
  async render(): Promise<string> {
    const app = (window as any).App;
    const isTaskPage = app.state.page === 'tasks';
    const isVagtplanPage = app.state.page === 'vagtplan';

    return `
      <aside class="sidebar">
        <div class="sidebar-brand">
          <img src="/assets/peoples.svg" alt="People's Doctor" class="sidebar-logo-img">
        </div>

        <div class="sidebar-section-title">Task Management</div>
        <nav class="sidebar-nav">
          ${Object.entries(app.tabs).map(([key, tab]: [string, any]) => `
            <button class="sidebar-nav-item ${isTaskPage && app.state.tab === key ? 'active' : ''}" onclick="App.navigateTo('tasks', '${key}')">
              ${tab.icon}
              ${tab.label}
            </button>
          `).join('')}
        </nav>

        <div class="sidebar-divider"></div>

        <div class="sidebar-section-title">Vagtplan</div>
        <nav class="sidebar-nav">
          <button class="sidebar-nav-item ${isVagtplanPage ? 'active' : ''}" onclick="App.navigateTo('vagtplan')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Ugeoversigt
          </button>
        </nav>

        <div class="sidebar-divider"></div>

        <div class="sidebar-footer">
          <span class="text-xs text-tertiary">SynergyHub v0.2</span>
        </div>
      </aside>
    `;
  }
};

(window as any).Sidebar = Sidebar;
