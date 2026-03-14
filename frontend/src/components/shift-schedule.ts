/* ═══════════════════════════════════════════
   Shift Schedule — Vagtplan ugeoversigt
   ═══════════════════════════════════════════ */

import { ShiftAPI } from '../api';
import { escapeHtml } from '../utils';
import type { Shift, ShiftSlot } from '../types';

const SLOTS: ShiftSlot[] = [
  { start: '08:00', end: '10:00', label: '08-10' },
  { start: '10:00', end: '12:00', label: '10-12' },
  { start: '12:00', end: '14:00', label: '12-14' },
  { start: '14:00', end: '16:00', label: '14-16' },
];

const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export const ShiftSchedule = {
  _weekOffset: 0,
  _pendingShift: null as { date: string; start_time: string; end_time: string } | null,

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

  /* ── Main render ── */
  async render(): Promise<string> {
    const dates = this._getWeekDates(this._weekOffset);
    let shifts: Shift[] = [];
    try {
      shifts = await ShiftAPI.getByDateRange(dates[0], dates[4]);
    } catch {
      // If API fails, render empty grid
    }

    const today = new Date().toISOString().split('T')[0];

    // Week title
    const d0 = new Date(dates[0] + 'T12:00:00');
    const d4 = new Date(dates[4] + 'T12:00:00');
    const weekTitle = `${d0.getDate()}. ${MONTHS[d0.getMonth()]} – ${d4.getDate()}. ${MONTHS[d4.getMonth()]} ${d4.getFullYear()}`;

    // Build grid
    let gridHTML = '<div class="week-grid">';

    // Header row: corner + 5 day headers
    gridHTML += '<div class="week-header"></div>';
    dates.forEach((date, i) => {
      const d = new Date(date + 'T12:00:00');
      gridHTML += `<div class="week-header">${DAYS[i]}<div class="date">${d.getDate()}/${d.getMonth() + 1}</div></div>`;
    });

    // Slot rows
    SLOTS.forEach(slot => {
      gridHTML += `<div class="time-label">${slot.label}</div>`;

      dates.forEach(date => {
        const isPast = date < today;
        const shift = shifts.find(s => s.date === date && s.start_time === slot.start);

        gridHTML += `<div class="shift-cell ${isPast ? 'past' : ''}">`;
        if (shift) {
          gridHTML += `<div class="shift-filled">
            <div class="name">${escapeHtml(shift.staff_name)}</div>
            ${!isPast ? `<button class="cancel" onclick="event.stopPropagation(); ShiftSchedule.cancelShift('${shift.id}')">Afmeld</button>` : ''}
          </div>`;
        } else if (!isPast) {
          gridHTML += `<button class="shift-empty" onclick="ShiftSchedule.openSignup('${date}', '${slot.start}', '${slot.end}')">+ Tag vagt</button>`;
        }
        gridHTML += '</div>';
      });
    });

    gridHTML += '</div>';

    return `
      <div class="shift-nav">
        <h2>${weekTitle}</h2>
        <div class="shift-nav-btns">
          <button onclick="ShiftSchedule.prevWeek()" title="Forrige uge">&#8249;</button>
          <button onclick="ShiftSchedule.thisWeek()">I dag</button>
          <button onclick="ShiftSchedule.nextWeek()" title="Næste uge">&#8250;</button>
        </div>
      </div>
      ${gridHTML}
      <div class="shift-legend">
        <div class="shift-legend-item">
          <div class="shift-legend-dot" style="border: 2px dashed var(--border);"></div>
          <span>Ledig vagt</span>
        </div>
        <div class="shift-legend-item">
          <div class="shift-legend-dot" style="background: var(--success-bg, #F0FDF4); border: 1px solid #BBF7D0;"></div>
          <span>Besat vagt</span>
        </div>
      </div>
    `;
  },

  /* ── Signup modal ── */
  openSignup(date: string, startTime: string, endTime: string): void {
    this._pendingShift = { date, start_time: startTime, end_time: endTime };
    const d = new Date(date + 'T12:00:00');
    const days = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
    const subtitle = `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} kl. ${startTime.replace(':00', '')}-${endTime.replace(':00', '')}`;

    const modal = document.getElementById('shift-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="shift-modal-panel" onclick="event.stopPropagation()">
        <h3>Tag en vagt</h3>
        <p class="shift-modal-subtitle">${subtitle}</p>
        <div class="shift-form-group">
          <label>Navn <span class="shift-required">*</span></label>
          <input type="text" id="shift-name" placeholder="Dit fulde navn">
        </div>
        <div class="shift-form-group">
          <label>Email <span class="shift-required">*</span></label>
          <input type="email" id="shift-email" placeholder="din@email.dk">
        </div>
        <div class="shift-form-group">
          <label>Telefon</label>
          <input type="tel" id="shift-phone" placeholder="+45 ...">
        </div>
        <div class="shift-btn-row">
          <button class="btn btn-secondary" onclick="ShiftSchedule.closeModal()">Annuller</button>
          <button class="btn btn-primary" id="shift-submit-btn" onclick="ShiftSchedule.submitShift()">Tag vagten</button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    requestAnimationFrame(() => {
      const nameInput = document.getElementById('shift-name') as HTMLInputElement | null;
      if (nameInput) nameInput.focus();
    });
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
    const nameEl = document.getElementById('shift-name') as HTMLInputElement | null;
    const emailEl = document.getElementById('shift-email') as HTMLInputElement | null;
    const phoneEl = document.getElementById('shift-phone') as HTMLInputElement | null;
    const btn = document.getElementById('shift-submit-btn') as HTMLButtonElement | null;

    if (!nameEl || !emailEl) return;

    const name = nameEl.value.trim();
    const email = emailEl.value.trim();

    if (!name) { nameEl.style.borderColor = '#EF4444'; nameEl.focus(); return; }
    if (!email) { emailEl.style.borderColor = '#EF4444'; emailEl.focus(); return; }
    if (!this._pendingShift) return;

    if (btn) { btn.textContent = 'Booker...'; btn.disabled = true; }

    try {
      await ShiftAPI.create({
        date: this._pendingShift.date,
        start_time: this._pendingShift.start_time,
        end_time: this._pendingShift.end_time,
        staff_name: name,
        staff_email: email,
        staff_phone: phoneEl?.value.trim() || '',
      });
      this.closeModal();
      (window as any).App.render();
    } catch (err: any) {
      if (btn) { btn.textContent = 'Tag vagten'; btn.disabled = false; }
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
