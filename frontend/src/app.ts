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
import { TrainingList } from './components/training-list';
import { FaqList } from './components/faq-list';
import { TrainingSlideshow } from './components/training-slideshow';
import { HelpdeskList } from './components/helpdesk-list';
import { HelpdeskDetail } from './components/helpdesk-detail';
import { OnboardingDashboard } from './components/onboarding-dashboard';
import { UserDetail } from './components/user-detail';
import { AskSynergyHub } from './components/ask-synergyhub';
import { SettingsPage } from './components/settings-page';
import { MarketingPage } from './components/marketing-page';
import { MarketingFlowEditor } from './components/marketing-flow-editor';
import { DPAManager } from './components/dpa-manager';
import { DPASign } from './components/dpa-sign';
import { CommsPage } from './components/comms-page';
import { GoogleCal } from './google-calendar';
import type { Task, AppState } from './types';

export const App = {
  state: {
    page: 'helpdesk',
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
      label: 'Task Management',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
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

    // Public DPA signing page: /dpa/{token}
    const dpaMatch = window.location.pathname.match(/^\/dpa\/([^/]+)$/);
    if (dpaMatch) {
      DPASign.setToken(dpaMatch[1]);
      await this._renderPublicDPAPage();
      return;
    }

    // Handle URL params (e.g., ?page=settings after OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    if (pageParam) {
      this.state.page = pageParam as AppState['page'];
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

    if (this.state.page === 'helpdesk') {
      await this._renderHelpdeskPage(mainEl);
    } else if (this.state.page === 'helpdesk-detail') {
      await this._renderHelpdeskDetailPage(mainEl);
    } else if (this.state.page === 'team') {
      await this._renderTeamPage(mainEl);
    } else if (this.state.page === 'training') {
      await this._renderTrainingPage(mainEl);
    } else if (this.state.page === 'vagtplan') {
      await this._renderVagtplanPage(mainEl);
    } else if (this.state.page === 'calendar') {
      await this._renderCalendarPage(mainEl);
    } else if (this.state.page === 'onboarding') {
      await this._renderOnboardingPage(mainEl);
    } else if (this.state.page === 'user-detail') {
      await this._renderUserDetailPage(mainEl);
    } else if (this.state.page === 'ask-synergyhub') {
      await this._renderAskPage(mainEl);
    } else if (this.state.page === 'marketing') {
      await this._renderMarketingPage(mainEl);
    } else if (this.state.page === 'dpa') {
      await this._renderDPAPage(mainEl);
    } else if (this.state.page === 'comms') {
      await this._renderCommsPage(mainEl);
    } else if (this.state.page === 'settings') {
      await this._renderSettingsPage(mainEl);
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

  async _renderPublicDPAPage(): Promise<void> {
    const sidebarEl = document.getElementById('sidebar');
    const mainEl = document.getElementById('main');
    if (!mainEl) return;

    if (sidebarEl) sidebarEl.style.display = 'none';
    const overlay = document.querySelector('.sidebar-overlay') as HTMLElement;
    if (overlay) overlay.style.display = 'none';

    mainEl.style.marginLeft = '0';
    mainEl.style.width = '100%';

    mainEl.innerHTML = await DPASign.render();
  },

  async _renderDPAPage(container: HTMLElement): Promise<void> {
    const contentHTML = await DPAManager.render();

    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>DPA</h2>
        </div>
      </div>
      <div class="main-content">
        ${contentHTML}
      </div>
    `;
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

  _trainingTab: 'checklist' as 'checklist' | 'faq' | 'about',

  setTrainingTab(tab: 'checklist' | 'faq' | 'about'): void {
    this._trainingTab = tab;
    this.render();
  },

  async _renderTrainingPage(container: HTMLElement): Promise<void> {
    const tab = this._trainingTab;
    let contentHTML = '';
    if (tab === 'checklist') contentHTML = await TrainingList.render();
    else if (tab === 'faq') contentHTML = await FaqList.render();
    else contentHTML = await TrainingSlideshow.render();

    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>Opl\u00e6ring</h2>
        </div>
      </div>
      <div class="main-content">
        <div class="training-tabs">
          <button class="training-tab ${tab === 'about' ? 'training-tab-active' : ''}" onclick="App.setTrainingTab('about')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            Om People's Clinic
          </button>
          <button class="training-tab ${tab === 'checklist' ? 'training-tab-active' : ''}" onclick="App.setTrainingTab('checklist')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Onboardere checkliste
          </button>
          <button class="training-tab ${tab === 'faq' ? 'training-tab-active' : ''}" onclick="App.setTrainingTab('faq')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            FAQ
          </button>
        </div>
        ${contentHTML}
      </div>
    `;
  },

  async _renderHelpdeskPage(container: HTMLElement): Promise<void> {
    const contentHTML = await HelpdeskList.render();

    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>Helpdesk</h2>
        </div>
      </div>
      <div class="main-content">
        ${contentHTML}
      </div>
    `;
  },

  async _renderHelpdeskDetailPage(container: HTMLElement): Promise<void> {
    const ticketId = this.state.tab;
    const contentHTML = await HelpdeskDetail.render(ticketId);

    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>Helpdesk</h2>
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

    const isStandalone = this.state.page === 'calendar';

    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>${isStandalone ? 'Kalender' : this.tabs[this.state.tab]?.label || 'Kalender'}</h2>
        </div>
      </div>
      <div class="main-content">
        ${calendarHTML}
      </div>
    `;
  },

  async _renderOnboardingPage(container: HTMLElement): Promise<void> {
    const contentHTML = await OnboardingDashboard.render();
    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>Dashboard</h2>
        </div>
      </div>
      <div class="main-content">
        ${contentHTML}
      </div>
    `;
  },

  async _renderUserDetailPage(container: HTMLElement): Promise<void> {
    const userId = this.state.tab;
    const contentHTML = await UserDetail.render(userId);
    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>Brugerprofil</h2>
        </div>
      </div>
      <div class="main-content">
        ${contentHTML}
      </div>
    `;
  },

  async _renderAskPage(container: HTMLElement): Promise<void> {
    const contentHTML = await AskSynergyHub.render();
    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:-3px;margin-right:6px;opacity:0.7">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            </svg>
            Ask SynergyHub
          </h2>
        </div>
      </div>
      <div class="main-content ask-page-content">
        ${contentHTML}
      </div>
    `;
  },

  async _renderMarketingPage(container: HTMLElement): Promise<void> {
    const contentHTML = await MarketingPage.render();
    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>Marketing</h2>
        </div>
      </div>
      <div class="main-content">
        ${contentHTML}
      </div>
    `;
    MarketingFlowEditor.init();
  },

  async _renderCommsPage(container: HTMLElement): Promise<void> {
    const contentHTML = await CommsPage.render();
    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>Platform Kommunikation</h2>
        </div>
      </div>
      <div class="main-content">
        ${contentHTML}
      </div>
    `;
  },

  async _renderSettingsPage(container: HTMLElement): Promise<void> {
    const contentHTML = await SettingsPage.render();
    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>Indstillinger</h2>
        </div>
      </div>
      <div class="main-content">
        ${contentHTML}
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
