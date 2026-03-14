/* ═══════════════════════════════════════════
   Shift Schedule — Vagtplan ugeoversigt
   4-ugers visning + lytter-funktion
   ═══════════════════════════════════════════ */

import { ShiftAPI, TeamAPI } from '../api';
import { escapeHtml } from '../utils';
import type { Shift, ShiftSlot, TeamMember } from '../types';

const SLOTS: ShiftSlot[] = [
  { start: '08:00', end: '10:00', label: '08\u201310' },
  { start: '10:00', end: '12:00', label: '10\u201312' },
  { start: '12:00', end: '14:00', label: '12\u201314' },
  { start: '14:00', end: '16:00', label: '14\u201316' },
];

const WEEKS_SHOWN = 4;
const DAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre'];
const DAYS_FULL = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export const ShiftSchedule = {
  _weekOffset: 0,
  _pendingShift: null as { date: string; start_time: string; end_time: string } | null,
  _pendingListenerShiftId: null as string | null,
  _teamMembers: [] as TeamMember[],

  /* ── Week date calculation ── */
  _getWeekDates(offset: number): string[] {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() || 7) + 1 + offset * 7);

    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  },

  _getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  },

  /* ── Main render: 4 stacked weeks ── */
  async render(): Promise<string> {
    // Compute all 4 weeks' dates
    const allWeeks: string[][] = [];
    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    for (let w = 0; w < WEEKS_SHOWN; w++) {
      // If it's weekend and offset=0, start from next week
      const weekIdx = (isWeekend && this._weekOffset === 0) ? w + 1 : this._weekOffset + w;
      allWeeks.push(this._getWeekDates(weekIdx));
    }

    const firstDate = allWeeks[0][0];
    const lastDate = allWeeks[WEEKS_SHOWN - 1][4];

    // Fetch all shifts for the 4-week range in one call
    let shifts: Shift[] = [];
    try {
      shifts = await ShiftAPI.getByDateRange(firstDate, lastDate);
    } catch {
      // render empty
    }

    // Load team members for avatar colors
    if (this._teamMembers.length === 0) {
      try {
        this._teamMembers = await TeamAPI.getAll();
      } catch {
        // Continue without colors
      }
    }

    const colorMap = new Map<string, string>();
    this._teamMembers.forEach(m => colorMap.set(m.name, m.avatar_color));

    const today = new Date().toISOString().split('T')[0];

    // Stats across all 4 weeks
    const totalSlots = WEEKS_SHOWN * 20;
    const filledSlots = shifts.length;
    const fillPercent = Math.round((filledSlots / totalSlots) * 100);

    // Overall date range title
    const d0 = new Date(firstDate + 'T12:00:00');
    const dLast = new Date(lastDate + 'T12:00:00');
    const rangeTitle = `${d0.getDate()}. ${MONTHS[d0.getMonth()]} \u2013 ${dLast.getDate()}. ${MONTHS[dLast.getMonth()]} ${dLast.getFullYear()}`;

    // Build each week section
    let weeksHTML = '<div class="vp-weeks">';
    for (let w = 0; w < WEEKS_SHOWN; w++) {
      const weekDates = allWeeks[w];
      const wd0 = new Date(weekDates[0] + 'T12:00:00');
      const wd4 = new Date(weekDates[4] + 'T12:00:00');
      const weekNum = this._getWeekNumber(wd0);
      const isCurrent = weekDates.includes(today);
      const weekShifts = shifts.filter(s => s.date >= weekDates[0] && s.date <= weekDates[4]);
      const weekFilled = weekShifts.length;

      weeksHTML += `
        <div class="vp-week-section ${isCurrent ? 'vp-week-current' : ''}">
          <div class="vp-week-section-header">
            <span class="vp-week-badge">
              Uge ${weekNum}
              ${isCurrent ? '<span class="vp-current-tag">Indev\u00e6rende</span>' : ''}
            </span>
            <span class="vp-week-dates">${wd0.getDate()}. ${MONTHS[wd0.getMonth()]} \u2013 ${wd4.getDate()}. ${MONTHS[wd4.getMonth()]}</span>
            <span class="vp-week-fill">${weekFilled}/20</span>
          </div>
          ${this._renderWeekGrid(weekDates, weekShifts, today, colorMap)}
          ${this._renderWeekMobile(weekDates, weekShifts, today, colorMap, weekNum, isCurrent)}
        </div>`;
    }
    weeksHTML += '</div>';

    return `
      <div class="vp-header">
        <div class="vp-header-left">
          <h2 class="vp-title">${rangeTitle}</h2>
        </div>
        <div class="vp-header-right">
          <div class="vp-stats">
            <div class="vp-stat-bar">
              <div class="vp-stat-fill" style="width: ${fillPercent}%"></div>
            </div>
            <span class="vp-stat-text">${filledSlots}/${totalSlots} vagter besat</span>
          </div>
        </div>
      </div>
      ${weeksHTML}
    `;
  },

  /* ── Render a single week grid (desktop) ── */
  _renderWeekGrid(dates: string[], shifts: Shift[], today: string, colorMap: Map<string, string>): string {
    let html = '<div class="vp-grid">';

    // Header row
    html += '<div class="vp-corner"><span class="vp-corner-label">Tid</span></div>';
    dates.forEach((date, i) => {
      const d = new Date(date + 'T12:00:00');
      const isToday = date === today;
      html += `<div class="vp-day-header ${isToday ? 'vp-today' : ''}">
        <span class="vp-day-name">${DAYS_SHORT[i]}</span>
        <span class="vp-day-date ${isToday ? 'vp-today-badge' : ''}">${d.getDate()}</span>
      </div>`;
    });

    // Slot rows
    SLOTS.forEach(slot => {
      html += `<div class="vp-time">${slot.label}</div>`;

      dates.forEach(date => {
        const isPast = date < today;
        const isToday = date === today;
        const shift = shifts.find(s => s.date === date && s.start_time === slot.start);

        html += `<div class="vp-cell ${isPast ? 'vp-past' : ''} ${isToday ? 'vp-today-col' : ''}">`;
        if (shift) {
          const initials = getInitials(shift.staff_name);
          const avatarColor = colorMap.get(shift.staff_name) || '#38456D';
          const listeners = shift.listeners || [];

          html += `<div class="vp-booked">
            <div class="vp-booked-avatar" style="background: ${avatarColor}">${initials}</div>
            <div class="vp-booked-name">${escapeHtml(shift.staff_name)}</div>
            ${!isPast ? `<button class="vp-cancel-btn" onclick="event.stopPropagation(); ShiftSchedule.cancelShift('${shift.id}')" title="Afmeld">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>` : ''}`;

          // Listeners
          if (listeners.length > 0) {
            html += '<div class="vp-listeners">';
            listeners.forEach(lis => {
              const lisInitials = getInitials(lis.listener_name);
              const lisColor = colorMap.get(lis.listener_name) || '#5669A4';
              html += `<span class="vp-listener-chip" style="background: ${lisColor}" title="${escapeHtml(lis.listener_name)} (lytter)" onclick="event.stopPropagation(); ShiftSchedule.removeListener('${shift.id}', '${lis.id}', '${escapeHtml(lis.listener_name)}')">${lisInitials}</span>`;
            });
            html += '</div>';
          }

          // Add listener button (only for non-past shifts)
          if (!isPast) {
            html += `<button class="vp-listen-btn" onclick="event.stopPropagation(); ShiftSchedule.openListenerModal('${shift.id}')">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              lyt
            </button>`;
          }

          html += '</div>';
        } else if (!isPast) {
          html += `<button class="vp-open" onclick="ShiftSchedule.openSignup('${date}', '${slot.start}', '${slot.end}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>`;
        }
        html += '</div>';
      });
    });

    html += '</div>';
    return html;
  },

  /* ── Render a single week mobile cards ── */
  _renderWeekMobile(dates: string[], shifts: Shift[], today: string, colorMap: Map<string, string>, weekNum: number, isCurrent: boolean): string {
    let html = '<div class="vp-mobile">';

    dates.forEach((date, i) => {
      const d = new Date(date + 'T12:00:00');
      const isPast = date < today;
      const isToday = date === today;
      const dayShifts = shifts.filter(s => s.date === date);
      const dayFilled = dayShifts.length;

      html += `<div class="vp-card ${isToday ? 'vp-card-today' : ''} ${isPast ? 'vp-card-past' : ''}">
        <div class="vp-card-header">
          <div class="vp-card-day">
            <span class="vp-card-name">${DAYS_FULL[i]}</span>
            <span class="vp-card-date">${d.getDate()}. ${MONTHS[d.getMonth()]}</span>
          </div>
          <span class="vp-card-badge ${dayFilled === 4 ? 'vp-card-badge-full' : ''}">${dayFilled}/4</span>
        </div>
        <div class="vp-card-slots">`;

      SLOTS.forEach(slot => {
        const shift = dayShifts.find(s => s.start_time === slot.start);
        if (shift) {
          const initials = getInitials(shift.staff_name);
          const avatarColor = colorMap.get(shift.staff_name) || '#38456D';
          const listeners = shift.listeners || [];

          html += `<div class="vp-card-slot vp-card-slot-filled">
            <span class="vp-card-slot-time">${slot.label}</span>
            <div class="vp-card-slot-who">
              <span class="vp-card-avatar" style="background: ${avatarColor}">${initials}</span>
              <span class="vp-card-slot-name">${escapeHtml(shift.staff_name)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;margin-left:auto">
              ${listeners.length > 0 ? `<span class="vp-card-listeners">\uD83C\uDFA7 ${listeners.length}</span>` : ''}
              ${!isPast ? `<button class="vp-card-listen-btn" onclick="event.stopPropagation(); ShiftSchedule.openListenerModal('${shift.id}')">+lyt</button>` : ''}
              ${!isPast ? `<button class="vp-card-cancel" onclick="event.stopPropagation(); ShiftSchedule.cancelShift('${shift.id}')">Afmeld</button>` : ''}
            </div>
          </div>`;
        } else if (!isPast) {
          html += `<button class="vp-card-slot vp-card-slot-open" onclick="ShiftSchedule.openSignup('${date}', '${slot.start}', '${slot.end}')">
            <span class="vp-card-slot-time">${slot.label}</span>
            <span class="vp-card-slot-cta">+ Tag vagt</span>
          </button>`;
        } else {
          html += `<div class="vp-card-slot vp-card-slot-past">
            <span class="vp-card-slot-time">${slot.label}</span>
            <span class="vp-card-slot-empty">\u2014</span>
          </div>`;
        }
      });

      html += '</div></div>';
    });

    html += '</div>';
    return html;
  },

  /* ── Signup modal (take a shift) ── */
  async openSignup(date: string, startTime: string, endTime: string): Promise<void> {
    this._pendingShift = { date, start_time: startTime, end_time: endTime };
    const d = new Date(date + 'T12:00:00');
    const dayNames = ['s\u00f8ndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'l\u00f8rdag'];
    const dayStr = dayNames[d.getDay()];
    const dateStr = `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
    const timeStr = `${startTime.replace(':00', '')}\u2013${endTime.replace(':00', '')}`;

    if (this._teamMembers.length === 0) {
      try { this._teamMembers = await TeamAPI.getAll(); } catch { this._teamMembers = []; }
    }

    const modal = document.getElementById('shift-modal');
    if (!modal) return;

    const staffOptions = this._teamMembers
      .map(m => `<option value="${m.id}" data-name="${escapeHtml(m.name)}" data-email="${escapeHtml(m.email)}">${escapeHtml(m.name)}</option>`)
      .join('');

    modal.innerHTML = `
      <div class="vp-modal" onclick="event.stopPropagation()">
        <div class="vp-modal-header">
          <div>
            <h3>Tag en vagt</h3>
            <p class="vp-modal-sub">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${dayStr} ${dateStr}, kl. ${timeStr}
            </p>
          </div>
          <button class="btn-icon" onclick="ShiftSchedule.closeModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="vp-modal-body">
          <div class="form-group">
            <label class="form-label">Medarbejder <span class="vp-req">*</span></label>
            <select class="input" id="shift-staff">
              <option value="">V\u00e6lg medarbejder...</option>
              ${staffOptions}
            </select>
          </div>
        </div>
        <div class="vp-modal-footer">
          <button class="btn" onclick="ShiftSchedule.closeModal()">Annuller</button>
          <button class="btn btn-primary" id="shift-submit-btn" onclick="ShiftSchedule.submitShift()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Tag vagten
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    requestAnimationFrame(() => {
      const staffSelect = document.getElementById('shift-staff') as HTMLSelectElement | null;
      if (staffSelect) staffSelect.focus();
    });
  },

  /* ── Listener modal ── */
  async openListenerModal(shiftId: string): Promise<void> {
    this._pendingListenerShiftId = shiftId;

    if (this._teamMembers.length === 0) {
      try { this._teamMembers = await TeamAPI.getAll(); } catch { this._teamMembers = []; }
    }

    const modal = document.getElementById('shift-modal');
    if (!modal) return;

    const staffOptions = this._teamMembers
      .map(m => `<option value="${m.id}" data-name="${escapeHtml(m.name)}" data-email="${escapeHtml(m.email)}">${escapeHtml(m.name)}</option>`)
      .join('');

    modal.innerHTML = `
      <div class="vp-modal" onclick="event.stopPropagation()">
        <div class="vp-modal-header">
          <div>
            <h3>Tilmeld som lytter</h3>
            <p class="vp-modal-sub">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
              Du observerer og l\u00e6rer af vagtholderen
            </p>
          </div>
          <button class="btn-icon" onclick="ShiftSchedule.closeModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="vp-modal-body">
          <div class="form-group">
            <label class="form-label">Lytter <span class="vp-req">*</span></label>
            <select class="input" id="shift-staff">
              <option value="">V\u00e6lg medarbejder...</option>
              ${staffOptions}
            </select>
          </div>
        </div>
        <div class="vp-modal-footer">
          <button class="btn" onclick="ShiftSchedule.closeModal()">Annuller</button>
          <button class="btn btn-primary" id="shift-submit-btn" onclick="ShiftSchedule.submitListener()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
            Tilmeld som lytter
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    requestAnimationFrame(() => {
      const staffSelect = document.getElementById('shift-staff') as HTMLSelectElement | null;
      if (staffSelect) staffSelect.focus();
    });
  },

  onStaffSelect(): void {
    // Kept for backward compatibility — no-op since email field removed
  },

  closeModal(): void {
    const modal = document.getElementById('shift-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.innerHTML = '';
    }
    this._pendingShift = null;
    this._pendingListenerShiftId = null;
  },

  async submitShift(): Promise<void> {
    const staffEl = document.getElementById('shift-staff') as HTMLSelectElement | null;
    const btn = document.getElementById('shift-submit-btn') as HTMLButtonElement | null;

    if (!staffEl) return;

    const staffId = staffEl.value;
    if (!staffId) { staffEl.style.borderColor = 'var(--error)'; staffEl.focus(); return; }
    if (!this._pendingShift) return;

    const selectedOption = staffEl.options[staffEl.selectedIndex];
    const name = selectedOption.getAttribute('data-name') || '';
    const email = selectedOption.getAttribute('data-email') || '';

    if (btn) { btn.innerHTML = '<span class="vp-spinner"></span> Booker...'; btn.disabled = true; }

    try {
      await ShiftAPI.create({
        date: this._pendingShift.date,
        start_time: this._pendingShift.start_time,
        end_time: this._pendingShift.end_time,
        staff_name: name,
        staff_email: email,
      });
      this.closeModal();
      (window as any).App.render();
    } catch (err: any) {
      if (btn) { btn.innerHTML = 'Tag vagten'; btn.disabled = false; }
      (window as any).App.toast(err.message || 'Kunne ikke booke vagten', 'error');
    }
  },

  async submitListener(): Promise<void> {
    const staffEl = document.getElementById('shift-staff') as HTMLSelectElement | null;
    const btn = document.getElementById('shift-submit-btn') as HTMLButtonElement | null;

    if (!staffEl) return;

    const staffId = staffEl.value;
    if (!staffId) { staffEl.style.borderColor = 'var(--error)'; staffEl.focus(); return; }
    if (!this._pendingListenerShiftId) return;

    const selectedOption = staffEl.options[staffEl.selectedIndex];
    const name = selectedOption.getAttribute('data-name') || '';
    const email = selectedOption.getAttribute('data-email') || '';

    if (btn) { btn.innerHTML = '<span class="vp-spinner"></span> Tilmelder...'; btn.disabled = true; }

    try {
      await ShiftAPI.addListener(this._pendingListenerShiftId, {
        listener_name: name,
        listener_email: email,
      });
      this.closeModal();
      (window as any).App.toast(`${name} tilmeldt som lytter`, 'success');
      (window as any).App.render();
    } catch (err: any) {
      if (btn) { btn.innerHTML = 'Tilmeld som lytter'; btn.disabled = false; }
      (window as any).App.toast(err.message || 'Kunne ikke tilmelde lytter', 'error');
    }
  },

  async cancelShift(shiftId: string): Promise<void> {
    if (!confirm('Er du sikker p\u00e5 du vil afmelde denne vagt?')) return;
    try {
      await ShiftAPI.cancel(shiftId);
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke afmelde vagten', 'error');
    }
  },

  async removeListener(shiftId: string, listenerId: string, listenerName: string): Promise<void> {
    if (!confirm(`Fjern ${listenerName} som lytter?`)) return;
    try {
      await ShiftAPI.removeListener(shiftId, listenerId);
      (window as any).App.toast(`${listenerName} fjernet som lytter`, 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke fjerne lytter', 'error');
    }
  },

  /* ── Navigation (4-week blocks) ── */
  prevBlock(): void {
    this._weekOffset -= WEEKS_SHOWN;
    (window as any).App.render();
  },

  nextBlock(): void {
    this._weekOffset += WEEKS_SHOWN;
    (window as any).App.render();
  },

  thisBlock(): void {
    this._weekOffset = 0;
    (window as any).App.render();
  },

  // Keep old names as aliases for backward compatibility
  prevWeek(): void { this.prevBlock(); },
  nextWeek(): void { this.nextBlock(); },
  thisWeek(): void { this.thisBlock(); },
};

// Expose globally for onclick handlers
(window as any).ShiftSchedule = ShiftSchedule;
