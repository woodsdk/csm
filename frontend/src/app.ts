/* ═══════════════════════════════════════════
   SynergyHub App — Main controller
   ═══════════════════════════════════════════ */

import { TaskAPI } from './api';
import { t, setLang as setLangFn } from './i18n';
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
    this._pushState();
    this.closeMobileMenu();
    this.render();
  },

  setTab(tab: string): void {
    this.state.page = 'tasks';
    this.state.tab = tab;
    this.state.filters = { search: '', status: '', priority: '', type: '', assignee_id: '' };
    this._pushState();
    this.closeMobileMenu();
    this.render();
  },

  _pushState(): void {
    const page = this.state.page;
    const tab = this.state.tab;
    let hash: string = page;
    if (page === 'tasks' && tab) hash = 'tasks/' + tab;
    if (window.location.hash !== `#${hash}`) {
      history.pushState(null, '', `#${hash}`);
    }
  },

  _restoreFromHash(): boolean {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash) return false;
    const parts = hash.split('/');
    this.state.page = parts[0] as AppState['page'];
    if (parts[0] === 'tasks' && parts[1]) {
      this.state.tab = parts[1];
    }
    return true;
  },

  setLang(lang: string): void {
    setLangFn(lang as any);
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

    // Auth gate — check if logged in
    if (!localStorage.getItem('synergyhub_auth')) {
      this._renderLogin();
      return;
    }

    // Handle URL params (e.g., ?page=settings after OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    if (pageParam) {
      this.state.page = pageParam as AppState['page'];
    }

    // Restore page from URL hash (e.g., #helpdesk, #tasks/csm)
    this._restoreFromHash();

    // Listen for browser back/forward
    window.addEventListener('popstate', () => {
      this._restoreFromHash();
      this.render();
    });

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

    // Public pages — re-check URL so render() works from public page callbacks
    const dpaMatch = window.location.pathname.match(/^\/dpa\/([^/]+)$/);
    if (dpaMatch) {
      await this._renderPublicDPAPage();
      return;
    }
    const joinMatch = window.location.pathname.match(/^\/demo\/([^/]+)\/join$/);
    if (joinMatch) {
      await this._renderPublicJoinPage();
      return;
    }
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
          <h2>${t('app.vagtplan')}</h2>
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
          <h2>${t('app.dpa')}</h2>
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
          <h2>${t('app.team')}</h2>
        </div>
      </div>
      <div class="main-content">
        ${contentHTML}
      </div>
    `;
  },

  _trainingTab: 'checklist' as 'checklist' | 'faq',

  setTrainingTab(tab: 'checklist' | 'faq'): void {
    this._trainingTab = tab;
    this.render();
  },

  async _renderTrainingPage(container: HTMLElement): Promise<void> {
    const tab = this._trainingTab === 'checklist' || this._trainingTab === 'faq' ? this._trainingTab : 'checklist';
    let contentHTML = '';
    if (tab === 'checklist') contentHTML = await TrainingList.render();
    else contentHTML = await FaqList.render();

    container.innerHTML = `
      <div class="main-header">
        <div class="main-header-left">
          <button class="mobile-menu-btn" onclick="App.toggleMobileMenu()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2>${t('app.training')}</h2>
        </div>
      </div>
      <div class="main-content">
        <div class="training-tabs">
          <button class="training-tab ${tab === 'checklist' ? 'training-tab-active' : ''}" onclick="App.setTrainingTab('checklist')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            ${t('app.onboardingChecklist')}
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
          <h2>${isStandalone ? t('app.calendar') : this.tabs[this.state.tab]?.label || t('app.calendar')}</h2>
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
          <h2>${t('app.userProfile')}</h2>
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
          <h2>Ask SynergyHub</h2>
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
          <h2>${t('app.comms')}</h2>
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
          <h2>${t('app.settings')}</h2>
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
        <span class="header-stat"><strong>${open}</strong> ${t('app.open')}</span>
        ${critical > 0 ? `<span class="header-stat header-stat-critical"><strong>${critical}</strong> ${t('app.critical')}</span>` : ''}
        ${overdue > 0 ? `<span class="header-stat header-stat-overdue"><strong>${overdue}</strong> ${t('app.overdue')}</span>` : ''}
        ${dueThisWeek > 0 ? `<span class="header-stat"><strong>${dueThisWeek}</strong> ${t('app.thisWeek')}</span>` : ''}
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

  _renderLogin(): void {
    document.body.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <img src="/assets/peoples-clinic.svg" alt="People's Doctor" class="login-logo" onerror="this.style.display='none'">
          <h1 class="login-title">SynergyHub</h1>
          <p class="login-subtitle">${t('app.loginSubtitle')}</p>
          <div class="login-form">
            <input class="input login-input" type="password" id="login-password" placeholder="${t('app.password')}" autofocus
              onkeydown="if(event.key==='Enter')App.login()">
            <button class="btn btn-primary login-btn" onclick="App.login()">${t('app.login')}</button>
          </div>
          <p class="login-error" id="login-error" style="display:none;"></p>
        </div>
      </div>
    `;
  },

  async login(): Promise<void> {
    const input = document.getElementById('login-password') as HTMLInputElement | null;
    const errorEl = document.getElementById('login-error') as HTMLElement | null;
    const password = input?.value.trim() || '';
    if (!password) { if (input) input.focus(); return; }

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem('synergyhub_auth', 'true');
        window.location.reload();
      } else {
        if (errorEl) { errorEl.textContent = data.error || t('app.wrongPassword'); errorEl.style.display = 'block'; }
        if (input) { input.value = ''; input.focus(); }
      }
    } catch {
      if (errorEl) { errorEl.textContent = t('app.connectionError'); errorEl.style.display = 'block'; }
    }
  },

  logout(): void {
    localStorage.removeItem('synergyhub_auth');
    window.location.reload();
  },
};

// Expose globally for onclick handlers in HTML
(window as any).App = App;

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
