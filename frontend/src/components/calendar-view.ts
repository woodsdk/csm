/* ═══════════════════════════════════════════
   Calendar View — Monthly grid with tasks + Google Calendar events
   ═══════════════════════════════════════════ */

import { TeamAPI } from '../api';
import { GoogleCal } from '../google-calendar';
import { escapeHtml } from '../utils';
import type { Task, TeamMember, GoogleCalendarEvent } from '../types';

export const CalendarView = {
  _currentDate: new Date(),
  _events: [] as GoogleCalendarEvent[],
  _loading: false,

  async render(tasks: Task[]): Promise<string> {
    const year = this._currentDate.getFullYear();
    const month = this._currentDate.getMonth();
    const monthName = this._currentDate.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
    const today = new Date().toISOString().split('T')[0];

    // Fetch Google Calendar events for this month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startStr = this._dateStr(firstDay);
    const endStr = this._dateStr(lastDay);

    if (GoogleCal.isConnected()) {
      this._events = await GoogleCal.getEvents(startStr, endStr);
    } else {
      this._events = [];
    }

    // Build calendar grid
    const days = this._buildDaysGrid(year, month);
    const members: TeamMember[] = await TeamAPI.getAll();

    return `
      <div class="calendar-container">
        <div class="calendar-header">
          <button class="btn btn-ghost btn-sm" onclick="CalendarView.prevMonth()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h3 class="calendar-month-title">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</h3>
          <button class="btn btn-ghost btn-sm" onclick="CalendarView.nextMonth()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="CalendarView.goToday()" style="margin-left: var(--space-2)">I dag</button>
          <div style="flex:1"></div>
          ${this._renderConnectionStatus()}
        </div>

        <div class="calendar-weekdays">
          <div class="calendar-weekday">Man</div>
          <div class="calendar-weekday">Tir</div>
          <div class="calendar-weekday">Ons</div>
          <div class="calendar-weekday">Tor</div>
          <div class="calendar-weekday">Fre</div>
          <div class="calendar-weekday">L\u00f8r</div>
          <div class="calendar-weekday">S\u00f8n</div>
        </div>

        <div class="calendar-grid">
          ${days.map(day => this._renderDay(day, tasks, members, today)).join('')}
        </div>
      </div>
    `;
  },

  _renderConnectionStatus(): string {
    if (!GoogleCal.isConfigured()) {
      return `<button class="btn btn-sm" onclick="CalendarView.openSettings()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Forbind kalender
      </button>`;
    }
    if (!GoogleCal.isConnected()) {
      return `<button class="btn btn-sm" onclick="CalendarView.connectCalendar()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Log ind p\u00e5 kalender
      </button>`;
    }
    return `<span class="calendar-connected">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <span class="text-xs text-secondary">Kalender forbundet</span>
    </span>`;
  },

  _buildDaysGrid(year: number, month: number): Array<{ date: string; day: number; isCurrentMonth: boolean }> {
    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);

    // Monday-based: getDay() returns 0=Sun, we want 0=Mon
    let startDow = firstOfMonth.getDay() - 1;
    if (startDow < 0) startDow = 6;

    // Fill previous month
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: this._dateStr(d), day: d.getDate(), isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= lastOfMonth.getDate(); d++) {
      const dt = new Date(year, month, d);
      days.push({ date: this._dateStr(dt), day: d, isCurrentMonth: true });
    }

    // Fill next month to complete 6 rows
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d);
      days.push({ date: this._dateStr(dt), day: d, isCurrentMonth: false });
    }

    return days;
  },

  _renderDay(day: { date: string; day: number; isCurrentMonth: boolean }, tasks: Task[], members: TeamMember[], today: string): string {
    const isToday = day.date === today;
    const dayTasks = tasks.filter(t => t.deadline === day.date && t.status !== 'done');
    const dayEvents = this._events.filter(e => e.date === day.date);
    const totalItems = dayTasks.length + dayEvents.length;
    const maxVisible = 3;

    return `
      <div class="calendar-day ${day.isCurrentMonth ? '' : 'calendar-day-outside'} ${isToday ? 'calendar-day-today' : ''}">
        <div class="calendar-day-number ${isToday ? 'calendar-day-number-today' : ''}">${day.day}</div>
        <div class="calendar-day-items">
          ${dayEvents.slice(0, maxVisible).map(e => `
            <div class="calendar-event calendar-event-gcal" onclick="event.stopPropagation(); EventModal.open('${e.id}')" title="${escapeHtml(e.title)}">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="var(--navy-500)" stroke="none"><circle cx="12" cy="12" r="10"/></svg>
              <span class="calendar-event-time">${e.isAllDay ? 'Heldag' : this._formatTime(e.start)}</span>
              <span class="calendar-event-title">${escapeHtml(e.title)}</span>
            </div>
          `).join('')}
          ${dayTasks.slice(0, Math.max(0, maxVisible - dayEvents.length)).map(t => {
            const member = members.find(m => m.id === t.assignee_id);
            return `
              <div class="calendar-event calendar-event-task" onclick="event.stopPropagation(); TaskModal.open('${t.id}')" title="${escapeHtml(t.title)}">
                <span class="priority-dot priority-dot-${t.priority}" style="width:6px;height:6px"></span>
                <span class="calendar-event-title">${escapeHtml(t.title)}</span>
                ${member ? `<span class="avatar" style="background:${member.avatar_color};width:16px;height:16px;font-size:8px">${member.name[0]}</span>` : ''}
              </div>
            `;
          }).join('')}
          ${totalItems > maxVisible ? `<div class="calendar-event-more">+${totalItems - maxVisible} mere</div>` : ''}
        </div>
      </div>
    `;
  },

  // ── Navigation ──

  prevMonth(): void {
    this._currentDate.setMonth(this._currentDate.getMonth() - 1);
    (window as any).App.render();
  },

  nextMonth(): void {
    this._currentDate.setMonth(this._currentDate.getMonth() + 1);
    (window as any).App.render();
  },

  goToday(): void {
    this._currentDate = new Date();
    (window as any).App.render();
  },

  // ── Google Calendar actions ──

  openSettings(): void {
    (window as any).CalendarSettings.open();
  },

  async connectCalendar(): Promise<void> {
    const success = await GoogleCal.connect();
    if (success) (window as any).App.render();
  },

  // ── Helpers ──

  _dateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  _formatTime(isoStr: string): string {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  }
};

(window as any).CalendarView = CalendarView;
