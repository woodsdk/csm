/* ═══════════════════════════════════════════
   Event Modal — Google Calendar event details
   ═══════════════════════════════════════════ */

const EventModal = {
  _el: null,

  init() {
    this._el = document.getElementById('event-modal');
    this._el.addEventListener('click', (e) => {
      if (e.target === this._el) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._el.classList.contains('open')) this.close();
    });
  },

  async open(eventId) {
    const event = await GoogleCal.getEvent(eventId);
    if (!event) {
      App.toast('Kunne ikke hente event', 'error');
      return;
    }

    const startFormatted = event.isAllDay
      ? new Date(event.start + 'T00:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : new Date(event.start).toLocaleString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const endFormatted = event.isAllDay
      ? ''
      : new Date(event.end).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

    const attendeeStatusIcon = {
      accepted: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
      declined: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      tentative: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      needsAction: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'
    };

    this._el.innerHTML = `
      <div class="modal-panel">
        <div class="modal-header">
          <h3>${this._esc(event.title)}</h3>
          <button class="btn-icon" onclick="EventModal.close()" aria-label="Luk">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <!-- Time -->
          <div class="event-detail-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>
              <div class="text-sm font-medium">${startFormatted}</div>
              ${endFormatted ? `<div class="text-xs text-tertiary">til ${endFormatted}</div>` : ''}
              ${event.isAllDay ? '<span class="badge badge-todo text-xs">Heldagsbegivenhed</span>' : ''}
            </div>
          </div>

          <!-- Location -->
          ${event.location ? `
          <div class="event-detail-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span class="text-sm">${this._esc(event.location)}</span>
          </div>` : ''}

          <!-- Description -->
          ${event.description ? `
          <div class="event-detail-row event-detail-description">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
            <div class="text-sm event-description-text">${this._linkify(event.description)}</div>
          </div>` : ''}

          <!-- Attendees -->
          ${event.attendees.length > 0 ? `
          <div class="event-detail-section">
            <div class="form-label" style="margin-bottom: var(--space-2)">Deltagere (${event.attendees.length})</div>
            <div class="event-attendees">
              ${event.attendees.map(a => `
                <div class="event-attendee">
                  ${attendeeStatusIcon[a.status] || attendeeStatusIcon.needsAction}
                  <span class="text-sm">${this._esc(a.name)}</span>
                  ${a.email !== a.name ? `<span class="text-xs text-tertiary">${this._esc(a.email)}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>` : ''}

          <!-- Organizer -->
          ${event.organizer ? `
          <div class="event-detail-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span class="text-xs text-tertiary">Organiseret af ${this._esc(event.organizer)}</span>
          </div>` : ''}
        </div>
        <div class="modal-footer">
          <span></span>
          <div class="modal-footer-actions">
            <button class="btn" onclick="EventModal.close()">Luk</button>
            ${event.htmlLink ? `<a href="${event.htmlLink}" target="_blank" rel="noopener" class="btn btn-primary" onclick="EventModal.close()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Åbn i Google Calendar
            </a>` : ''}
          </div>
        </div>
      </div>
    `;

    this._el.classList.add('open');
  },

  close() {
    this._el.classList.remove('open');
  },

  _linkify(text) {
    const escaped = this._esc(text);
    return escaped.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener" class="text-accent">$1</a>'
    ).replace(/\n/g, '<br>');
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};
