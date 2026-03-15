/* ═══════════════════════════════════════════
   Training Slideshow — Om People's Clinic
   Dynamisk præsentation med live data
   ═══════════════════════════════════════════ */

import { TeamAPI, OnboardingAPI } from '../api';
import { escapeHtml } from '../utils';
import type { TeamMember, OverviewData } from '../types';

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export const TrainingSlideshow = {
  _currentSlide: 0,
  _team: [] as TeamMember[],
  _overview: null as OverviewData | null,
  _loaded: false,

  async render(): Promise<string> {
    // Fetch live data
    if (!this._loaded) {
      try {
        const [team, overview] = await Promise.all([
          TeamAPI.getAll(false),
          OnboardingAPI.getOverview(30).catch(() => null),
        ]);
        this._team = team;
        this._overview = overview;
        this._loaded = true;
      } catch {
        this._team = [];
        this._overview = null;
      }
    }

    const slides = this._buildSlides();
    const totalSlides = slides.length;
    const current = Math.min(this._currentSlide, totalSlides - 1);

    const dots = slides.map((_, i) =>
      `<button class="ts-dot ${i === current ? 'ts-dot-active' : ''}" onclick="TrainingSlideshow.goTo(${i})"></button>`
    ).join('');

    return `
      <div class="ts-container">
        <div class="ts-slide-wrap">
          <button class="ts-nav ts-nav-prev ${current === 0 ? 'ts-nav-disabled' : ''}" onclick="TrainingSlideshow.prev()" ${current === 0 ? 'disabled' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="ts-slide">
            ${slides[current]}
          </div>
          <button class="ts-nav ts-nav-next ${current === totalSlides - 1 ? 'ts-nav-disabled' : ''}" onclick="TrainingSlideshow.next()" ${current === totalSlides - 1 ? 'disabled' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div class="ts-footer">
          <div class="ts-dots">${dots}</div>
          <span class="ts-counter">${current + 1} / ${totalSlides}</span>
        </div>
      </div>
    `;
  },

  _buildSlides(): string[] {
    const slides: string[] = [];

    // Slide 1: Hvad er People's Clinic?
    slides.push(this._slideIntro());

    // Slide 2: Platformen
    slides.push(this._slidePlatform());

    // Slide 3: Sikkerhed & Compliance
    slides.push(this._slideSecurity());

    // Slide 4: Tal & Nøgletal (live)
    slides.push(this._slideMetrics());

    // Slide 5: Tone of Voice & Code of Conduct
    slides.push(this._slideToneOfVoice());

    // Slide 6: Ledelsen
    slides.push(this._slideLeadership());

    // Slide 7: Teamet (live)
    slides.push(this._slideTeam());

    // Slide 8: Kom godt i gang
    slides.push(this._slideGetStarted());

    return slides;
  },

  _slideIntro(): string {
    return `
      <div class="ts-slide-content">
        <div class="ts-slide-icon" style="background: linear-gradient(135deg, #38456D, #5669A4)">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <h3 class="ts-slide-title">Hvad er People's Clinic?</h3>
        <div class="ts-slide-body">
          <p>People's Clinic er en dansk digital sundhedsplatform, der gør det nemt for klinikker at drive deres praksis digitalt.</p>
          <div class="ts-highlights">
            <div class="ts-highlight">
              <span class="ts-highlight-icon">🏥</span>
              <div>
                <strong>Alt-i-én platform</strong>
                <span>Booking, journal, kommunikation, fakturering</span>
              </div>
            </div>
            <div class="ts-highlight">
              <span class="ts-highlight-icon">🇩🇰</span>
              <div>
                <strong>Dansk sundhedstech</strong>
                <span>Bygget specifikt til det danske sundhedssystem</span>
              </div>
            </div>
            <div class="ts-highlight">
              <span class="ts-highlight-icon">🔒</span>
              <div>
                <strong>GDPR-compliant</strong>
                <span>Data hostes i EU, fuld kryptering</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _slidePlatform(): string {
    return `
      <div class="ts-slide-content">
        <div class="ts-slide-icon" style="background: linear-gradient(135deg, #3B82F6, #60A5FA)">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <h3 class="ts-slide-title">Hvordan fungerer platformen?</h3>
        <div class="ts-slide-body">
          <div class="ts-features">
            <div class="ts-feature">
              <div class="ts-feature-num">1</div>
              <div>
                <strong>Online booking</strong>
                <span>Patienter booker selv tider via klinikkens side</span>
              </div>
            </div>
            <div class="ts-feature">
              <div class="ts-feature-num">2</div>
              <div>
                <strong>Digital journal</strong>
                <span>Sikker patientjournal med fuld historik</span>
              </div>
            </div>
            <div class="ts-feature">
              <div class="ts-feature-num">3</div>
              <div>
                <strong>Kommunikation</strong>
                <span>SMS og email-påmindelser, automatisk opfølgning</span>
              </div>
            </div>
            <div class="ts-feature">
              <div class="ts-feature-num">4</div>
              <div>
                <strong>Fakturering & rapportering</strong>
                <span>Automatisk fakturering, overblik over økonomi</span>
              </div>
            </div>
          </div>
          <p class="ts-note">Platformen er webbaseret og fungerer på alle enheder — ingen app nødvendig.</p>
        </div>
      </div>
    `;
  },

  _slideSecurity(): string {
    return `
      <div class="ts-slide-content">
        <div class="ts-slide-icon" style="background: linear-gradient(135deg, #22C55E, #4ADE80)">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <h3 class="ts-slide-title">Sikkerhed & Compliance</h3>
        <div class="ts-slide-body">
          <div class="ts-security-grid">
            <div class="ts-security-item">
              <div class="ts-security-badge ts-badge-green">✓</div>
              <div>
                <strong>GDPR-overholdelse</strong>
                <span>Fuld compliance med EU's persondataforordning</span>
              </div>
            </div>
            <div class="ts-security-item">
              <div class="ts-security-badge ts-badge-green">✓</div>
              <div>
                <strong>EU-hosting</strong>
                <span>Data hostes i Tyskland og Irland via AWS</span>
              </div>
            </div>
            <div class="ts-security-item">
              <div class="ts-security-badge ts-badge-green">✓</div>
              <div>
                <strong>ISAE 3000</strong>
                <span>Uafhængigt revideret sikkerhedspraksis</span>
              </div>
            </div>
            <div class="ts-security-item">
              <div class="ts-security-badge ts-badge-green">✓</div>
              <div>
                <strong>Databehandleraftale</strong>
                <span>DPA klar til underskrift ved onboarding</span>
              </div>
            </div>
            <div class="ts-security-item">
              <div class="ts-security-badge ts-badge-green">✓</div>
              <div>
                <strong>Kryptering</strong>
                <span>Data krypteret under transport og i hvile</span>
              </div>
            </div>
            <div class="ts-security-item">
              <div class="ts-security-badge ts-badge-green">✓</div>
              <div>
                <strong>Incident response</strong>
                <span>Notifikation inden 24 timer ved sikkerhedsbrud</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _slideMetrics(): string {
    const ov = this._overview;
    const totalUsers = ov?.kpis?.total_users ?? '—';
    const activeUsers = ov?.kpis?.active_users ?? '—';
    const totalClinics = ov?.kpis?.total_clinics ?? '—';
    const onboardingUsers = ov?.kpis?.onboarding_users ?? '—';
    const nrr = ov?.kpis?.net_retention_rate != null ? `${Math.round(ov.kpis.net_retention_rate)}%` : '—';

    return `
      <div class="ts-slide-content">
        <div class="ts-slide-icon" style="background: linear-gradient(135deg, #F59E0B, #FBBF24)">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <h3 class="ts-slide-title">Vores tal — Live</h3>
        <span class="ts-live-badge">● LIVE</span>
        <div class="ts-slide-body">
          <div class="ts-metrics-grid">
            <div class="ts-metric">
              <span class="ts-metric-val">${totalUsers}</span>
              <span class="ts-metric-label">Brugere i alt</span>
            </div>
            <div class="ts-metric">
              <span class="ts-metric-val">${activeUsers}</span>
              <span class="ts-metric-label">Aktive brugere</span>
            </div>
            <div class="ts-metric">
              <span class="ts-metric-val">${totalClinics}</span>
              <span class="ts-metric-label">Klinikker</span>
            </div>
            <div class="ts-metric">
              <span class="ts-metric-val">${onboardingUsers}</span>
              <span class="ts-metric-label">I onboarding</span>
            </div>
            <div class="ts-metric">
              <span class="ts-metric-val">${nrr}</span>
              <span class="ts-metric-label">Net retention</span>
            </div>
            <div class="ts-metric">
              <span class="ts-metric-val">${this._team.length}</span>
              <span class="ts-metric-label">Teammedlemmer</span>
            </div>
          </div>
          <p class="ts-note">Tallene opdateres automatisk fra platformen.</p>
        </div>
      </div>
    `;
  },

  _slideToneOfVoice(): string {
    return `
      <div class="ts-slide-content">
        <div class="ts-slide-icon" style="background: linear-gradient(135deg, #EC4899, #F472B6)">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h3 class="ts-slide-title">Tone of Voice & Code of Conduct</h3>
        <div class="ts-slide-body">
          <div class="ts-tov-grid">
            <div class="ts-tov-do">
              <h4>✅ Sådan kommunikerer vi</h4>
              <ul>
                <li><strong>Varmt og empatisk</strong> — vi forstår sundhedssektoren</li>
                <li><strong>Professionelt</strong> — vi er eksperter, ikke sælgere</li>
                <li><strong>Klart og tydeligt</strong> — undgå jargon og buzz-words</li>
                <li><strong>Hjælpsomt</strong> — altid fokus på kundens behov</li>
                <li><strong>På dansk</strong> — al kommunikation er på dansk</li>
              </ul>
            </div>
            <div class="ts-tov-dont">
              <h4>❌ Det undgår vi</h4>
              <ul>
                <li>Pushy salgstale eller pres</li>
                <li>Medicinsk rådgivning af enhver art</li>
                <li>Løfter vi ikke kan holde</li>
                <li>Negativ omtale af konkurrenter</li>
                <li>Deling af kunders fortrolige data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _slideLeadership(): string {
    // Find leadership team from live data
    const leaders = this._team.filter(m =>
      m.role === 'lead' || (m.title && /CEO|CTO|COO|Founder|Director|Lead|Chef/i.test(m.title))
    );

    const leaderCards = leaders.length > 0
      ? leaders.map(m => `
          <div class="ts-leader-card">
            <div class="ts-leader-avatar" style="background: ${m.avatar_color}">${getInitials(m.name)}</div>
            <div class="ts-leader-info">
              <strong>${escapeHtml(m.name)}</strong>
              <span>${escapeHtml(m.title || 'Ledelse')}</span>
              ${m.email ? `<span class="ts-leader-email">${escapeHtml(m.email)}</span>` : ''}
            </div>
          </div>
        `).join('')
      : '<p class="ts-note">Ingen ledelsesmedlemmer konfigureret endnu.</p>';

    return `
      <div class="ts-slide-content">
        <div class="ts-slide-icon" style="background: linear-gradient(135deg, #8B5CF6, #A78BFA)">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h3 class="ts-slide-title">Ledelsen</h3>
        <span class="ts-live-badge">● LIVE</span>
        <div class="ts-slide-body">
          <div class="ts-leaders">${leaderCards}</div>
        </div>
      </div>
    `;
  },

  _slideTeam(): string {
    const teamCards = this._team.map(m => `
      <div class="ts-team-member">
        <div class="ts-team-avatar" style="background: ${m.avatar_color}">${getInitials(m.name)}</div>
        <div class="ts-team-info">
          <strong>${escapeHtml(m.name)}</strong>
          <span>${escapeHtml(m.title || (({'lead':'Lead','cs':'Customer Success','support':'Support','member':'Medarbejder'} as Record<string,string>)[m.role] || m.role))}</span>
        </div>
      </div>
    `).join('');

    return `
      <div class="ts-slide-content">
        <div class="ts-slide-icon" style="background: linear-gradient(135deg, #14B8A6, #2DD4BF)">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h3 class="ts-slide-title">Teamet — ${this._team.length} medarbejdere</h3>
        <span class="ts-live-badge">● LIVE</span>
        <div class="ts-slide-body">
          <div class="ts-team-grid">${teamCards}</div>
        </div>
      </div>
    `;
  },

  _slideGetStarted(): string {
    return `
      <div class="ts-slide-content">
        <div class="ts-slide-icon" style="background: linear-gradient(135deg, #6366F1, #818CF8)">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h3 class="ts-slide-title">Kom godt i gang</h3>
        <div class="ts-slide-body">
          <div class="ts-checklist-final">
            <div class="ts-check-item">
              <span class="ts-check-num">1</span>
              <div>
                <strong>Gennemgå checklisten</strong>
                <span>Følg onboardere-checklisten under "Oplæring"</span>
              </div>
            </div>
            <div class="ts-check-item">
              <span class="ts-check-num">2</span>
              <div>
                <strong>Læs FAQ'en</strong>
                <span>Bliv klar på de mest stillede spørgsmål</span>
              </div>
            </div>
            <div class="ts-check-item">
              <span class="ts-check-num">3</span>
              <div>
                <strong>Book en demo</strong>
                <span>Øv dig på at præsentere platformen</span>
              </div>
            </div>
            <div class="ts-check-item">
              <span class="ts-check-num">4</span>
              <div>
                <strong>Følg med i SynergyHub</strong>
                <span>Brug dashboardet dagligt til opgaver, tickets og kundedata</span>
              </div>
            </div>
          </div>
          <p class="ts-note" style="margin-top: var(--space-4); text-align: center">Spørgsmål? Skriv til dit team eller brug "Spørg SynergyHub" i menuen 💬</p>
        </div>
      </div>
    `;
  },

  goTo(index: number): void {
    this._currentSlide = index;
    (window as any).App.render();
  },

  next(): void {
    const total = this._buildSlides().length;
    if (this._currentSlide < total - 1) {
      this._currentSlide++;
      (window as any).App.render();
    }
  },

  prev(): void {
    if (this._currentSlide > 0) {
      this._currentSlide--;
      (window as any).App.render();
    }
  },

  refresh(): void {
    this._loaded = false;
    (window as any).App.render();
  },
};

(window as any).TrainingSlideshow = TrainingSlideshow;
