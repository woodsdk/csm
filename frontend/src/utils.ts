/* ═══════════════════════════════════════════
   Utility Helpers
   ═══════════════════════════════════════════ */

export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export function relativeDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return 'I dag';
  if (diffDays === 1) return 'I morgen';
  if (diffDays === -1) return 'I går';
  if (diffDays > 1 && diffDays <= 6) return `Om ${diffDays} dage`;
  if (diffDays < -1 && diffDays >= -6) return `${Math.abs(diffDays)} dage siden`;
  return formatDate(dateStr);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}
