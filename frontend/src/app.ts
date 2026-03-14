/* ═══════════════════════════════════════════
   SynergyHub App — Main controller
   ═══════════════════════════════════════════ */

import { TaskAPI } from './api';
import { Sidebar } from './components/sidebar';
import { Filters } from './components/filters';
import { ListView } from './components/list-view';
import { KanbanView } from './components/kanban-view';
import { CalendarView } from './components/calendar-view';
import { TaskModal } from './components/task-modal';
import { EventModal } from './components/event-modal';
import { CalendarSettings } from './components/calendar-settings';
import { ShiftSchedule } from './components/shift-schedule';
import { TeamList } from './components/team-list';
import { DemoBooking } from './components/demo-booking';
import { DemoJoin } from './components/demo-join';
import { GoogleCal } from './google-calendar';
import type { Task, AppState } from './types';

export const App = {
  state: {
    page: 'tasks',
    tab: 'csm',
    view: 'list',
    filters: {
      search: '',
      status: '',
      priority: '',
      type: '',
      assignee_id: '',
    },
  } as AppState,

  tabs: {
    csm: {
      label: 'Customer Success',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    },
  } as Record<string, { label: string; icon: string }>,

  navigateTo(page: string, tab?: string): void {
    this.state.page = page as AppState['page'];
    if (tab) {
      this.state.tab = tab;
      this.state.filters = { search: '', status: '', priority: '', type: '', assignee_id: '' };
    }
    this.closeMobileMenu();
    this.render();
  },

  setTab(tab: string): void {
    this.state.page = 'tasks';
    this.state.tab = tab;
    this.state.filters = { search: '', status: '', priority: '', type: '', assignee_id: '' };
    this.closeMobileMenu();
    this.render();
  },

  async init(): Promise<void> {
    // Public booking page — skip all internal init
    if (window.location.pathname === '/book-demo') {
      this.state.page = 'book-demo';
      await this._renderPublicBookingPage();
      return;
    }

    // Public join page: /demo/{id}/join
    const joinMatch = window.location.pathname.match(/^\/demo\/([^/]+)\/join$/);
    if (joinMatch) {
      DemoJoin.setBookingId(joinMatch[1]);
      await this._renderPublicJoinPage();
      return;
    }

    TaskModal.init();
    EventModal.init();
    CalendarSettings.init();
    GoogleCal.tryRestore();

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      if (e.key === 'Escape') { ShiftSchedule.closeModal(); TeamList.closeModal(); this.hideShortcuts(); return; }
      if (e.key === '?') { e.preventDefault(); this.toggleShortcuts(); return; }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); TaskModal.open(); return; }
      if (e.key === '/') {
        e.preventDefault();
        const search = document.querySelector('.filter-search-input') as HTMLElement | null;
        if (search) search.focus();
        return;
      }
      if (e.key === '1') { e.preventDefault(); this.setView('list'); return; }
      if (e.key === '2') { e.preventDefault(); this.setView('kanban'); return; }
      if (e.key === '3') { e.preventDefault(); this.setView('calendar'); return; }
    });

    await this.render();
  },

  async render(): Promise<void> {
    const sidebarEl = document.getElementById('sidebar');
    const mainEl = document.getElementById('main');
    if (!sidebarEl || !mainEl) return;

    // Public page — no sidebar
    if (this.state.page === 'book-demo') {
      await this._renderPublicBookingPage();
      return;
    }

    sidebarEl.innerHTML = await Sidebar.render();

    if (this.state.page === 'team') {
      await this._renderTeamPage(mainEl);
    } else if (this.state.page === 'vagtplan') {
      await this._renderVagtplanPage(mainEl);
    } else if (this.state.view === 'calendar') {
      await this._renderCalendarPage(mainEl);
    } else {
      await this._renderTasksPage(mainEl);
    }
  },

  async _renderTasksPage(container: HTMLElement): Promise<void> {
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

  async _renderVagtplanPage(container: HTMLElement): Promise<void> {
    const scheduleHTML = await ShiftSchedule.render();

    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>Vagtplan</h2>
        </div>
      </div>
      <div class="main-content vagtplan-content">
        ${scheduleHTML}
      </div>
    `;
  },

  async _renderPublicBookingPage(): Promise<void> {
    const sidebarEl = document.getElementById('sidebar');
    const mainEl = document.getElementById('main');
    if (!mainEl) return;

    // Hide sidebar and overlay for public page
    if (sidebarEl) sidebarEl.style.display = 'none';
    const overlay = document.querySelector('.sidebar-overlay') as HTMLElement;
    if (overlay) overlay.style.display = 'none';

    // Give main area full width
    mainEl.style.marginLeft = '0';
    mainEl.style.width = '100%';

    const bookingHTML = await DemoBooking.render();
    mainEl.innerHTML = bookingHTML;
  },

  async _renderPublicJoinPage(): Promise<void> {
    const sidebarEl = document.getElementById('sidebar');
    const mainEl = document.getElementById('main');
    if (!mainEl) return;

    if (sidebarEl) sidebarEl.style.display = 'none';
    const overlay = document.querySelector('.sidebar-overlay') as HTMLElement;
    if (overlay) overlay.style.display = 'none';

    mainEl.style.marginLeft = '0';
    mainEl.style.width = '100%';

    mainEl.innerHTML = await DemoJoin.render();
  },

  async _renderTeamPage(container: HTMLElement): Promise<void> {
    const contentHTML = await TeamList.render();

    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>Medarbejdere</h2>
        </div>
      </div>
      <div class="main-content">
        ${contentHTML}
      </div>
    `;
  },

  async _renderCalendarPage(container: HTMLElement): Promise<void> {
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

  setView(view: string): void {
    this.state.view = view as AppState['view'];
    this.render();
  },

  toggleMobileMenu(): void {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (!sidebar) return;
    const isOpen = sidebar.classList.contains('open');
    sidebar.classList.toggle('open', !isOpen);
    if (overlay) overlay.classList.toggle('open', !isOpen);
  },

  closeMobileMenu(): void {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  },

  toggleShortcuts(): void {
    const el = document.getElementById('shortcuts-overlay');
    if (el) el.classList.toggle('open');
  },

  showShortcuts(): void {
    const el = document.getElementById('shortcuts-overlay');
    if (el) el.classList.add('open');
  },

  hideShortcuts(): void {
    const el = document.getElementById('shortcuts-overlay');
    if (el) el.classList.remove('open');
  },

  _headerStats(tasks: Task[]): string {
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
        <span class="header-stat"><strong>${open}</strong> \u00c5bne</span>
        ${critical > 0 ? `<span class="header-stat header-stat-critical"><strong>${critical}</strong> Kritiske</span>` : ''}
        ${overdue > 0 ? `<span class="header-stat header-stat-overdue"><strong>${overdue}</strong> Forfaldne</span>` : ''}
        ${dueThisWeek > 0 ? `<span class="header-stat"><strong>${dueThisWeek}</strong> Denne uge</span>` : ''}
      </div>
    `;
  },

  toast(message: string, type: string = 'info'): void {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },
};

// Expose globally for onclick handlers in HTML
(window as any).App = App;

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
