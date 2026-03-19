/* ═══════════════════════════════════════════
   Team List — Medarbejderliste
   ═══════════════════════════════════════════ */

import { TeamAPI } from '../api';
import { escapeHtml } from '../utils';
import type { TeamMember } from '../types';
import { t } from '../i18n';

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
          <p>${this._search ? t('team.noMatchSearch') : t('team.noMembers')}</p>
        </div>`;
    } else {
      const rows = filtered.map(m => this._renderRow(m)).join('');
      tableHTML = `
        <div class="tl-table-wrap">
          <table class="tl-table">
            <thead>
              <tr>
                <th style="width: 28%">${t('team.name')}</th>
                <th style="width: 20%">${t('team.title')}</th>
                <th style="width: 22%">${t('team.email')}</th>
                <th style="width: 14%">${t('team.phone')}</th>
                <th style="width: 8%">${t('team.status')}</th>
                <th style="width: 8%"></th>
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
          <span class="tl-stat"><strong>${activeCount}</strong> ${t('team.activeMembers')}${this._showInactive && totalCount > activeCount ? ` · ${totalCount - activeCount} ${t('team.inactive')}` : ''}</span>
        </div>
        <button class="btn btn-primary" onclick="TeamList.openModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('team.addMember')}
        </button>
      </div>

      <div class="tl-toolbar">
        <div class="tl-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="tl-search" placeholder="${t('team.searchPlaceholder')}" value="${escapeHtml(this._search)}" oninput="TeamList.setSearch(this.value)">
        </div>
        <label class="tl-toggle">
          <input type="checkbox" ${this._showInactive ? 'checked' : ''} onchange="TeamList.toggleInactive()">
          ${t('team.showInactive')}
        </label>
      </div>

      ${tableHTML}
      ${cardsHTML}
    `;
  },

  /* ── Avatar helper ── */
  _renderAvatar(m: TeamMember, size: 'sm' | 'md' = 'sm'): string {
    const sizeClass = size === 'md' ? 'tl-avatar-md' : 'tl-avatar';
    if (m.photo_data) {
      return `<img class="${sizeClass} tl-avatar-photo" src="${m.photo_data}" alt="${escapeHtml(m.name)}">`;
    }
    const initials = getInitials(m.name);
    return `<div class="${sizeClass}" style="background: #94a3b8">${initials}</div>`;
  },

  /* ── Table row ── */
  _renderRow(m: TeamMember): string {
    const inactiveClass = m.is_active ? '' : 'tl-row-inactive';
    const titleDisplay = m.title ? escapeHtml(m.title) : '<span class="tl-empty-val">—</span>';

    return `
      <tr class="${inactiveClass}" onclick="TeamList.openModal('${m.id}')">
        <td>
          <div class="tl-name-cell">
            ${this._renderAvatar(m)}
            <span class="tl-name">${escapeHtml(m.name)}</span>
          </div>
        </td>
        <td><span class="tl-title-text">${titleDisplay}</span></td>
        <td>${m.email ? `<a class="tl-email" href="mailto:${escapeHtml(m.email)}" onclick="event.stopPropagation()">${escapeHtml(m.email)}</a>` : '<span class="tl-empty-val">—</span>'}</td>
        <td>${m.phone ? `<a class="tl-phone" href="tel:${escapeHtml(m.phone)}" onclick="event.stopPropagation()">${escapeHtml(m.phone)}</a>` : '<span class="tl-empty-val">—</span>'}</td>
        <td>
          <span class="tl-status ${m.is_active ? 'tl-status-active' : 'tl-status-inactive'}">
            <span class="tl-status-dot"></span>
            ${m.is_active ? t('team.active') : t('team.inactiveStatus')}
          </span>
        </td>
        <td>
          <div class="tl-actions">
            <button class="tl-action-btn" onclick="event.stopPropagation(); TeamList.openModal('${m.id}')" title="${t('team.edit')}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${m.is_active
              ? `<button class="tl-action-btn tl-action-danger" onclick="event.stopPropagation(); TeamList.deactivate('${m.id}')" title="${t('team.deactivate')}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                </button>`
              : `<button class="tl-action-btn" onclick="event.stopPropagation(); TeamList.activate('${m.id}')" title="${t('team.activate')}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                </button>`
            }
          </div>
        </td>
      </tr>`;
  },

  /* ── Mobile card ── */
  _renderCard(m: TeamMember): string {
    return `
      <div class="tl-card ${m.is_active ? '' : 'tl-card-inactive'}" onclick="TeamList.openModal('${m.id}')">
        ${this._renderAvatar(m, 'md')}
        <div class="tl-card-body">
          <div class="tl-card-top">
            <span class="tl-card-name">${escapeHtml(m.name)}</span>
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
        (m.title || '').toLowerCase().includes(q)
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
    const isActive = member?.is_active ?? true;
    const hasPhoto = !!member?.photo_data;

    const modal = document.getElementById('team-modal');
    if (!modal) return;

    // Photo preview area
    const photoPreview = hasPhoto
      ? `<img class="tl-photo-preview" src="${member!.photo_data}" alt="Foto">`
      : `<div class="tl-photo-placeholder">
           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
             <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
             <circle cx="12" cy="7" r="4"/>
           </svg>
         </div>`;

    modal.innerHTML = `
      <div class="tl-modal" onclick="event.stopPropagation()">
        <div class="tl-modal-header">
          <h3>${isEdit ? t('team.editMember') : t('team.addMemberModal')}</h3>
          <button class="btn-icon" onclick="TeamList.closeModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="tl-modal-body">

          <div class="tl-photo-section">
            <div class="tl-photo-area" id="tl-photo-area">
              ${photoPreview}
            </div>
            <div class="tl-photo-actions">
              <label class="btn btn-sm tl-photo-upload-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                ${t('team.uploadPhoto')}
                <input type="file" id="tl-photo-input" accept="image/*" style="display:none" onchange="TeamList.onPhotoSelected(this)">
              </label>
              ${hasPhoto ? `<button class="btn btn-sm" style="color: var(--error)" onclick="TeamList.removePhoto()">${t('team.removePhoto')}</button>` : ''}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">${t('team.name')} <span style="color: var(--error)">*</span></label>
            <input class="input" type="text" id="tl-name" value="${escapeHtml(name)}" placeholder="${t('team.fullName')}">
          </div>
          <div class="form-group">
            <label class="form-label">${t('team.titleField')}</label>
            <input class="input" type="text" id="tl-title" value="${escapeHtml(title)}" placeholder="${t('team.titlePlaceholder')}" list="tl-title-suggestions">
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
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="input" type="email" id="tl-email" value="${escapeHtml(email)}" placeholder="email@peoplesdoctor.com">
            </div>
            <div class="form-group">
              <label class="form-label">${t('team.phone')}</label>
              <input class="input" type="tel" id="tl-phone" value="${escapeHtml(phone)}" placeholder="+45 ...">
            </div>
          </div>
          ${isEdit ? `
            <div class="form-group">
              <label class="tl-toggle" style="margin-top: var(--space-1)">
                <input type="checkbox" id="tl-active" ${isActive ? 'checked' : ''}>
                ${t('team.activeMember')}
              </label>
            </div>
          ` : ''}
        </div>
        <div class="tl-modal-footer">
          ${isEdit ? `<button class="btn" style="margin-right: auto; color: var(--error)" onclick="TeamList.deleteMember('${member!.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            ${t('team.delete')}
          </button>` : ''}
          <button class="btn" onclick="TeamList.closeModal()">${t('team.cancel')}</button>
          <button class="btn btn-primary" id="tl-save-btn" onclick="TeamList.save()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            ${isEdit ? t('team.saveChanges') : t('team.createMember')}
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

  /* ── Photo handling ── */
  onPhotoSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      (window as any).App.toast(t('team.photoTooLarge'), 'error');
      return;
    }

    // Preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      const area = document.getElementById('tl-photo-area');
      if (area) {
        area.innerHTML = `<img class="tl-photo-preview" src="${e.target?.result}" alt="Foto">`;
      }
    };
    reader.readAsDataURL(file);
  },

  async removePhoto(): Promise<void> {
    if (!this._editingId) return;
    try {
      await TeamAPI.deletePhoto(this._editingId);
      (window as any).App.toast(t('team.photoRemoved'), 'success');
      // Refresh modal
      this.openModal(this._editingId);
    } catch {
      (window as any).App.toast(t('team.photoRemoveFailed'), 'error');
    }
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
    const activeEl = document.getElementById('tl-active') as HTMLInputElement | null;
    const photoInput = document.getElementById('tl-photo-input') as HTMLInputElement | null;
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
    };

    if (activeEl) {
      data.is_active = activeEl.checked;
    }

    if (btn) {
      btn.innerHTML = `<span class="vp-spinner"></span> ${t('team.saving')}`;
      btn.disabled = true;
    }

    try {
      let memberId = this._editingId;

      if (memberId) {
        await TeamAPI.update(memberId, data);
      } else {
        const created = await TeamAPI.create(data);
        memberId = created.id;
      }

      // Upload photo if selected
      const photoFile = photoInput?.files?.[0];
      if (photoFile && memberId) {
        await TeamAPI.uploadPhoto(memberId, photoFile);
      }

      (window as any).App.toast(this._editingId ? t('team.updated') : t('team.created'), 'success');
      this.closeModal();
      (window as any).App.render();
    } catch (err: any) {
      if (btn) {
        btn.innerHTML = this._editingId ? t('team.saveChanges') : t('team.createMember');
        btn.disabled = false;
      }
      (window as any).App.toast(err.message || t('common.somethingWrong'), 'error');
    }
  },

  async deactivate(id: string): Promise<void> {
    if (!confirm(t('team.confirmDeactivate'))) return;
    try {
      await TeamAPI.update(id, { is_active: false });
      (window as any).App.toast(t('team.deactivated'), 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast(t('team.deactivateFailed'), 'error');
    }
  },

  async activate(id: string): Promise<void> {
    try {
      await TeamAPI.update(id, { is_active: true });
      (window as any).App.toast(t('team.activated'), 'success');
      (window as any).App.render();
    } catch {
      (window as any).App.toast(t('team.activateFailed'), 'error');
    }
  },

  async deleteMember(id: string): Promise<void> {
    if (!confirm(t('team.confirmDelete'))) return;
    try {
      await TeamAPI.delete(id);
      (window as any).App.toast(t('team.deleted'), 'success');
      this.closeModal();
      (window as any).App.render();
    } catch {
      (window as any).App.toast(t('team.deleteFailed'), 'error');
    }
  },
};

// Expose globally for onclick handlers
(window as any).TeamList = TeamList;
