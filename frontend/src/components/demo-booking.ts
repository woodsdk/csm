/* ═══════════════════════════════════════════
   Demo Booking — Public booking wizard
   ═══════════════════════════════════════════ */

import { DemoAPI } from '../api';
import type { DemoBooking as DemoBookingType, DemoSlot } from '../types';

const DAY_NAMES = ['S\u00f8ndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'L\u00f8rdag'];
const DAY_SHORT = ['s\u00f8n', 'man', 'tir', 'ons', 'tor', 'fre', 'l\u00f8r'];
const MONTH_NAMES = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];

export const DemoBooking = {
  _state: {
    step: 0 as 0 | 1 | 2 | 3 | 4 | 5,
    colleagues: [] as { name: string; role: string; email: string }[],
    availableDates: [] as string[],
    availableSlots: [] as DemoSlot[],
    selectedDate: null as string | null,
    selectedSlot: null as string | null,
    currentWeekIdx: 0,
    form: { name: '', email: '', phone: '', clinic: '', role: '', notes: '' },
    booking: null as DemoBookingType | null,
    loading: false,
    error: null as string | null,
  },

  async render(): Promise<string> {
    // Fetch available dates for landing or step 1
    if (this._state.availableDates.length === 0 && (this._state.step === 0 || this._state.step === 1)) {
      try {
        this._state.availableDates = await DemoAPI.getAvailableDates();
      } catch {
        this._state.error = 'Kunne ikke hente ledige datoer. Pr\u00f8v igen senere.';
      }
    }

    // Landing page with inline booking
    if (this._state.step === 0) {
      return this._renderLanding();
    }

    return `
      <div class="db-page">
        <div class="db-container">
          ${this._renderHeader()}
          ${this._renderSteps()}
          <div class="db-body">
            ${this._state.error ? `<div class="db-error">${this._state.error}</div>` : ''}
            ${this._state.loading ? '<div class="db-loading">Indl\u00e6ser...</div>' : ''}
            ${!this._state.loading ? this._renderStep() : ''}
          </div>
        </div>
      </div>
    `;
  },

  // ─── Landing Page ─────────────────────────────

  _renderLanding(): string {
    return `
      <div class="db-page db-page-landing">
        <div class="db-landing-wrapper">
          <img src="/assets/peoples-clinic.svg" alt="People's Clinic" class="db-landing-logo-img">

          <div class="db-landing-cards">
            <div class="db-landing-card">
              <h2 class="db-landing-title">Pr\u00f8v platformen selv</h2>
              <ul class="db-landing-features">
                <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38456D" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Gratis for alle</li>
                <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38456D" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> AI Act Compliant</li>
                <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38456D" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> GDPR Compliant</li>
                <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38456D" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Kom i gang p\u00e5 5 minutter</li>
              </ul>
              <a href="https://clinic.peoplesdoctor.ai/onboarding/start" class="db-btn db-btn-primary db-landing-cta">Lad mig pr\u00f8ve selv</a>
              <div class="db-landing-login">
                <span>Har du allerede en bruger?</span>
                <a href="https://clinic.peoplesdoctor.ai/onboarding/start"><strong>Log ind her</strong></a>
              </div>
            </div>

            <div class="db-landing-card db-landing-card-book">
              <h2 class="db-landing-title">Book personlig demo</h2>
              <p class="db-landing-subtitle">Vi gennemg\u00e5r platformen med dig p\u00e5 video. Ca. 30 min. Helt gratis.</p>
              <div class="db-landing-booking-inline">
                ${this._state.loading
                  ? '<div class="db-loading">Indl\u00e6ser ledige tider...</div>'
                  : this._state.availableDates.length > 0
                    ? this._renderInlineDatePicker()
                    : '<div class="db-landing-booking-empty">Ingen ledige tider lige nu.<br><a href="mailto:support@peoplesdoctor.com">Kontakt os</a></div>'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _groupDatesByWeek(): { weekKey: string; weekNum: number; weekStart: Date; weekEnd: Date; dates: string[] }[] {
    const weeks: { weekKey: string; weekNum: number; weekStart: Date; weekEnd: Date; dates: string[] }[] = [];
    const weekMap = new Map<string, number>();

    for (const dateStr of this._state.availableDates) {
      const d = new Date(dateStr + 'T00:00:00');
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weekMap.has(weekKey)) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 4);
        weekMap.set(weekKey, weeks.length);
        weeks.push({ weekKey, weekNum: this._getWeekNumber(weekStart), weekStart: new Date(weekStart), weekEnd, dates: [] });
      }
      weeks[weekMap.get(weekKey)!].dates.push(dateStr);
    }

    // Auto-skip to first week that has available dates in the future
    if (this._state.currentWeekIdx === 0 && weeks.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const firstWeekHasFuture = weeks[0].dates.some(ds => ds > today);
      if (!firstWeekHasFuture && weeks.length > 1) {
        this._state.currentWeekIdx = 1;
      }
    }

    if (this._state.currentWeekIdx >= weeks.length) this._state.currentWeekIdx = weeks.length - 1;
    if (this._state.currentWeekIdx < 0) this._state.currentWeekIdx = 0;

    return weeks;
  },

  _renderInlineDatePicker(): string {
    const weeks = this._groupDatesByWeek();
    if (weeks.length === 0) return '';

    // Show 2 weeks at a time
    const startIdx = this._state.currentWeekIdx;
    const endIdx = Math.min(startIdx + 2, weeks.length);
    const visibleWeeks = weeks.slice(startIdx, endIdx);
    const isFirst = startIdx === 0;
    const isLast = endIdx >= weeks.length;

    return `
      <div class="db-week-nav">
        <button class="db-week-arrow ${isFirst ? 'disabled' : ''}" onclick="event.stopPropagation(); DemoBooking.prevWeek()" ${isFirst ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="db-week-label-nav">Uge ${visibleWeeks.map(w => w.weekNum).join(' & ')}</span>
        <button class="db-week-arrow ${isLast ? 'disabled' : ''}" onclick="event.stopPropagation(); DemoBooking.nextWeek()" ${isLast ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      ${visibleWeeks.map(week => {
        const availableSet = new Set(week.dates);
        const weekDays: { dateStr: string; d: Date; available: boolean }[] = [];
        for (let i = 0; i < 5; i++) {
          const day = new Date(week.weekStart);
          day.setDate(week.weekStart.getDate() + i);
          const ds = day.toISOString().split('T')[0];
          weekDays.push({ dateStr: ds, d: day, available: availableSet.has(ds) });
        }
        return `
          <div class="db-dates-row db-dates-row-compact">
            ${weekDays.map(wd => {
              if (!wd.available) {
                return `<div class="db-date-card disabled">
                  <span class="db-date-day">${DAY_SHORT[wd.d.getDay()]}</span>
                  <span class="db-date-num">${wd.d.getDate()}</span>
                  <span class="db-date-month">${MONTH_NAMES[wd.d.getMonth()].slice(0, 3)}</span>
                </div>`;
              }
              return `<button class="db-date-card" onclick="DemoBooking.selectDate('${wd.dateStr}')">
                <span class="db-date-day">${DAY_SHORT[wd.d.getDay()]}</span>
                <span class="db-date-num">${wd.d.getDate()}</span>
                <span class="db-date-month">${MONTH_NAMES[wd.d.getMonth()].slice(0, 3)}</span>
              </button>`;
            }).join('')}
          </div>
        `;
      }).join('')}
    `;
  },

  async startBooking(): Promise<void> {
    // Pre-fetch dates if not already loaded
    if (this._state.availableDates.length === 0) {
      this._state.loading = true;
      this._rerender();
      try {
        this._state.availableDates = await DemoAPI.getAvailableDates();
      } catch {
        this._state.error = 'Kunne ikke hente ledige datoer.';
      }
      this._state.loading = false;
      this._rerender();
    }
  },

  // ─── Booking Wizard ───────────────────────────

  _renderHeader(): string {
    return `
      <div class="db-header">
        <img src="/assets/peoples-clinic.svg" alt="People's Clinic" class="db-logo">
        <h1 class="db-title">Book en personlig demo</h1>
        <p class="db-subtitle">Vi gennemg\u00e5r platformen med dig p\u00e5 video. Det tager ca. 30 minutter og er helt gratis.</p>
      </div>
    `;
  },

  _renderSteps(): string {
    const steps = [
      { num: 1, label: 'Dato' },
      { num: 2, label: 'Tidspunkt' },
      { num: 3, label: 'Oplysninger' },
      { num: 4, label: 'Kollegaer' },
      { num: 5, label: 'Bekr\u00e6ftelse' },
    ];

    return `
      <div class="db-steps">
        ${steps.map(s => `
          <div class="db-step ${this._state.step === s.num ? 'db-step-active' : ''} ${this._state.step > s.num ? 'db-step-done' : ''}">
            <div class="db-step-num">${this._state.step > s.num ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : s.num}</div>
            <span class="db-step-label">${s.label}</span>
          </div>
          ${s.num < 5 ? '<div class="db-step-line"></div>' : ''}
        `).join('')}
      </div>
    `;
  },

  _renderStep(): string {
    switch (this._state.step) {
      case 1: return this._renderDateSelection();
      case 2: return this._renderSlotSelection();
      case 3: return this._renderForm();
      case 4: return this._renderColleagues();
      case 5: return this._renderConfirmation();
      default: return '';
    }
  },

  _renderDateSelection(): string {
    if (this._state.availableDates.length === 0) {
      return `
        <div class="db-empty">
          <p>Der er ingen ledige tider i \u00f8jeblikket. Kontakt os p\u00e5 <a href="mailto:support@peoplesdoctor.com">support@peoplesdoctor.com</a> for at aftale et tidspunkt.</p>
        </div>
      `;
    }

    const weeks = this._groupDatesByWeek();
    if (weeks.length === 0) return '<div class="db-empty"><p>Ingen ledige uger fundet.</p></div>';

    const week = weeks[this._state.currentWeekIdx];
    const availableSet = new Set(week.dates);
    const isFirst = this._state.currentWeekIdx === 0;
    const isLast = this._state.currentWeekIdx === weeks.length - 1;

    // Build all 5 weekdays (Mon-Fri) for display
    const weekDays: { dateStr: string; d: Date; available: boolean }[] = [];
    for (let i = 0; i < 5; i++) {
      const day = new Date(week.weekStart);
      day.setDate(week.weekStart.getDate() + i);
      const ds = day.toISOString().split('T')[0];
      weekDays.push({ dateStr: ds, d: day, available: availableSet.has(ds) });
    }

    const wsLabel = `${week.weekStart.getDate()}. ${MONTH_NAMES[week.weekStart.getMonth()].slice(0, 3)}`;
    const weLabel = `${week.weekEnd.getDate()}. ${MONTH_NAMES[week.weekEnd.getMonth()].slice(0, 3)}`;

    return `
      <div class="db-section">
        <h2 class="db-section-title">V\u00e6lg en dato</h2>

        <div class="db-week-nav">
          <button class="db-week-arrow ${isFirst ? 'disabled' : ''}" onclick="DemoBooking.prevWeek()" ${isFirst ? 'disabled' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="db-week-label-nav">Uge ${week.weekNum} &mdash; ${wsLabel} \u2013 ${weLabel}</span>
          <button class="db-week-arrow ${isLast ? 'disabled' : ''}" onclick="DemoBooking.nextWeek()" ${isLast ? 'disabled' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div class="db-dates-row db-dates-row-compact">
          ${weekDays.map(wd => {
            const isSelected = this._state.selectedDate === wd.dateStr;
            if (!wd.available) {
              return `
                <div class="db-date-card disabled">
                  <span class="db-date-day">${DAY_SHORT[wd.d.getDay()]}</span>
                  <span class="db-date-num">${wd.d.getDate()}</span>
                  <span class="db-date-month">${MONTH_NAMES[wd.d.getMonth()].slice(0, 3)}</span>
                </div>
              `;
            }
            return `
              <button class="db-date-card ${isSelected ? 'selected' : ''}" onclick="DemoBooking.selectDate('${wd.dateStr}')">
                <span class="db-date-day">${DAY_SHORT[wd.d.getDay()]}</span>
                <span class="db-date-num">${wd.d.getDate()}</span>
                <span class="db-date-month">${MONTH_NAMES[wd.d.getMonth()].slice(0, 3)}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  _renderSlotSelection(): string {
    const d = new Date(this._state.selectedDate + 'T00:00:00');
    const dateLabel = `${DAY_NAMES[d.getDay()]} d. ${d.getDate()}. ${MONTH_NAMES[d.getMonth()]}`;

    if (this._state.availableSlots.length === 0) {
      return `
        <div class="db-section">
          <h2 class="db-section-title">V\u00e6lg tidspunkt</h2>
          <p class="db-date-chosen">${dateLabel}</p>
          <div class="db-empty">
            <p>Ingen ledige tider p\u00e5 denne dato. V\u00e6lg en anden dato.</p>
          </div>
          <div class="db-actions">
            <button class="db-btn db-btn-secondary" onclick="DemoBooking.goBack()">\u2190 V\u00e6lg anden dato</button>
          </div>
        </div>
      `;
    }

    // Group into morning (before 12) and afternoon
    const morning = this._state.availableSlots.filter(s => parseInt(s.start_time) < 12);
    const afternoon = this._state.availableSlots.filter(s => parseInt(s.start_time) >= 12);

    return `
      <div class="db-section">
        <h2 class="db-section-title">V\u00e6lg tidspunkt</h2>
        <p class="db-date-chosen">${dateLabel}</p>

        ${morning.length > 0 ? `
          <div class="db-slot-group">
            <span class="db-slot-group-label">Formiddag</span>
            <div class="db-slots">
              ${morning.map(s => `
                <button class="db-slot ${this._state.selectedSlot === s.start_time ? 'selected' : ''}" onclick="DemoBooking.selectSlot('${s.start_time}')">
                  ${s.start_time}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${afternoon.length > 0 ? `
          <div class="db-slot-group">
            <span class="db-slot-group-label">Eftermiddag</span>
            <div class="db-slots">
              ${afternoon.map(s => `
                <button class="db-slot ${this._state.selectedSlot === s.start_time ? 'selected' : ''}" onclick="DemoBooking.selectSlot('${s.start_time}')">
                  ${s.start_time}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="db-actions">
          <button class="db-btn db-btn-secondary" onclick="DemoBooking.goBack()">\u2190 V\u00e6lg anden dato</button>
        </div>
      </div>
    `;
  },

  _renderForm(): string {
    const d = new Date(this._state.selectedDate + 'T00:00:00');
    const dateLabel = `${DAY_NAMES[d.getDay()]} d. ${d.getDate()}. ${MONTH_NAMES[d.getMonth()]}`;
    const f = this._state.form;

    return `
      <div class="db-section">
        <h2 class="db-section-title">Dine oplysninger</h2>
        <div class="db-booking-summary">
          <span class="db-summary-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${dateLabel} kl. ${this._state.selectedSlot}
          </span>
        </div>

        <form class="db-form" onsubmit="event.preventDefault(); DemoBooking.submitBooking();">
          <div class="db-field-row">
            <div class="db-field">
              <label class="db-label" for="db-name">Navn <span class="db-required">*</span></label>
              <input class="db-input" id="db-name" type="text" required placeholder="Dit fulde navn" value="${this._esc(f.name)}" oninput="DemoBooking.setField('name', this.value)">
            </div>
            <div class="db-field">
              <label class="db-label" for="db-role">Rolle/Titel</label>
              <input class="db-input" id="db-role" type="text" placeholder="Fx praktiserende l\u00e6ge" value="${this._esc(f.role)}" oninput="DemoBooking.setField('role', this.value)">
            </div>
          </div>

          <div class="db-field">
            <label class="db-label" for="db-email">Email <span class="db-required">*</span></label>
            <p class="db-field-hint">Vi sender kalenderinvitation hertil</p>
            <input class="db-input" id="db-email" type="email" required placeholder="din@email.dk" value="${this._esc(f.email)}" oninput="DemoBooking.setField('email', this.value)">
          </div>

          <div class="db-field-row">
            <div class="db-field">
              <label class="db-label" for="db-phone">Telefon <span class="db-required">*</span></label>
              <input class="db-input" id="db-phone" type="tel" required placeholder="12 34 56 78" value="${this._esc(f.phone)}" oninput="DemoBooking.setField('phone', this.value)">
            </div>
            <div class="db-field">
              <label class="db-label" for="db-clinic">Klinik/Praksis <span class="db-required">*</span></label>
              <input class="db-input" id="db-clinic" type="text" required placeholder="Kliniknavnet" value="${this._esc(f.clinic)}" oninput="DemoBooking.setField('clinic', this.value)">
            </div>
          </div>

          <div class="db-field">
            <label class="db-label" for="db-notes">Evt. besked</label>
            <textarea class="db-input db-textarea" id="db-notes" rows="3" placeholder="Er der noget s\u00e6rligt du gerne vil se i demoen?" oninput="DemoBooking.setField('notes', this.value)">${this._esc(f.notes)}</textarea>
          </div>

          <div class="db-actions">
            <button type="button" class="db-btn db-btn-secondary" onclick="DemoBooking.goBack()">\u2190 Tilbage</button>
            <button type="submit" class="db-btn db-btn-primary" ${!f.name || !f.email || !f.phone || !f.clinic ? 'disabled' : ''}>Book demo \u2192</button>
          </div>
        </form>
      </div>
    `;
  },

  _renderColleagues(): string {
    const b = this._state.booking;
    if (!b) return '';

    const d = new Date(b.date + 'T00:00:00');
    const dateLabel = `${DAY_NAMES[d.getDay()]} d. ${d.getDate()}. ${MONTH_NAMES[d.getMonth()]}`;

    return `
      <div class="db-section">
        <h2 class="db-section-title">Invit\u00e9r kollegaer</h2>
        <p class="db-section-desc">Har du kollegaer der ogs\u00e5 skal deltage i demoen? Tilf\u00f8j dem herunder \u2014 de modtager en kalenderinvitation automatisk.</p>

        <div class="db-booking-summary">
          <span class="db-summary-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${dateLabel} kl. ${b.start_time}\u2013${b.end_time}
          </span>
        </div>

        <div id="db-colleague-list" class="db-colleague-list">
          ${this._state.colleagues.map((c, i) => `
            <div class="db-colleague-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              <span><strong>${this._esc(c.name)}</strong>${c.role ? ` \u2014 ${this._esc(c.role)}` : ''} (${this._esc(c.email)})</span>
            </div>
          `).join('')}
        </div>

        <div class="db-colleague-form">
          <div class="db-field-row" style="margin-bottom: 0;">
            <div class="db-field" style="margin-bottom: 0;">
              <input class="db-input" id="db-col-name" type="text" placeholder="Navn">
            </div>
            <div class="db-field" style="margin-bottom: 0;">
              <input class="db-input" id="db-col-role" type="text" placeholder="Rolle/stilling">
            </div>
          </div>
          <div class="db-field" style="margin-bottom: 0; margin-top: 8px;">
            <input class="db-input" id="db-col-email" type="email" placeholder="Email">
          </div>
          <button class="db-btn db-btn-secondary db-add-colleague-btn" onclick="DemoBooking.addColleague()" style="margin-top: 10px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tilf\u00f8j kollega
          </button>
        </div>

        <div class="db-actions">
          <button class="db-btn db-btn-secondary" onclick="DemoBooking.skipColleagues()">Spring over \u2192</button>
          <button class="db-btn db-btn-primary" onclick="DemoBooking.confirmWithColleagues()">Bekr\u00e6ft booking \u2192</button>
        </div>
      </div>
    `;
  },

  async addColleague(): Promise<void> {
    const nameEl = document.getElementById('db-col-name') as HTMLInputElement;
    const roleEl = document.getElementById('db-col-role') as HTMLInputElement;
    const emailEl = document.getElementById('db-col-email') as HTMLInputElement;
    if (!nameEl || !emailEl) return;

    const name = nameEl.value.trim();
    const role = roleEl?.value.trim() || '';
    const email = emailEl.value.trim();
    if (!name || !email) return;

    // Save to state
    this._state.colleagues.push({ name, role, email });

    // Send invitation via API
    if (this._state.booking) {
      try {
        await DemoAPI.join(this._state.booking.id, { name, email, role });
      } catch {
        // Still keep in list even if API fails
      }
    }

    this._rerender();
  },

  skipColleagues(): void {
    this._state.step = 5;
    this._rerender();
  },

  async confirmWithColleagues(): Promise<void> {
    this._state.step = 5;
    this._rerender();
  },

  _renderConfirmation(): string {
    const b = this._state.booking;
    if (!b) return '';

    const d = new Date(b.date + 'T00:00:00');
    const dateLabel = `${DAY_NAMES[d.getDay()]} d. ${d.getDate()}. ${MONTH_NAMES[d.getMonth()]}`;
    const hasCalendar = !!b.calendar_event_id;

    return `
      <div class="db-section db-confirm-section">
        <div class="db-confirm-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>

        <h2 class="db-confirm-title">Din demo er booket!</h2>
        <p class="db-confirm-subtitle">${hasCalendar ? 'Du modtager en kalenderinvitation med video-link p\u00e5 email.' : 'Du modtager en bekr\u00e6ftelse p\u00e5 email.'}</p>

        <div class="db-confirm-details">
          <div class="db-confirm-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>${dateLabel} kl. ${b.start_time}\u2013${b.end_time}</span>
          </div>

          <div class="db-confirm-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <span>${this._esc(b.client_email)}</span>
          </div>

          ${b.staff_name ? `
            <div class="db-confirm-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <span>Demo-giver: ${this._esc(b.staff_name)}</span>
            </div>
          ` : ''}

          <div class="db-confirm-row db-confirm-meet">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <a href="${b.meet_link}" target="_blank" rel="noopener">${b.meet_link}</a>
          </div>
        </div>

        <div class="db-confirm-actions">
          <button class="db-btn db-btn-primary" onclick="DemoBooking.copyMeetLink()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Kopi\u00e9r video-link
          </button>
          <a href="https://peoplesclinic.dk" class="db-btn db-btn-secondary">Tilbage til People's Clinic</a>
        </div>

        ${this._state.colleagues.length > 0 ? `
          <div class="db-confirm-colleagues">
            <p class="db-confirm-colleagues-label">Inviterede kollegaer:</p>
            ${this._state.colleagues.map(c => `
              <span class="db-confirm-colleague-tag">${this._esc(c.name)}${c.role ? ` (${this._esc(c.role)})` : ''}</span>
            `).join('')}
          </div>
        ` : ''}

        <p class="db-confirm-note">${hasCalendar ? 'Tjek din email for kalenderinvitationen med video-linket.' : 'Brug video-linket ovenfor for at deltage i demoen p\u00e5 det aftalte tidspunkt.'}</p>
      </div>
    `;
  },

  // ─── Actions ────────────────────────────────

  prevWeek(): void {
    if (this._state.currentWeekIdx > 0) {
      this._state.currentWeekIdx--;
      this._rerender();
    }
  },

  nextWeek(): void {
    this._state.currentWeekIdx++;
    this._rerender();
  },

  async selectDate(date: string): Promise<void> {
    this._state.selectedDate = date;
    this._state.selectedSlot = null;
    this._state.loading = true;
    this._state.error = null;
    this._rerender();

    try {
      this._state.availableSlots = await DemoAPI.getAvailableSlots(date);
      this._state.step = 2;
    } catch {
      this._state.error = 'Kunne ikke hente ledige tider.';
    }
    this._state.loading = false;
    this._rerender();
  },

  selectSlot(time: string): void {
    this._state.selectedSlot = time;
    this._state.step = 3;
    this._state.error = null;
    this._rerender();
  },

  goBack(): void {
    this._state.error = null;
    if (this._state.step === 2) {
      // From slot selection → back to landing (date picker is inline)
      this._state.step = 0;
      this._state.selectedSlot = null;
    } else if (this._state.step === 3) {
      // From form → back to slot selection
      this._state.step = 2;
    } else if (this._state.step === 1) {
      this._state.step = 0;
      this._state.selectedSlot = null;
    }
    this._rerender();
  },

  setField(field: string, value: string): void {
    (this._state.form as any)[field] = value;
    // Update submit button state
    const btn = document.querySelector('.db-btn-primary[type="submit"]') as HTMLButtonElement;
    if (btn) {
      btn.disabled = !this._state.form.name || !this._state.form.email || !this._state.form.phone || !this._state.form.clinic;
    }
  },

  async submitBooking(): Promise<void> {
    const f = this._state.form;
    if (!f.name || !f.email || !f.phone || !f.clinic || !this._state.selectedDate || !this._state.selectedSlot) return;

    this._state.loading = true;
    this._state.error = null;
    this._rerender();

    try {
      const booking = await DemoAPI.book({
        date: this._state.selectedDate,
        start_time: this._state.selectedSlot,
        client_name: f.name,
        client_email: f.email,
        client_phone: f.phone,
        client_clinic: f.clinic,
        notes: f.notes,
      });

      if ((booking as any).error) {
        this._state.error = (booking as any).error;
        this._state.loading = false;
        this._rerender();
        return;
      }

      this._state.booking = booking;
      this._state.step = 4;
    } catch (e: any) {
      this._state.error = e.message || 'Booking fejlede. Pr\u00f8v igen.';
    }

    this._state.loading = false;
    this._rerender();
  },

  async copyMeetLink(): Promise<void> {
    if (!this._state.booking?.meet_link) return;
    try {
      await navigator.clipboard.writeText(this._state.booking.meet_link);
      const btn = document.querySelector('.db-confirm-actions .db-btn-primary');
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Kopieret!';
        setTimeout(() => { btn.innerHTML = original; }, 2000);
      }
    } catch {
      // Fallback
    }
  },

  async inviteColleague(): Promise<void> {
    if (!this._state.booking) return;
    const nameInput = document.getElementById('db-colleague-name') as HTMLInputElement;
    const emailInput = document.getElementById('db-colleague-email') as HTMLInputElement;
    if (!nameInput || !emailInput) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    if (!name || !email) return;

    const btn = document.querySelector('.db-invite-btn') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="vp-spinner" style="width:14px;height:14px"></span> Sender...';
    }

    try {
      await DemoAPI.join(this._state.booking.id, { name, email, role: '' });

      // Add to list
      const list = document.getElementById('db-colleague-list');
      if (list) {
        const item = document.createElement('div');
        item.className = 'db-colleague-item';
        item.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${this._esc(name)} (${this._esc(email)})</span>
        `;
        list.appendChild(item);
      }

      // Clear inputs
      nameInput.value = '';
      emailInput.value = '';
    } catch {
      const list = document.getElementById('db-colleague-list');
      if (list) {
        const item = document.createElement('div');
        item.className = 'db-colleague-item db-colleague-error';
        item.textContent = 'Kunne ikke sende invitation. Pr\u00f8v igen.';
        list.appendChild(item);
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Send invitation';
    }
  },

  // ─── Helpers ────────────────────────────────

  _esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  _getWeekNumber(d: Date): number {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  },

  async _rerender(): Promise<void> {
    const container = document.getElementById('main');
    if (!container) return;
    container.innerHTML = await this.render();
  },
};

(window as any).DemoBooking = DemoBooking;
