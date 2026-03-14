/* ═══════════════════════════════════════════
   Shift Schedule — Vagtplan ugeoversigt
   ═══════════════════════════════════════════ */

import { ShiftAPI, TeamAPI } from '../api';
import { escapeHtml } from '../utils';
import type { Shift, ShiftSlot, TeamMember } from '../types';

const SLOTS: ShiftSlot[] = [
  { start: '08:00', end: '10:00', label: '08–10' },
  { start: '10:00', end: '12:00', label: '10–12' },
  { start: '12:00', end: '14:00', label: '12–14' },
  { start: '14:00', end: '16:00', label: '14–16' },
];

const DAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre'];
const DAYS_FULL = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export const ShiftSchedule = {
  _weekOffset: 0,
  _pendingShift: null as { date: string; start_time: string; end_time: string } | null,
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

  /* ── Main render ── */
  async render(): Promise<string> {
    const dates = this._getWeekDates(this._weekOffset);
    let shifts: Shift[] = [];
    try {
      shifts = await ShiftAPI.getByDateRange(dates[0], dates[4]);
    } catch {
      // If API fails, render empty grid
    }

    // Load team members for avatar colors
    if (this._teamMembers.length === 0) {
      try {
        this._teamMembers = await TeamAPI.getAll();
      } catch {
        // Continue without colors
      }
    }

    // Build a name → color lookup
    const colorMap = new Map<string, string>();
    this._teamMembers.forEach(m => colorMap.set(m.name, m.avatar_color));

    const today = new Date().toISOString().split('T')[0];
    const d0 = new Date(dates[0] + 'T12:00:00');
    const d4 = new Date(dates[4] + 'T12:00:00');
    const weekNum = this._getWeekNumber(d0);
    const weekTitle = `${d0.getDate()}. ${MONTHS[d0.getMonth()]} – ${d4.getDate()}. ${MONTHS[d4.getMonth()]} ${d4.getFullYear()}`;

    // Stats
    const totalSlots = 20; // 5 days × 4 slots
    const filledSlots = shifts.length;
    const fillPercent = Math.round((filledSlots / totalSlots) * 100);

    // Build desktop grid
    let gridHTML = '<div class="vp-grid">';

    // Header row
    gridHTML += '<div class="vp-corner"><span class="vp-corner-label">Tid</span></div>';
    dates.forEach((date, i) => {
      const d = new Date(date + 'T12:00:00');
      const isToday = date === today;
      gridHTML += `<div class="vp-day-header ${isToday ? 'vp-today' : ''}">
        <span class="vp-day-name">${DAYS_SHORT[i]}</span>
        <span class="vp-day-date ${isToday ? 'vp-today-badge' : ''}">${d.getDate()}</span>
      </div>`;
    });

    // Slot rows
    SLOTS.forEach(slot => {
      gridHTML += `<div class="vp-time">${slot.label}</div>`;

      dates.forEach(date => {
        const isPast = date < today;
        const isToday = date === today;
        const shift = shifts.find(s => s.date === date && s.start_time === slot.start);

        gridHTML += `<div class="vp-cell ${isPast ? 'vp-past' : ''} ${isToday ? 'vp-today-col' : ''}">`;
        if (shift) {
          const initials = getInitials(shift.staff_name);
          const avatarColor = colorMap.get(shift.staff_name) || '#38456D';
          gridHTML += `<div class="vp-booked">
            <div class="vp-booked-avatar" style="background: ${avatarColor}">${initials}</div>
            <div class="vp-booked-name">${escapeHtml(shift.staff_name)}</div>
            ${!isPast ? `<button class="vp-cancel-btn" onclick="event.stopPropagation(); ShiftSchedule.cancelShift('${shift.id}')" title="Afmeld">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>` : ''}
          </div>`;
        } else if (!isPast) {
          gridHTML += `<button class="vp-open" onclick="ShiftSchedule.openSignup('${date}', '${slot.start}', '${slot.end}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>`;
        }
        gridHTML += '</div>';
      });
    });
    gridHTML += '</div>';

    // Build mobile cards
    let mobileHTML = '<div class="vp-mobile">';
    dates.forEach((date, i) => {
      const d = new Date(date + 'T12:00:00');
      const isPast = date < today;
      const isToday = date === today;
      const dayShifts = shifts.filter(s => s.date === date);
      const dayFilled = dayShifts.length;

      mobileHTML += `<div class="vp-card ${isToday ? 'vp-card-today' : ''} ${isPast ? 'vp-card-past' : ''}">
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
          mobileHTML += `<div class="vp-card-slot vp-card-slot-filled">
            <span class="vp-card-slot-time">${slot.label}</span>
            <div class="vp-card-slot-who">
              <span class="vp-card-avatar" style="background: ${avatarColor}">${initials}</span>
              <span class="vp-card-slot-name">${escapeHtml(shift.staff_name)}</span>
            </div>
            ${!isPast ? `<button class="vp-card-cancel" onclick="event.stopPropagation(); ShiftSchedule.cancelShift('${shift.id}')">Afmeld</button>` : ''}
          </div>`;
        } else if (!isPast) {
          mobileHTML += `<button class="vp-card-slot vp-card-slot-open" onclick="ShiftSchedule.openSignup('${date}', '${slot.start}', '${slot.end}')">
            <span class="vp-card-slot-time">${slot.label}</span>
            <span class="vp-card-slot-cta">+ Tag vagt</span>
          </button>`;
        } else {
          mobileHTML += `<div class="vp-card-slot vp-card-slot-past">
            <span class="vp-card-slot-time">${slot.label}</span>
            <span class="vp-card-slot-empty">—</span>
          </div>`;
        }
      });

      mobileHTML += '</div></div>';
    });
    mobileHTML += '</div>';

    return `
      <div class="vp-header">
        <div class="vp-header-left">
          <span class="vp-week-badge">Uge ${weekNum}</span>
          <h2 class="vp-title">${weekTitle}</h2>
        </div>
        <div class="vp-header-right">
          <div class="vp-stats">
            <div class="vp-stat-bar">
              <div class="vp-stat-fill" style="width: ${fillPercent}%"></div>
            </div>
            <span class="vp-stat-text">${filledSlots}/${totalSlots} vagter besat</span>
          </div>
          <div class="vp-nav">
            <button class="vp-nav-btn" onclick="ShiftSchedule.prevWeek()" title="Forrige uge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button class="vp-nav-today" onclick="ShiftSchedule.thisWeek()">I dag</button>
            <button class="vp-nav-btn" onclick="ShiftSchedule.nextWeek()" title="Næste uge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>
      ${gridHTML}
      ${mobileHTML}
    `;
  },

  /* ── Signup modal ── */
  async openSignup(date: string, startTime: string, endTime: string): Promise<void> {
    this._pendingShift = { date, start_time: startTime, end_time: endTime };
    const d = new Date(date + 'T12:00:00');
    const dayNames = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
    const dayStr = dayNames[d.getDay()];
    const dateStr = `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
    const timeStr = `${startTime.replace(':00', '')}–${endTime.replace(':00', '')}`;

    // Fetch team members if not already cached
    if (this._teamMembers.length === 0) {
      try {
        this._teamMembers = await TeamAPI.getAll();
      } catch {
        this._teamMembers = [];
      }
    }

    const modal = document.getElementById('shift-modal');
    if (!modal) return;

    const staffOptions = this._teamMembers
      .map(m => `<option value="${m.id}" data-name="${escapeHtml(m.name)}" data-email="${escapeHtml(m.email)}" data-phone="${escapeHtml(m.phone)}">${escapeHtml(m.name)}</option>`)
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
            <select class="input" id="shift-staff" onchange="ShiftSchedule.onStaffSelect()">
              <option value="">Vælg medarbejder...</option>
              ${staffOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="input" type="email" id="shift-email" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Telefon</label>
            <input class="input" type="tel" id="shift-phone" readonly>
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

  onStaffSelect(): void {
    const select = document.getElementById('shift-staff') as HTMLSelectElement | null;
    const emailEl = document.getElementById('shift-email') as HTMLInputElement | null;
    const phoneEl = document.getElementById('shift-phone') as HTMLInputElement | null;
    if (!select) return;

    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.value) {
      if (emailEl) emailEl.value = selectedOption.getAttribute('data-email') || '';
      if (phoneEl) phoneEl.value = selectedOption.getAttribute('data-phone') || '';
    } else {
      if (emailEl) emailEl.value = '';
      if (phoneEl) phoneEl.value = '';
    }
  },

  closeModal(): void {
    const modal = document.getElementById('shift-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.innerHTML = '';
    }
    this._pendingShift = null;
  },

  async submitShift(): Promise<void> {
    const staffEl = document.getElementById('shift-staff') as HTMLSelectElement | null;
    const emailEl = document.getElementById('shift-email') as HTMLInputElement | null;
    const phoneEl = document.getElementById('shift-phone') as HTMLInputElement | null;
    const btn = document.getElementById('shift-submit-btn') as HTMLButtonElement | null;

    if (!staffEl) return;

    const staffId = staffEl.value;
    if (!staffId) { staffEl.style.borderColor = 'var(--error)'; staffEl.focus(); return; }
    if (!this._pendingShift) return;

    const selectedOption = staffEl.options[staffEl.selectedIndex];
    const name = selectedOption.getAttribute('data-name') || '';
    const email = selectedOption.getAttribute('data-email') || '';
    const phone = selectedOption.getAttribute('data-phone') || '';

    if (btn) { btn.innerHTML = '<span class="vp-spinner"></span> Booker...'; btn.disabled = true; }

    try {
      await ShiftAPI.create({
        date: this._pendingShift.date,
        start_time: this._pendingShift.start_time,
        end_time: this._pendingShift.end_time,
        staff_name: name,
        staff_email: email,
        staff_phone: phone,
      });
      this.closeModal();
      (window as any).App.render();
    } catch (err: any) {
      if (btn) { btn.innerHTML = 'Tag vagten'; btn.disabled = false; }
      (window as any).App.toast(err.message || 'Kunne ikke booke vagten', 'error');
    }
  },

  async cancelShift(shiftId: string): Promise<void> {
    if (!confirm('Er du sikker på du vil afmelde denne vagt?')) return;
    try {
      await ShiftAPI.cancel(shiftId);
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke afmelde vagten', 'error');
    }
  },

  /* ── Navigation ── */
  prevWeek(): void {
    this._weekOffset--;
    (window as any).App.render();
  },

  nextWeek(): void {
    this._weekOffset++;
    (window as any).App.render();
  },

  thisWeek(): void {
    this._weekOffset = 0;
    (window as any).App.render();
  },
};

// Expose globally for onclick handlers
(window as any).ShiftSchedule = ShiftSchedule;
