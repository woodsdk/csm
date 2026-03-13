/* ═══════════════════════════════════════════
   Sidebar — Navigation + Stats
   ═══════════════════════════════════════════ */

const Sidebar = {
  async render() {
    const tasks = await TaskAPI.getAll({});
    const today = new Date().toISOString().split('T')[0];

    const open = tasks.filter(t => t.status !== 'done').length;
    const critical = tasks.filter(t => t.priority === 'critical' && t.status !== 'done').length;
    const overdue = tasks.filter(t => t.deadline && t.deadline < today && t.status !== 'done').length;
    const dueThisWeek = tasks.filter(t => {
      if (!t.deadline || t.status === 'done') return false;
      const d = new Date(t.deadline + 'T00:00:00');
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + (7 - now.getDay()));
      return d <= weekEnd;
    }).length;

    return `
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-logo">
            <span class="sidebar-logo-peoples">PEOPLE'S</span>
            <span class="sidebar-logo-doctor">DOCTOR</span>
          </div>
        </div>

        <div class="sidebar-section-title">Platform</div>
        <nav class="sidebar-nav">
          ${Object.entries(App.tabs).map(([key, tab]) => `
            <button class="sidebar-nav-item ${App.state.tab === key ? 'active' : ''}" onclick="App.setTab('${key}')">
              ${tab.icon}
              ${tab.label}
              ${App.state.tab === key && open > 0 ? `<span class="sidebar-count">${open}</span>` : ''}
            </button>
          `).join('')}
        </nav>

        <div class="sidebar-divider"></div>

        <div class="sidebar-stats">
          <div class="sidebar-stat">
            <span class="sidebar-stat-value">${open}</span>
            <span class="sidebar-stat-label">Åbne</span>
          </div>
          ${critical > 0 ? `
          <div class="sidebar-stat sidebar-stat-critical">
            <span class="sidebar-stat-value">${critical}</span>
            <span class="sidebar-stat-label">Kritiske</span>
          </div>` : `
          <div class="sidebar-stat">
            <span class="sidebar-stat-value">0</span>
            <span class="sidebar-stat-label">Kritiske</span>
          </div>`}
          ${overdue > 0 ? `
          <div class="sidebar-stat sidebar-stat-overdue">
            <span class="sidebar-stat-value">${overdue}</span>
            <span class="sidebar-stat-label">Forfaldne</span>
          </div>` : `
          <div class="sidebar-stat">
            <span class="sidebar-stat-value">0</span>
            <span class="sidebar-stat-label">Forfaldne</span>
          </div>`}
          <div class="sidebar-stat">
            <span class="sidebar-stat-value">${dueThisWeek}</span>
            <span class="sidebar-stat-label">Denne uge</span>
          </div>
        </div>

        <div class="sidebar-footer">
          <span class="text-xs text-tertiary">SynergyHub v0.1</span>
        </div>
      </aside>
    `;
  }
};
