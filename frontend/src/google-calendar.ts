/* ═══════════════════════════════════════════
   Google Calendar API Integration
   OAuth2 via Google Identity Services (GIS)
   ═══════════════════════════════════════════ */

import { Store } from './store';
import type { GoogleCalendarEvent } from './types';

declare const google: any;

export const GoogleCal = {
  _tokenClient: null as any,
  _accessToken: null as string | null,
  _calendarId: null as string | null,

  getConfig(): { client_id: string; calendar_id: string } {
    return Store._get('gcal_config', { client_id: '', calendar_id: '' });
  },

  setConfig(config: { client_id: string; calendar_id: string }): void {
    Store._set('gcal_config', config);
  },

  isConfigured(): boolean {
    const cfg = this.getConfig();
    return !!(cfg.client_id && cfg.calendar_id);
  },

  isConnected(): boolean {
    return !!this._accessToken;
  },

  async connect(): Promise<boolean> {
    const cfg = this.getConfig();
    if (!cfg.client_id) {
      (window as any).App.toast('Angiv Google Client ID i indstillinger', 'error');
      return false;
    }

    return new Promise((resolve) => {
      this._tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cfg.client_id,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        callback: (response: any) => {
          if (response.error) {
            (window as any).App.toast('Kalender-login fejlede', 'error');
            resolve(false);
            return;
          }
          this._accessToken = response.access_token;
          this._calendarId = cfg.calendar_id;
          Store._set('gcal_token', response.access_token);
          (window as any).App.toast('Kalender forbundet', 'success');
          resolve(true);
        },
      });
      this._tokenClient.requestAccessToken();
    });
  },

  disconnect(): void {
    if (this._accessToken) {
      google.accounts.oauth2.revoke(this._accessToken);
    }
    this._accessToken = null;
    this._calendarId = null;
    Store._set('gcal_token', null);
    (window as any).App.toast('Kalender afbrudt', 'info');
  },

  tryRestore(): boolean {
    const token = Store._get<string | null>('gcal_token', null);
    const cfg = this.getConfig();
    if (token && cfg.calendar_id) {
      this._accessToken = token;
      this._calendarId = cfg.calendar_id;
      return true;
    }
    return false;
  },

  async getEvents(startDate: string, endDate: string): Promise<GoogleCalendarEvent[]> {
    if (!this._accessToken || !this._calendarId) return [];

    const timeMin = new Date(startDate + 'T00:00:00').toISOString();
    const timeMax = new Date(endDate + 'T23:59:59').toISOString();
    const calId = encodeURIComponent(this._calendarId);

    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?` +
      `timeMin=${timeMin}&timeMax=${timeMax}` +
      `&singleEvents=true&orderBy=startTime&maxResults=250`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this._accessToken}` },
      });

      if (res.status === 401) {
        this._accessToken = null;
        Store._set('gcal_token', null);
        (window as any).App.toast('Kalender-session udl\u00f8bet \u2014 forbind igen', 'error');
        return [];
      }

      if (!res.ok) return [];
      const data = await res.json();
      return (data.items || []).map((e: any) => this._mapEvent(e));
    } catch {
      return [];
    }
  },

  async getEvent(eventId: string): Promise<GoogleCalendarEvent | null> {
    if (!this._accessToken || !this._calendarId) return null;

    const calId = encodeURIComponent(this._calendarId);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(eventId)}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this._accessToken}` },
      });
      if (!res.ok) return null;
      const e = await res.json();
      return this._mapEvent(e);
    } catch {
      return null;
    }
  },

  _mapEvent(e: any): GoogleCalendarEvent {
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
      attendees: (e.attendees || []).map((a: any) => ({
        email: a.email,
        name: a.displayName || a.email,
        status: a.responseStatus,
      })),
      organizer: e.organizer?.email || '',
      htmlLink: e.htmlLink || '',
      status: e.status,
      color: e.colorId || null,
    };
  },
};

(window as any).GoogleCal = GoogleCal;
