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
          <img src="assets/peoples.svg" alt="People's Doctor" class="sidebar-logo-img">
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

        <div class="sidebar-footer">
          <span class="text-xs text-tertiary">SynergyHub v0.1</span>
        </div>
      </aside>
    `;
  }
};
