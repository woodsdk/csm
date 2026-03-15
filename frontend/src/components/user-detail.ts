/* ═══════════════════════════════════════════
   User Detail — Full CS profile for a platform user
   ═══════════════════════════════════════════ */

import { OnboardingAPI } from '../api';
import { escapeHtml } from '../utils';
import type { UserDetailData } from '../types';

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  onboarding: 'Onboarding',
  inactive: 'Inaktiv',
  churned: 'Churned',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--success)',
  onboarding: 'var(--info)',
  inactive: 'var(--warning)',
  churned: 'var(--error)',
};

const FUNNEL_STAGES = [
  { key: 'signup', label: 'Signup' },
  { key: 'mitid_verified', label: 'MitID' },
  { key: 'email_verified', label: 'Email' },
  { key: 'speciale_set', label: 'Speciale' },
  { key: 'clinic_created', label: 'Klinik' },
  { key: 'first_consultation', label: '1. kons.' },
  { key: 'second_consultation', label: '2. kons.' },
];

export const UserDetail = {
  _data: null as UserDetailData | null,
  _userId: '',

  async render(userId: string): Promise<string> {
    this._userId = userId;
    try {
      this._data = await OnboardingAPI.getUserDetail(userId);
    } catch {
      return '<div class="ob-empty">Kunne ikke indlæse brugerdata.</div>';
    }

    const d = this._data;
    const p = d.profile;

    return `
      <div class="ud-container">
        <button class="ud-back-btn" onclick="App.navigateTo('onboarding')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Tilbage til dashboard
        </button>

        <div class="ud-top-grid">
          ${this._renderProfile(p)}
          ${this._renderHealthBreakdown(p)}
        </div>

        ${this._renderActivity(d)}
        ${this._renderOnboardingProgress(d)}

        <div class="ud-two-col">
          ${this._renderConsultations(d)}
          ${this._renderFeedback(d)}
        </div>

        ${this._renderCommunicationLog(d)}
      </div>
    `;
  },

  _renderProfile(p: UserDetailData['profile']): string {
    const statusColor = STATUS_COLORS[p.status] || 'var(--navy-200)';
    const statusLabel = STATUS_LABELS[p.status] || p.status;
    const lastActive = p.last_active_at
      ? new Date(p.last_active_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const signupDate = new Date(p.signup_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });

    return `
      <div class="ud-profile-card">
        <div class="ud-profile-top">
          <div>
            <h2 class="ud-profile-name">${escapeHtml(p.name)}</h2>
            <div class="ud-profile-clinic">${escapeHtml(p.clinic_name)}${p.speciale ? ` · ${escapeHtml(p.speciale)}` : ''}</div>
            <div class="ud-profile-email">${escapeHtml(p.email)}</div>
          </div>
          <span class="ob-status-badge" style="background:${statusColor}20;color:${statusColor}">${statusLabel}</span>
        </div>
        <div class="ud-profile-meta">
          <div class="ud-meta-item">
            <span class="ud-meta-label">Plan</span>
            <span class="ud-meta-value">${p.plan || '—'}</span>
          </div>
          <div class="ud-meta-item">
            <span class="ud-meta-label">MRR</span>
            <span class="ud-meta-value">${Math.round(p.mrr).toLocaleString('da-DK')} kr</span>
          </div>
          <div class="ud-meta-item">
            <span class="ud-meta-label">Oprettet</span>
            <span class="ud-meta-value">${signupDate}</span>
          </div>
          <div class="ud-meta-item">
            <span class="ud-meta-label">Sidst aktiv</span>
            <span class="ud-meta-value">${lastActive}</span>
          </div>
          <div class="ud-meta-item">
            <span class="ud-meta-label">Konsultationer</span>
            <span class="ud-meta-value" style="color:${p.consultation_count === 0 ? 'var(--error)' : 'inherit'};font-weight:600">${p.consultation_count}</span>
          </div>
          <div class="ud-meta-item">
            <span class="ud-meta-label">Gns. rating</span>
            <span class="ud-meta-value">${p.avg_rating ? p.avg_rating.toFixed(1) : '—'}</span>
          </div>
        </div>
        <div class="ud-profile-actions">
          <button class="btn btn-primary btn-sm" onclick="OnboardingDashboard.openContactModal('${p.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Kontakt bruger
          </button>
          <button class="btn btn-sm" onclick="OnboardingDashboard.openUserTickets('${p.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Ticket-historik (${p.ticket_count})
          </button>
        </div>
      </div>
    `;
  },

  _renderHealthBreakdown(p: UserDetailData['profile']): string {
    const hb = p.health_breakdown;
    const totalColor = hb.total >= 70 ? 'var(--success)' : hb.total >= 40 ? 'var(--warning)' : 'var(--error)';

    const factors = [
      { label: 'Recency', value: hb.recency, weight: '35%', desc: 'Dage siden sidst aktiv' },
      { label: 'Frequency', value: hb.frequency, weight: '30%', desc: 'Konsultationer / 30d' },
      { label: 'Satisfaction', value: hb.satisfaction, weight: '20%', desc: 'Gns. rating' },
      { label: 'Support', value: hb.support, weight: '15%', desc: 'Åbne tickets' },
    ];

    return `
      <div class="ud-health-breakdown">
        <div class="ud-health-total">
          <div class="ud-health-total-num" style="color:${totalColor}">${hb.total}</div>
          <div class="ud-health-total-label">Health Score</div>
        </div>
        <div class="ud-health-factors">
          ${factors.map(f => {
            const color = f.value >= 70 ? 'var(--success)' : f.value >= 40 ? 'var(--warning)' : 'var(--error)';
            return `
              <div class="ud-health-bar-row">
                <div class="ud-health-bar-label">
                  <span>${f.label}</span>
                  <span class="ud-health-bar-weight">${f.weight}</span>
                </div>
                <div class="ud-health-bar-track">
                  <div class="ud-health-bar-fill" style="width:${f.value}%;background:${color}"></div>
                </div>
                <span class="ud-health-bar-num">${f.value}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  _renderActivity(d: UserDetailData): string {
    const weeks = d.weekly_consultations;
    if (weeks.length === 0) {
      return `
        <div class="ud-section">
          <div class="ud-section-title">Ugentlig aktivitet</div>
          <div class="ud-empty">Ingen konsultationer registreret endnu.</div>
        </div>
      `;
    }

    const maxCount = Math.max(...weeks.map(w => w.count), 1);

    return `
      <div class="ud-section">
        <div class="ud-section-title">Ugentlig aktivitet (seneste 8 uger)</div>
        <div class="ud-activity-chart">
          ${weeks.map(w => {
            const h = Math.round((w.count / maxCount) * 100);
            const weekLabel = new Date(w.week).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
            return `
              <div class="ud-activity-bar">
                <div class="ud-activity-bar-value">${w.count}</div>
                <div class="ud-activity-bar-fill" style="height:${h}%"></div>
                <div class="ud-activity-bar-label">${weekLabel}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  _renderOnboardingProgress(d: UserDetailData): string {
    const completedEvents = new Set(d.events.map(e => e.event_type));

    return `
      <div class="ud-section">
        <div class="ud-section-title">Onboarding-progress</div>
        <div class="ud-progress-steps">
          ${FUNNEL_STAGES.map((stage, i) => {
            const done = completedEvents.has(stage.key);
            const event = d.events.find(e => e.event_type === stage.key);
            const dateStr = event
              ? new Date(event.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
              : '';
            return `
              <div class="ud-step ${done ? 'ud-step-done' : 'ud-step-pending'}">
                <div class="ud-step-icon">${done ? '✓' : i + 1}</div>
                <div class="ud-step-label">${stage.label}</div>
                ${dateStr ? `<div class="ud-step-date">${dateStr}</div>` : ''}
              </div>
              ${i < FUNNEL_STAGES.length - 1 ? '<div class="ud-step-connector"></div>' : ''}
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  _renderConsultations(d: UserDetailData): string {
    if (d.consultations.length === 0) {
      return `
        <div class="ud-section">
          <div class="ud-section-title">Seneste konsultationer</div>
          <div class="ud-empty">Ingen konsultationer endnu.</div>
        </div>
      `;
    }

    return `
      <div class="ud-section">
        <div class="ud-section-title">Seneste konsultationer</div>
        <div class="ob-table-wrap">
          <table class="ob-table">
            <thead>
              <tr><th>Dato</th><th>Varighed</th><th>Rating</th></tr>
            </thead>
            <tbody>
              ${d.consultations.slice(0, 10).map(c => {
                const date = new Date(c.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
                const ratingColor = c.rating && c.rating >= 8 ? 'var(--success)' : c.rating && c.rating < 6 ? 'var(--error)' : 'inherit';
                return `
                  <tr>
                    <td class="ob-td-nowrap">${date}</td>
                    <td>${c.duration_minutes} min</td>
                    <td style="font-weight:600;color:${ratingColor}">${c.rating ? c.rating.toFixed(1) : '—'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  _renderFeedback(d: UserDetailData): string {
    if (d.reviews.length === 0) {
      return `
        <div class="ud-section">
          <div class="ud-section-title">Feedback</div>
          <div class="ud-empty">Ingen feedback endnu.</div>
        </div>
      `;
    }

    return `
      <div class="ud-section">
        <div class="ud-section-title">Feedback (${d.reviews.length})</div>
        <div class="ob-table-wrap">
          <table class="ob-table">
            <thead>
              <tr><th>Dato</th><th>Rating</th><th>Sentiment</th><th>Kommentar</th></tr>
            </thead>
            <tbody>
              ${d.reviews.map(r => {
                const date = new Date(r.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
                const sentColor = r.sentiment === 'positiv' ? 'var(--success)' : r.sentiment === 'kritisk' ? 'var(--error)' : 'var(--warning)';
                const ratingColor = r.rating >= 8 ? 'var(--success)' : r.rating < 6 ? 'var(--error)' : 'inherit';
                return `
                  <tr>
                    <td class="ob-td-nowrap">${date}</td>
                    <td style="font-weight:600;color:${ratingColor}">${r.rating.toFixed(1)}</td>
                    <td><span style="color:${sentColor};font-weight:500;font-size:var(--text-xs)">${r.sentiment.charAt(0).toUpperCase() + r.sentiment.slice(1)}</span></td>
                    <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.comment)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  _renderCommunicationLog(d: UserDetailData): string {
    if (d.communication_log.length === 0) {
      return `
        <div class="ud-section">
          <div class="ud-section-title">Kommunikationslog</div>
          <div class="ud-empty">Ingen kommunikation registreret endnu.</div>
        </div>
      `;
    }

    return `
      <div class="ud-section">
        <div class="ud-section-title">Kommunikationslog</div>
        <div class="ud-timeline">
          ${d.communication_log.map(c => {
            const date = new Date(c.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
            const time = new Date(c.created_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
            const bodyPreview = c.body.length > 120 ? c.body.substring(0, 120) + '...' : c.body;
            return `
              <div class="ud-timeline-item">
                <div class="ud-timeline-dot"></div>
                <div class="ud-timeline-content">
                  <div class="ud-timeline-header">
                    <span class="ud-timeline-subject">${escapeHtml(c.ticket_subject)}</span>
                    <span class="ud-timeline-date">${date} ${time}</span>
                  </div>
                  <div class="ud-timeline-sender">${escapeHtml(c.sender_name || 'CS Team')}</div>
                  <div class="ud-timeline-body">${escapeHtml(bodyPreview)}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },
};

(window as any).UserDetail = UserDetail;
