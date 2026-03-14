/* ═══════════════════════════════════════════
   Onboarding & Retention Dashboard
   ═══════════════════════════════════════════ */

import { OnboardingAPI, TeamAPI } from '../api';
import { escapeHtml } from '../utils';
import type { OverviewData, OnboardingUser, FeedbackData, ChurnData, TeamMember, Ticket } from '../types';

type DashTab = 'overview' | 'users' | 'feedback' | 'churn';

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

export const OnboardingDashboard = {
  _activeTab: 'overview' as DashTab,
  _overview: null as OverviewData | null,
  _users: [] as OnboardingUser[],
  _feedback: null as FeedbackData | null,
  _churn: null as ChurnData | null,
  _userFilter: 'all',
  _userSearch: '',
  _period: 30,
  _teamMembers: [] as TeamMember[],

  setTab(tab: string): void {
    this._activeTab = tab as DashTab;
    (window as any).App.render();
  },

  setUserFilter(filter: string): void {
    this._userFilter = filter;
    (window as any).App.render();
  },

  setPeriod(period: number): void {
    this._period = period;
    this._overview = null;
    this._feedback = null;
    this._churn = null;
    (window as any).App.render();
  },

  async render(): Promise<string> {
    const tabs: { key: DashTab; label: string; badge?: string }[] = [
      { key: 'overview', label: 'Overblik' },
      { key: 'users', label: 'Brugere' },
      { key: 'feedback', label: 'Feedback' },
      { key: 'churn', label: 'Churn & Risiko' },
    ];

    let content = '';
    try {
      if (this._activeTab === 'overview') content = await this._renderOverview();
      else if (this._activeTab === 'users') content = await this._renderUsers();
      else if (this._activeTab === 'feedback') content = await this._renderFeedback();
      else if (this._activeTab === 'churn') content = await this._renderChurn();
    } catch (e) {
      content = '<div class="ob-empty">Kunne ikke indlæse data.</div>';
    }

    return `
      <div class="ob-container">
        <div class="ob-top-bar">
          <div class="ob-tabs">
            ${tabs.map(t => `
              <button class="ob-tab ${this._activeTab === t.key ? 'ob-tab-active' : ''}"
                      onclick="OnboardingDashboard.setTab('${t.key}')">
                ${t.label}${t.badge ? ` <span class="ob-tab-badge">${t.badge}</span>` : ''}
              </button>
            `).join('')}
          </div>
          <div class="ob-period-pills">
            ${[7, 30, 90].map(p => `
              <button class="ob-period-pill ${this._period === p ? 'ob-period-active' : ''}"
                      onclick="OnboardingDashboard.setPeriod(${p})">${p} dage</button>
            `).join('')}
          </div>
        </div>
        <div class="ob-content">${content}</div>
      </div>
    `;
  },

  /* ────────── OVERBLIK ────────── */
  async _renderOverview(): Promise<string> {
    if (!this._overview) this._overview = await OnboardingAPI.getOverview(this._period);
    const d = this._overview;
    const k = d.kpis;

    // Funnel max
    const funnelMax = d.funnel.length > 0 ? d.funnel[0].count : 1;
    const funnelColors = ['#22c55e', '#22c55e', '#4ade80', '#86efac', '#fbbf24', '#f59e0b', '#3b82f6'];

    // Daily charts max
    const signupMax = Math.max(...d.daily_signups.map(r => r.count), 1);
    const consultMax = Math.max(...d.daily_consultations.map(r => r.count), 1);

    return `
      <div class="ob-kpis">
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">Nye brugere</div>
          <div class="ob-kpi-num">${k.new_this_period}</div>
          <div class="ob-kpi-sub">Seneste ${this._period} dage</div>
        </div>
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">Aktive brugere</div>
          <div class="ob-kpi-num" style="color:var(--success)">${k.active_users}</div>
          <div class="ob-kpi-sub">af ${k.total_users} total</div>
        </div>
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">Inaktive</div>
          <div class="ob-kpi-num" style="color:var(--warning)">${k.inactive_users}</div>
          <div class="ob-kpi-sub">Kræver opfølgning</div>
        </div>
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">Churned</div>
          <div class="ob-kpi-num" style="color:var(--error)">${k.churned_this_period}</div>
          <div class="ob-kpi-sub">Seneste ${this._period} dage</div>
        </div>
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">Klinikker</div>
          <div class="ob-kpi-num">${k.total_clinics}</div>
          <div class="ob-kpi-sub">Unikke klinikker</div>
        </div>
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">Tid til værdi</div>
          <div class="ob-kpi-num">${k.avg_time_to_value} d</div>
          <div class="ob-kpi-sub">Gns. signup → 1. kons.</div>
        </div>
      </div>

      <div class="ob-section">
        <div class="ob-section-title">Onboarding-funnel</div>
        <div class="ob-funnel">
          ${d.funnel.map((s, i) => {
            const pct = Math.round((s.count / funnelMax) * 100);
            const dropPct = i > 0 ? Math.round(((d.funnel[i - 1].count - s.count) / d.funnel[i - 1].count) * 100) : 0;
            return `
              <div class="ob-funnel-stage">
                <div class="ob-funnel-step">${i + 1}</div>
                <div class="ob-funnel-label">${escapeHtml(s.label)}</div>
                <div class="ob-funnel-bar-wrap">
                  <div class="ob-funnel-bar" style="width:${pct}%;background:${funnelColors[i] || '#3b82f6'}"></div>
                </div>
                <div class="ob-funnel-count">${s.count}</div>
                <div class="ob-funnel-pct">${pct}%</div>
                ${i > 0 ? `<div class="ob-funnel-drop">↓ ${dropPct}%</div>` : '<div class="ob-funnel-drop"></div>'}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="ob-charts-row">
        <div class="ob-chart">
          <div class="ob-chart-title">Nye brugere pr. dag</div>
          <div class="ob-bars">
            ${d.daily_signups.map(r => {
              const h = Math.round((r.count / signupMax) * 100);
              const day = new Date(r.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
              return `<div class="ob-bar"><div class="ob-bar-value">${r.count}</div><div class="ob-bar-fill" style="height:${h}%;background:var(--navy-500)"></div><div class="ob-bar-label">${day}</div></div>`;
            }).join('')}
          </div>
        </div>
        <div class="ob-chart">
          <div class="ob-chart-title">Konsultationer pr. dag</div>
          <div class="ob-bars">
            ${d.daily_consultations.map(r => {
              const h = Math.round((r.count / consultMax) * 100);
              const day = new Date(r.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
              return `<div class="ob-bar"><div class="ob-bar-value">${r.count}</div><div class="ob-bar-fill" style="height:${h}%;background:var(--success)"></div><div class="ob-bar-label">${day}</div></div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  },

  /* ────────── BRUGERE ────────── */
  async _renderUsers(): Promise<string> {
    this._users = await OnboardingAPI.getUsers({
      status: this._userFilter !== 'all' ? this._userFilter : undefined,
      search: this._userSearch || undefined,
    });

    const filters = [
      { key: 'all', label: 'Alle' },
      { key: 'onboarding', label: 'Nye' },
      { key: 'active', label: 'Aktive' },
      { key: 'inactive', label: 'At-risk' },
      { key: 'churned', label: 'Churned' },
    ];

    return `
      <div class="ob-users-toolbar">
        <div class="ob-segment-filters">
          ${filters.map(f => `
            <button class="ob-segment-btn ${this._userFilter === f.key ? 'ob-segment-active' : ''}"
                    onclick="OnboardingDashboard.setUserFilter('${f.key}')">${f.label}</button>
          `).join('')}
        </div>
      </div>

      <div class="ob-table-wrap">
        <table class="ob-table">
          <thead>
            <tr>
              <th>Bruger</th>
              <th>Klinik</th>
              <th>Status</th>
              <th>Oprettet</th>
              <th>Dage</th>
              <th>Kons.</th>
              <th>Rating</th>
              <th>Health</th>
              <th>Tickets</th>
              <th>Handling</th>
            </tr>
          </thead>
          <tbody>
            ${this._users.length > 0 ? this._users.map(u => `
              <tr>
                <td>
                  <div class="ob-user-name">${escapeHtml(u.name)}</div>
                  <div class="ob-user-email">${escapeHtml(u.email)}</div>
                </td>
                <td>${escapeHtml(u.clinic_name)}</td>
                <td><span class="ob-status-badge" style="background:${STATUS_COLORS[u.status] || 'var(--navy-200)'}20;color:${STATUS_COLORS[u.status] || 'var(--text-secondary)'}">${STATUS_LABELS[u.status] || u.status}</span></td>
                <td class="ob-td-nowrap">${new Date(u.signup_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</td>
                <td>${u.days_since_signup} dage</td>
                <td style="color:${u.consultation_count === 0 ? 'var(--error)' : 'inherit'};font-weight:${u.consultation_count === 0 ? '600' : '400'}">${u.consultation_count}</td>
                <td>${u.avg_rating ? u.avg_rating.toFixed(1) : '<span style="color:var(--text-tertiary)">—</span>'}</td>
                <td>${this._renderHealthBar(u.health_score)}</td>
                <td>${(u as any).open_ticket_count > 0
                  ? `<span class="ob-ticket-badge ob-ticket-open">${(u as any).open_ticket_count} åben</span>`
                  : ((u as any).ticket_count > 0 ? `<span class="ob-ticket-badge">${(u as any).ticket_count}</span>` : '<span style="color:var(--text-tertiary)">0</span>')}</td>
                <td>
                  <div class="ob-action-btns">
                    <button class="ob-action-btn" onclick="event.stopPropagation(); OnboardingDashboard.openContactModal('${u.id}')" title="Kontakt bruger">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </button>
                    <button class="ob-action-btn" onclick="event.stopPropagation(); OnboardingDashboard.openUserTickets('${u.id}')" title="Se ticket-historik">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="11" style="text-align:center;padding:var(--space-6);color:var(--text-tertiary)">Ingen brugere fundet</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  _renderHealthBar(score: number): string {
    const color = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--error)';
    return `<div class="ob-health"><div class="ob-health-bar"><div class="ob-health-fill" style="width:${score}%;background:${color}"></div></div><span class="ob-health-num">${score}</span></div>`;
  },

  /* ────────── FEEDBACK ────────── */
  async _renderFeedback(): Promise<string> {
    if (!this._feedback) this._feedback = await OnboardingAPI.getFeedback(this._period);
    const d = this._feedback;

    // NPS color
    const npsColor = d.nps_score >= 30 ? 'var(--success)' : d.nps_score >= 0 ? 'var(--warning)' : 'var(--error)';

    // Max for bar chart
    const maxTheme = Math.max(...d.top_themes.map(t => t.count), 1);
    const maxBucket = Math.max(...d.rating_distribution.map(r => r.count), 1);

    return `
      <div class="ob-kpis ob-kpis-3">
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">Gns. rating</div>
          <div class="ob-kpi-num">${d.avg_rating.toFixed(1)}</div>
          <div class="ob-kpi-sub">Af ${d.review_count} reviews</div>
        </div>
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">NPS (estimeret)</div>
          <div class="ob-kpi-num" style="color:${npsColor}">${d.nps_score > 0 ? '+' : ''}${d.nps_score}</div>
          <div class="ob-kpi-sub">${d.nps_score >= 30 ? 'God' : d.nps_score >= 0 ? 'Neutral' : 'Lav'}</div>
        </div>
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">Reviews i perioden</div>
          <div class="ob-kpi-num">${d.review_count}</div>
          <div class="ob-kpi-sub">Seneste ${this._period} dage</div>
        </div>
      </div>

      <div class="ob-charts-row">
        <div class="ob-chart">
          <div class="ob-chart-title">Rating-fordeling</div>
          <div class="ob-h-bars">
            ${d.rating_distribution.map(r => {
              const pct = Math.round((r.count / maxBucket) * 100);
              return `<div class="ob-h-bar-row"><span class="ob-h-bar-label">${r.bucket}</span><div class="ob-h-bar-bg"><div class="ob-h-bar-fill" style="width:${pct}%;background:#f59e0b"></div></div><span class="ob-h-bar-count">${r.count}</span></div>`;
            }).join('')}
          </div>
        </div>
        <div class="ob-chart">
          <div class="ob-chart-title">Hyppigste feedback</div>
          <div class="ob-h-bars">
            ${d.top_themes.slice(0, 8).map(t => {
              const pct = Math.round((t.count / maxTheme) * 100);
              return `<div class="ob-h-bar-row"><span class="ob-h-bar-label ob-h-bar-label-wide">${escapeHtml(t.theme.substring(0, 40))}</span><div class="ob-h-bar-bg"><div class="ob-h-bar-fill" style="width:${pct}%;background:var(--navy-500)"></div></div><span class="ob-h-bar-count">${t.count}</span></div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="ob-section">
        <div class="ob-section-title">Seneste reviews</div>
        <div class="ob-table-wrap">
          <table class="ob-table">
            <thead>
              <tr>
                <th>Bruger</th>
                <th>Dato</th>
                <th>Rating</th>
                <th>Sentiment</th>
                <th>Uddrag</th>
              </tr>
            </thead>
            <tbody>
              ${d.recent_reviews.map(r => {
                const sentColor = r.sentiment === 'positiv' ? 'var(--success)' : r.sentiment === 'kritisk' ? 'var(--error)' : 'var(--warning)';
                return `
                  <tr>
                    <td>
                      <div class="ob-user-name">${escapeHtml(r.user_name)}</div>
                    </td>
                    <td class="ob-td-nowrap">${new Date(r.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</td>
                    <td style="font-weight:600;color:${r.rating >= 8 ? 'var(--success)' : r.rating >= 6 ? 'inherit' : 'var(--error)'}">${r.rating.toFixed(1)}</td>
                    <td><span style="color:${sentColor};font-weight:500;font-size:var(--text-xs)">${r.sentiment.charAt(0).toUpperCase() + r.sentiment.slice(1)}</span></td>
                    <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.comment)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /* ────────── CHURN & RISIKO ────────── */
  async _renderChurn(): Promise<string> {
    if (!this._churn) this._churn = await OnboardingAPI.getChurn(this._period);
    const d = this._churn;

    const maxReason = Math.max(...d.churn_reasons.map(r => r.count), 1);
    const maxTiming = Math.max(...d.churn_timing.map(r => r.count), 1);
    const totalChurned = d.churn_reasons.reduce((s, r) => s + r.count, 0) || 1;

    const reasonColors = ['var(--error)', 'var(--warning)', '#f59e0b', 'var(--navy-500)', 'var(--info)'];

    return `
      <div class="ob-kpis ob-kpis-4">
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">Churn rate</div>
          <div class="ob-kpi-num" style="color:var(--error)">${d.churn_rate}%</div>
          <div class="ob-kpi-sub">Seneste ${this._period} dage</div>
        </div>
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">Gns. levetid</div>
          <div class="ob-kpi-num">${d.avg_lifetime_days} d</div>
          <div class="ob-kpi-sub">Før churn</div>
        </div>
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">At-risk nu</div>
          <div class="ob-kpi-num" style="color:var(--warning)">${d.at_risk_count}</div>
          <div class="ob-kpi-sub">Kræver opfølgning</div>
        </div>
        <div class="ob-kpi-card">
          <div class="ob-kpi-label">MRR at risk</div>
          <div class="ob-kpi-num">${Math.round(d.at_risk_mrr).toLocaleString('da-DK')} kr</div>
          <div class="ob-kpi-sub">Inaktive brugere</div>
        </div>
      </div>

      <div class="ob-charts-row">
        <div class="ob-chart">
          <div class="ob-chart-title">Churn-årsager</div>
          <div class="ob-h-bars">
            ${d.churn_reasons.map((r, i) => {
              const pct = Math.round((r.count / totalChurned) * 100);
              const barPct = Math.round((r.count / maxReason) * 100);
              return `<div class="ob-h-bar-row"><span class="ob-h-bar-label ob-h-bar-label-wide">${escapeHtml(r.label)}</span><div class="ob-h-bar-bg"><div class="ob-h-bar-fill" style="width:${barPct}%;background:${reasonColors[i] || 'var(--navy-400)'}"></div></div><span class="ob-h-bar-count">${pct}%</span></div>`;
            }).join('')}
          </div>
        </div>
        <div class="ob-chart">
          <div class="ob-chart-title">Hvornår sker churn?</div>
          <div class="ob-h-bars">
            ${d.churn_timing.map(r => {
              const pct = Math.round((r.count / maxTiming) * 100);
              const totalPct = Math.round((r.count / totalChurned) * 100);
              return `<div class="ob-h-bar-row"><span class="ob-h-bar-label">${r.week}</span><div class="ob-h-bar-bg"><div class="ob-h-bar-fill" style="width:${pct}%;background:var(--error)">${totalPct}%</div></div><span class="ob-h-bar-count">${r.count}</span></div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="ob-section">
        <div class="ob-section-title">At-risk brugere — sorteret efter risiko</div>
        <div class="ob-table-wrap">
          <table class="ob-table">
            <thead>
              <tr>
                <th>Bruger</th>
                <th>Klinik</th>
                <th>Sidst aktiv</th>
                <th>Kons.</th>
                <th>Health</th>
                <th>MRR</th>
              </tr>
            </thead>
            <tbody>
              ${d.at_risk_users.map(u => `
                <tr>
                  <td>
                    <div class="ob-user-name">${escapeHtml(u.name)}</div>
                    <div class="ob-user-email">${escapeHtml(u.email)}</div>
                  </td>
                  <td>${escapeHtml(u.clinic_name)}</td>
                  <td class="ob-td-nowrap">${u.last_active_at ? new Date(u.last_active_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) : '—'}</td>
                  <td style="color:${u.consultation_count === 0 ? 'var(--error)' : 'inherit'}">${u.consultation_count}</td>
                  <td>${this._renderHealthBar(u.health_score)}</td>
                  <td>${Math.round(u.mrr).toLocaleString('da-DK')} kr</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },
  /* ────────── KONTAKT & TICKET-HISTORIK ────────── */

  async openContactModal(userId: string): Promise<void> {
    const user = this._users.find(u => u.id === userId);
    if (!user) return;

    if (this._teamMembers.length === 0) {
      try { this._teamMembers = await TeamAPI.getAll(); } catch { /* */ }
    }

    const memberOptions = this._teamMembers
      .map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`)
      .join('');

    const modal = document.getElementById('team-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="tl-modal" style="width:500px" onclick="event.stopPropagation()">
        <div class="tl-modal-header">
          <div>
            <h3>Kontakt bruger</h3>
            <div style="font-size:var(--text-sm);color:var(--text-secondary);margin-top:2px">
              ${escapeHtml(user.name)} &mdash; ${escapeHtml(user.clinic_name)}
            </div>
          </div>
          <button class="btn-icon" onclick="OnboardingDashboard.closeModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="tl-modal-body">
          <div class="form-group">
            <label class="form-label">Kanal</label>
            <select class="input" id="ob-contact-channel">
              <option value="email">Email</option>
              <option value="message">People's Clinic besked</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Til</label>
            <input class="input" type="text" value="${escapeHtml(user.name)} <${escapeHtml(user.email)}>" disabled style="background:var(--bg-body)">
          </div>
          <div class="form-group">
            <label class="form-label">Emne <span style="color:var(--error)">*</span></label>
            <input class="input" type="text" id="ob-contact-subject" placeholder="Emne..." value="Opf\u00f8lgning \u2014 ${escapeHtml(user.clinic_name)}">
          </div>
          <div class="form-group">
            <label class="form-label">Tildel til</label>
            <select class="input" id="ob-contact-assignee">
              <option value="">Ikke tildelt</option>
              ${memberOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Besked <span style="color:var(--error)">*</span></label>
            <textarea class="input" id="ob-contact-body" rows="5" placeholder="Skriv din besked..."></textarea>
          </div>
        </div>
        <div class="tl-modal-footer">
          <button class="btn" onclick="OnboardingDashboard.closeModal()">Annuller</button>
          <button class="btn btn-primary" id="ob-contact-send-btn" onclick="OnboardingDashboard.sendContact('${user.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send & opret ticket
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.onclick = (e: Event) => { if (e.target === modal) this.closeModal(); };
    requestAnimationFrame(() => {
      (document.getElementById('ob-contact-body') as HTMLTextAreaElement)?.focus();
    });
  },

  async sendContact(userId: string): Promise<void> {
    const subjectEl = document.getElementById('ob-contact-subject') as HTMLInputElement;
    const bodyEl = document.getElementById('ob-contact-body') as HTMLTextAreaElement;
    const channelEl = document.getElementById('ob-contact-channel') as HTMLSelectElement;
    const assigneeEl = document.getElementById('ob-contact-assignee') as HTMLSelectElement;
    const btn = document.getElementById('ob-contact-send-btn') as HTMLButtonElement;

    if (!subjectEl || !bodyEl) return;
    const subject = subjectEl.value.trim();
    const body = bodyEl.value.trim();
    if (!subject) { subjectEl.style.borderColor = 'var(--error)'; subjectEl.focus(); return; }
    if (!body) { bodyEl.style.borderColor = 'var(--error)'; bodyEl.focus(); return; }

    if (btn) { btn.innerHTML = '<span class="vp-spinner"></span> Sender...'; btn.disabled = true; }

    try {
      await OnboardingAPI.contactUser({
        user_id: userId,
        channel: (channelEl?.value as 'email' | 'message') || 'email',
        subject,
        body,
        assignee_id: assigneeEl?.value || undefined,
      });
      (window as any).App.toast('Besked sendt \u2014 ticket oprettet', 'success');
      this.closeModal();
      (window as any).App.render();
    } catch (err: any) {
      if (btn) { btn.innerHTML = 'Send & opret ticket'; btn.disabled = false; }
      (window as any).App.toast(err.message || 'Kunne ikke sende', 'error');
    }
  },

  async openUserTickets(userId: string): Promise<void> {
    const user = this._users.find(u => u.id === userId);
    if (!user) return;

    const modal = document.getElementById('team-modal');
    if (!modal) return;

    let tickets: Ticket[] = [];
    try {
      tickets = await OnboardingAPI.getUserTickets(userId);
    } catch { /* */ }

    const statusLabels: Record<string, string> = { open: '\u00c5ben', in_progress: 'I gang', resolved: 'L\u00f8st', closed: 'Lukket' };
    const statusCls: Record<string, string> = { open: 'hd-status-open', in_progress: 'hd-status-progress', resolved: 'hd-status-resolved', closed: 'hd-status-closed' };

    const ticketRows = tickets.length > 0
      ? tickets.map(t => `
          <div class="ob-ticket-history-row" onclick="App.navigateTo('helpdesk-detail', '${t.id}')">
            <div>
              <div style="font-weight:var(--font-semibold);font-size:var(--text-sm)">${escapeHtml(t.subject)}</div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary)">${new Date(t.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
            <span class="hd-badge ${statusCls[t.status] || ''}">${statusLabels[t.status] || t.status}</span>
          </div>`).join('')
      : '<p style="text-align:center;color:var(--text-tertiary);padding:var(--space-5)">Ingen tickets for denne bruger.</p>';

    modal.innerHTML = `
      <div class="tl-modal" style="width:520px" onclick="event.stopPropagation()">
        <div class="tl-modal-header">
          <div>
            <h3>Ticket-historik</h3>
            <div style="font-size:var(--text-sm);color:var(--text-secondary);margin-top:2px">
              ${escapeHtml(user.name)} &mdash; ${escapeHtml(user.clinic_name)}
            </div>
          </div>
          <button class="btn-icon" onclick="OnboardingDashboard.closeModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="tl-modal-body" style="max-height:400px;overflow-y:auto">
          ${ticketRows}
        </div>
        <div class="tl-modal-footer">
          <button class="btn" onclick="OnboardingDashboard.closeModal()">Luk</button>
          <button class="btn btn-primary" onclick="OnboardingDashboard.closeModal(); OnboardingDashboard.openContactModal('${userId}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ny kontakt
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.onclick = (e: Event) => { if (e.target === modal) this.closeModal(); };
  },

  closeModal(): void {
    const modal = document.getElementById('team-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.innerHTML = '';
      modal.onclick = null;
    }
  },
};

// Expose globally
(window as any).OnboardingDashboard = OnboardingDashboard;
