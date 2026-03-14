/* ═══════════════════════════════════════════
   Sidebar — Navigation
   ═══════════════════════════════════════════ */

export const Sidebar = {
  async render(): Promise<string> {
    return `
      <aside class="sidebar">
        <div class="sidebar-brand">
          <img src="/assets/peoples.svg" alt="People's Doctor" class="sidebar-logo-img">
        </div>

        <div class="sidebar-section-title">Task Management</div>
        <nav class="sidebar-nav">
          ${Object.entries((window as any).App.tabs).map(([key, tab]: [string, any]) => `
            <button class="sidebar-nav-item ${(window as any).App.state.tab === key ? 'active' : ''}" onclick="App.setTab('${key}')">
              ${tab.icon}
              ${tab.label}
            </button>
          `).join('')}
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
