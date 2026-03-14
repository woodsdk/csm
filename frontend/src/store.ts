/* ═══════════════════════════════════════════
   SynergyHub Store — localStorage (Google Calendar config only)
   ═══════════════════════════════════════════ */

const PREFIX = 'synergy_';

export const Store = {
  _get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(`${PREFIX}${key}`);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },

  _set(key: string, value: unknown): void {
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  },
};

// Expose globally for Google Calendar
(window as any).Store = Store;
