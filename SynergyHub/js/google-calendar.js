/* ═══════════════════════════════════════════
   Google Calendar API Integration
   OAuth2 via Google Identity Services (GIS)
   ═══════════════════════════════════════════ */

const GoogleCal = {
  _tokenClient: null,
  _accessToken: null,
  _calendarId: null,

  // ── Config ──

  getConfig() {
    return Store._get('gcal_config', { client_id: '', calendar_id: '' });
  },

  setConfig(config) {
    Store._set('gcal_config', config);
  },

  isConfigured() {
    const cfg = this.getConfig();
    return !!(cfg.client_id && cfg.calendar_id);
  },

  isConnected() {
    return !!this._accessToken;
  },

  // ── Auth ──

  async connect() {
    const cfg = this.getConfig();
    if (!cfg.client_id) {
      App.toast('Angiv Google Client ID i indstillinger', 'error');
      return false;
    }

    return new Promise((resolve) => {
      // Use Google Identity Services tokenClient
      this._tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cfg.client_id,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        callback: (response) => {
          if (response.error) {
            App.toast('Kalender-login fejlede', 'error');
            resolve(false);
            return;
          }
          this._accessToken = response.access_token;
          this._calendarId = cfg.calendar_id;
          Store._set('gcal_token', response.access_token);
          App.toast('Kalender forbundet', 'success');
          resolve(true);
        }
      });

      this._tokenClient.requestAccessToken();
    });
  },

  disconnect() {
    if (this._accessToken) {
      google.accounts.oauth2.revoke(this._accessToken);
    }
    this._accessToken = null;
    this._calendarId = null;
    Store._set('gcal_token', null);
    App.toast('Kalender afbrudt', 'info');
  },

  // Try to restore token from localStorage
  tryRestore() {
    const token = Store._get('gcal_token', null);
    const cfg = this.getConfig();
    if (token && cfg.calendar_id) {
      this._accessToken = token;
      this._calendarId = cfg.calendar_id;
      return true;
    }
    return false;
  },

  // ── Fetch Events ──

  async getEvents(startDate, endDate) {
    if (!this._accessToken || !this._calendarId) return [];

    const timeMin = new Date(startDate + 'T00:00:00').toISOString();
    const timeMax = new Date(endDate + 'T23:59:59').toISOString();
    const calId = encodeURIComponent(this._calendarId);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?`
      + `timeMin=${timeMin}&timeMax=${timeMax}`
      + `&singleEvents=true&orderBy=startTime&maxResults=250`;

    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this._accessToken}` }
      });

      if (res.status === 401) {
        // Token expired
        this._accessToken = null;
        Store._set('gcal_token', null);
        App.toast('Kalender-session udløbet — forbind igen', 'error');
        return [];
      }

      if (!res.ok) return [];

      const data = await res.json();
      return (data.items || []).map(e => this._mapEvent(e));
    } catch {
      return [];
    }
  },

  async getEvent(eventId) {
    if (!this._accessToken || !this._calendarId) return null;

    const calId = encodeURIComponent(this._calendarId);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(eventId)}`;

    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this._accessToken}` }
      });
      if (!res.ok) return null;
      const e = await res.json();
      return this._mapEvent(e);
    } catch {
      return null;
    }
  },

  _mapEvent(e) {
    const start = e.start?.dateTime || e.start?.date || '';
    const end = e.end?.dateTime || e.end?.date || '';
    const isAllDay = !e.start?.dateTime;

    return {
      id: e.id,
      title: e.summary || '(Ingen titel)',
      description: e.description || '',
      location: e.location || '',
      start,
      end,
      isAllDay,
      date: isAllDay ? e.start?.date : start.split('T')[0],
      attendees: (e.attendees || []).map(a => ({
        email: a.email,
        name: a.displayName || a.email,
        status: a.responseStatus
      })),
      organizer: e.organizer?.email || '',
      htmlLink: e.htmlLink || '',
      status: e.status,
      color: e.colorId || null
    };
  }
};
