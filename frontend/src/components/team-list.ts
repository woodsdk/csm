/* ═══════════════════════════════════════════
   Team List — Medarbejderliste
   ═══════════════════════════════════════════ */

import { TeamAPI } from '../api';
import { escapeHtml } from '../utils';
import type { TeamMember } from '../types';

const AVATAR_COLORS = [
  '#38456D', '#5669A4', '#22C55E', '#F59E0B', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#EF4444', '#6366F1',
];

const ROLE_LABELS: Record<string, string> = {
  lead: 'Lead',
  cs: 'Customer Success',
  support: 'Support',
  member: 'Medarbejder',
};

const ROLE_OPTIONS = ['member', 'lead', 'cs', 'support'];

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export const TeamList = {
  _members: [] as TeamMember[],
  _search: '',
  _showInactive: false,
  _editingId: null as string | null,

  /* ── Main render ── */
  async render(): Promise<string> {
    try {
      this._members = await TeamAPI.getAll(this._showInactive);
    } catch {
      this._members = [];
    }

    const filtered = this._getFiltered();
    const activeCount = this._members.filter(m => m.is_active).length;
    const totalCount = this._members.length;

    // Desktop table
    let tableHTML = '';
    if (filtered.length === 0) {
      tableHTML = `
        <div class="tl-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p>${this._search ? 'Ingen medarbejdere matcher din s\u00f8gning' : 'Ingen medarbejdere endnu'}</p>
        </div>`;
    } else {
      const rows = filtered.map(m => this._renderRow(m)).join('');
      tableHTML = `
        <div class="tl-table-wrap">
          <table class="tl-table">
            <thead>
              <tr>
                <th style="width: 24%">Navn</th>
                <th style="width: 16%">Stilling</th>
                <th style="width: 18%">Email</th>
                <th style="width: 12%">Telefon</th>
                <th style="width: 12%">Rolle</th>
                <th style="width: 9%">Status</th>
                <th style="width: 9%"></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    // Mobile cards
    const cardsHTML = filtered.length === 0
      ? ''
      : `<div class="tl-cards">${filtered.map(m => this._renderCard(m)).join('')}</div>`;

    return `
      <div class="tl-header">
        <div class="tl-header-left">
          <span class="tl-stat"><strong>${activeCount}</strong> aktive medarbejdere${this._showInactive && totalCount > activeCount ? ` \u00b7 ${totalCount - activeCount} inaktive` : ''}</span>
        </div>
        <button class="btn btn-primary" onclick="TeamList.openModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tilf\u00f8j medarbejder
        </button>
      </div>

      <div class="tl-toolbar">
        <div class="tl-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="tl-search" placeholder="S\u00f8g medarbejder..." value="${escapeHtml(this._search)}" oninput="TeamList.setSearch(this.value)">
        </div>
        <label class="tl-toggle">
          <input type="checkbox" ${this._showInactive ? 'checked' : ''} onchange="TeamList.toggleInactive()">
          Vis inaktive
        </label>
      </div>

      ${tableHTML}
      ${cardsHTML}
    `;
  },

  /* ── Table row ── */
  _renderRow(m: TeamMember): string {
    const initials = getInitials(m.name);
    const roleClass = `tl-role-${m.role}`;
    const roleLabel = ROLE_LABELS[m.role] || m.role;
    const inactiveClass = m.is_active ? '' : 'tl-row-inactive';

    const titleDisplay = m.title ? escapeHtml(m.title) : '<span class="tl-empty-val">\u2014</span>';

    return `
      <tr class="${inactiveClass}" onclick="TeamList.openModal('${m.id}')">
        <td>
          <div class="tl-name-cell">
            <div class="tl-avatar" style="background: ${m.avatar_color}">${initials}</div>
            <span class="tl-name">${escapeHtml(m.name)}</span>
          </div>
        </td>
        <td><span class="tl-title-text">${titleDisplay}</span></td>
        <td>${m.email ? `<a class="tl-email" href="mailto:${escapeHtml(m.email)}" onclick="event.stopPropagation()">${escapeHtml(m.email)}</a>` : '<span class="tl-empty-val">\u2014</span>'}</td>
        <td>${m.phone ? `<a class="tl-phone" href="tel:${escapeHtml(m.phone)}" onclick="event.stopPropagation()">${escapeHtml(m.phone)}</a>` : '<span class="tl-empty-val">\u2014</span>'}</td>
        <td><span class="tl-role ${roleClass}">${roleLabel}</span></td>
        <td>
          <span class="tl-status ${m.is_active ? 'tl-status-active' : 'tl-status-inactive'}">
            <span class="tl-status-dot"></span>
            ${m.is_active ? 'Aktiv' : 'Inaktiv'}
          </span>
        </td>
        <td>
          <div class="tl-actions">
            <button class="tl-action-btn" onclick="event.stopPropagation(); TeamList.openModal('${m.id}')" title="Rediger">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${m.is_active
              ? `<button class="tl-action-btn tl-action-danger" onclick="event.stopPropagation(); TeamList.deactivate('${m.id}')" title="Deaktiver">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                </button>`
              : `<button class="tl-action-btn" onclick="event.stopPropagation(); TeamList.activate('${m.id}')" title="Aktiver">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                </button>`
            }
          </div>
        </td>
      </tr>`;
  },

  /* ── Mobile card ── */
  _renderCard(m: TeamMember): string {
    const initials = getInitials(m.name);
    const roleLabel = ROLE_LABELS[m.role] || m.role;
    const roleClass = `tl-role-${m.role}`;

    return `
      <div class="tl-card ${m.is_active ? '' : 'tl-card-inactive'}" onclick="TeamList.openModal('${m.id}')">
        <div class="tl-card-avatar" style="background: ${m.avatar_color}">${initials}</div>
        <div class="tl-card-body">
          <div class="tl-card-top">
            <span class="tl-card-name">${escapeHtml(m.name)}</span>
            <span class="tl-role ${roleClass}">${roleLabel}</span>
          </div>
          ${m.title ? `<div class="tl-card-title">${escapeHtml(m.title)}</div>` : ''}
          <div class="tl-card-contact">
            ${m.email ? `<a href="mailto:${escapeHtml(m.email)}" onclick="event.stopPropagation()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              ${escapeHtml(m.email)}</a>` : ''}
            ${m.phone ? `<a href="tel:${escapeHtml(m.phone)}" onclick="event.stopPropagation()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              ${escapeHtml(m.phone)}</a>` : ''}
          </div>
        </div>
      </div>`;
  },

  /* ── Filtering ── */
  _getFiltered(): TeamMember[] {
    let members = [...this._members];
    if (this._search) {
      const q = this._search.toLowerCase();
      members = members.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        (m.title || '').toLowerCase().includes(q) ||
        (ROLE_LABELS[m.role] || m.role).toLowerCase().includes(q)
      );
    }
    return members;
  },

  setSearch(value: string): void {
    this._search = value;
    (window as any).App.render();
  },

  toggleInactive(): void {
    this._showInactive = !this._showInactive;
    (window as any).App.render();
  },

  /* ── Modal: Create / Edit ── */
  async openModal(memberId: string | null = null): Promise<void> {
    this._editingId = memberId;
    let member: TeamMember | null = null;

    if (memberId) {
      member = this._members.find(m => m.id === memberId) || null;
      if (!member) {
        member = await TeamAPI.get(memberId);
      }
    }

    const isEdit = !!member;
    const name = member?.name || '';
    const title = member?.title || '';
    const email = member?.email || '';
    const phone = member?.phone || '';
    const role = member?.role || 'member';
    const avatarColor = member?.avatar_color || AVATAR_COLORS[0];
    const isActive = member?.is_active ?? true;

    const modal = document.getElementById('team-modal');
    if (!modal) return;

    const roleOptions = ROLE_OPTIONS.map(r =>
      `<option value="${r}" ${r === role ? 'selected' : ''}>${ROLE_LABELS[r] || r}</option>`
    ).join('');

    const swatches = AVATAR_COLORS.map(c =>
      `<button type="button" class="tl-swatch ${c === avatarColor ? 'tl-swatch-active' : ''}" style="background: ${c}" onclick="TeamList.selectColor('${c}')" data-color="${c}"></button>`
    ).join('');

    modal.innerHTML = `
      <div class="tl-modal" onclick="event.stopPropagation()">
        <div class="tl-modal-header">
          <h3>${isEdit ? 'Rediger medarbejder' : 'Tilf\u00f8j medarbejder'}</h3>
          <button class="btn-icon" onclick="TeamList.closeModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="tl-modal-body">
          <div class="form-group">
            <label class="form-label">Navn <span style="color: var(--error)">*</span></label>
            <input class="input" type="text" id="tl-name" value="${escapeHtml(name)}" placeholder="Fulde navn">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Stilling / Titel</label>
              <input class="input" type="text" id="tl-title" value="${escapeHtml(title)}" placeholder="F.eks. Customer Success Manager" list="tl-title-suggestions">
              <datalist id="tl-title-suggestions">
                <option value="CEO & Co-Founder">
                <option value="CTO & Co-Founder">
                <option value="COO">
                <option value="Customer Success Manager">
                <option value="Support Lead">
                <option value="Account Manager">
                <option value="Onboarding Specialist">
                <option value="Studentermedhjælper">
                <option value="Praktikant">
                <option value="Produktchef">
                <option value="Udvikler">
              </datalist>
            </div>
            <div class="form-group">
              <label class="form-label">Rolle</label>
              <select class="input" id="tl-role">${roleOptions}</select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="input" type="email" id="tl-email" value="${escapeHtml(email)}" placeholder="email@peoplesdoctor.com">
            </div>
            <div class="form-group">
              <label class="form-label">Telefon</label>
              <input class="input" type="tel" id="tl-phone" value="${escapeHtml(phone)}" placeholder="+45 ...">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Avatar-farve</label>
            <div class="tl-swatches" id="tl-swatches">${swatches}</div>
            <input type="hidden" id="tl-color" value="${avatarColor}">
          </div>
          ${isEdit ? `
            <div class="form-group">
              <label class="tl-toggle" style="margin-top: var(--space-1)">
                <input type="checkbox" id="tl-active" ${isActive ? 'checked' : ''}>
                Aktiv medarbejder
              </label>
            </div>
          ` : ''}
        </div>
        <div class="tl-modal-footer">
          ${isEdit ? `<button class="btn" style="margin-right: auto; color: var(--error)" onclick="TeamList.deleteMember('${member!.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Slet
          </button>` : ''}
          <button class="btn" onclick="TeamList.closeModal()">Annuller</button>
          <button class="btn btn-primary" id="tl-save-btn" onclick="TeamList.save()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            ${isEdit ? 'Gem \u00e6ndringer' : 'Opret medarbejder'}
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.onclick = (e: Event) => {
      if (e.target === modal) this.closeModal();
    };

    requestAnimationFrame(() => {
      const nameInput = document.getElementById('tl-name') as HTMLInputElement | null;
      if (nameInput) nameInput.focus();
    });
  },

  selectColor(color: string): void {
    const hidden = document.getElementById('tl-color') as HTMLInputElement | null;
    if (hidden) hidden.value = color;

    const swatches = document.querySelectorAll('.tl-swatch');
    swatches.forEach(s => {
      const el = s as HTMLElement;
      el.classList.toggle('tl-swatch-active', el.getAttribute('data-color') === color);
    });
  },

  closeModal(): void {
    const modal = document.getElementById('team-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.innerHTML = '';
      modal.onclick = null;
    }
    this._editingId = null;
  },

  async save(): Promise<void> {
    const nameEl = document.getElementById('tl-name') as HTMLInputElement | null;
    const titleEl = document.getElementById('tl-title') as HTMLInputElement | null;
    const emailEl = document.getElementById('tl-email') as HTMLInputElement | null;
    const phoneEl = document.getElementById('tl-phone') as HTMLInputElement | null;
    const roleEl = document.getElementById('tl-role') as HTMLSelectElement | null;
    const colorEl = document.getElementById('tl-color') as HTMLInputElement | null;
    const activeEl = document.getElementById('tl-active') as HTMLInputElement | null;
    const btn = document.getElementById('tl-save-btn') as HTMLButtonElement | null;

    if (!nameEl) return;

    const name = nameEl.value.trim();
    if (!name) {
      nameEl.style.borderColor = 'var(--error)';
      nameEl.focus();
      return;
    }

    const data: Partial<TeamMember> = {
      name,
      title: titleEl?.value.trim() || '',
      email: emailEl?.value.trim() || '',
      phone: phoneEl?.value.trim() || '',
      role: roleEl?.value || 'member',
      avatar_color: colorEl?.value || AVATAR_COLORS[0],
    };

    if (activeEl) {
      data.is_active = activeEl.checked;
    }

    if (btn) {
      btn.innerHTML = '<span class="vp-spinner"></span> Gemmer...';
      btn.disabled = true;
    }

    try {
      if (this._editingId) {
        await TeamAPI.update(this._editingId, data);
        (window as any).App.toast('Medarbejder opdateret', 'success');
      } else {
        await TeamAPI.create(data);
        (window as any).App.toast('Medarbejder oprettet', 'success');
      }
      this.closeModal();
      (window as any).App.render();
    } catch (err: any) {
      if (btn) {
        btn.innerHTML = this._editingId ? 'Gem \u00e6ndringer' : 'Opret medarbejder';
        btn.disabled = false;
      }
      (window as any).App.toast(err.message || 'Noget gik galt', 'error');
    }
  },

  async deactivate(id: string): Promise<void> {
    if (!confirm('Er du sikker p\u00e5 du vil deaktivere denne medarbejder?')) return;
    try {
      await TeamAPI.update(id, { is_active: false });
      (window as any).App.toast('Medarbejder deaktiveret', 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke deaktivere medarbejder', 'error');
    }
  },

  async activate(id: string): Promise<void> {
    try {
      await TeamAPI.update(id, { is_active: true });
      (window as any).App.toast('Medarbejder aktiveret', 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke aktivere medarbejder', 'error');
    }
  },

  async deleteMember(id: string): Promise<void> {
    if (!confirm('Er du sikker p\u00e5 du vil slette denne medarbejder permanent? Eventuelle opgavetildelinger fjernes.')) return;
    try {
      await TeamAPI.delete(id);
      (window as any).App.toast('Medarbejder slettet', 'success');
      this.closeModal();
      (window as any).App.render();
    } catch {
      (window as any).App.toast('Kunne ikke slette medarbejder', 'error');
    }
  },
};

// Expose globally for onclick handlers
(window as any).TeamList = TeamList;
