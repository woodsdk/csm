/* ═══════════════════════════════════════════
   Task Modal — Create / Edit / Delete
   ═══════════════════════════════════════════ */

const TaskModal = {
  _el: null,
  _onSave: null,

  init() {
    this._el = document.getElementById('task-modal');
    // Close on backdrop click
    this._el.addEventListener('click', (e) => {
      if (e.target === this._el) this.close();
    });
    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._el.classList.contains('open')) this.close();
    });
  },

  async open(taskId = null) {
    const members = await TeamAPI.getAll();
    const task = taskId ? await TaskAPI.get(taskId) : null;
    const isEdit = !!task;

    this._el.innerHTML = `
      <div class="modal-panel">
        <div class="modal-header">
          <h3>${isEdit ? 'Rediger opgave' : 'Ny opgave'}</h3>
          <button class="btn-icon" onclick="TaskModal.close()" aria-label="Luk">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="task-title">Titel</label>
            <input class="input" id="task-title" type="text" placeholder="Opgavenavn..." value="${isEdit ? this._esc(task.title) : ''}" autofocus>
          </div>

          <div class="form-group">
            <label class="form-label" for="task-desc">Beskrivelse</label>
            <textarea class="textarea" id="task-desc" placeholder="Detaljer...">${isEdit ? this._esc(task.description) : ''}</textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="task-status">Status</label>
              <select class="select" id="task-status">
                <option value="todo" ${isEdit && task.status === 'todo' ? 'selected' : ''}>To Do</option>
                <option value="in-progress" ${isEdit && task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="review" ${isEdit && task.status === 'review' ? 'selected' : ''}>Review</option>
                <option value="done" ${isEdit && task.status === 'done' ? 'selected' : ''}>Done</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="task-priority">Prioritet</label>
              <select class="select" id="task-priority">
                <option value="low" ${isEdit && task.priority === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${(!isEdit || task.priority === 'medium') ? 'selected' : ''}>Medium</option>
                <option value="high" ${isEdit && task.priority === 'high' ? 'selected' : ''}>High</option>
                <option value="critical" ${isEdit && task.priority === 'critical' ? 'selected' : ''}>Critical</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="task-type">Type</label>
              <select class="select" id="task-type">
                <option value="onboarding" ${isEdit && task.type === 'onboarding' ? 'selected' : ''}>Onboarding</option>
                <option value="support" ${isEdit && task.type === 'support' ? 'selected' : ''}>Support</option>
                <option value="bug" ${isEdit && task.type === 'bug' ? 'selected' : ''}>Bug</option>
                <option value="feature-request" ${isEdit && task.type === 'feature-request' ? 'selected' : ''}>Feature Request</option>
                <option value="cs-followup" ${isEdit && task.type === 'cs-followup' ? 'selected' : ''}>CS Follow-up</option>
                <option value="internal" ${(!isEdit || task.type === 'internal') ? 'selected' : ''}>Internal</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="task-assignee">Ansvarlig</label>
              <select class="select" id="task-assignee">
                <option value="">Ikke tildelt</option>
                ${members.map(m => `<option value="${m.id}" ${isEdit && task.assignee_id === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="task-deadline">Deadline</label>
            <input class="input" id="task-deadline" type="date" value="${isEdit && task.deadline ? task.deadline : ''}">
          </div>

          <div class="form-group">
            <label class="form-label" for="task-tags">Tags (kommasepareret)</label>
            <input class="input" id="task-tags" type="text" placeholder="plo, pilot, urgent..." value="${isEdit && task.tags ? task.tags.join(', ') : ''}">
          </div>
        </div>
        <div class="modal-footer">
          ${isEdit ? '<button class="btn btn-danger" onclick="TaskModal.delete()">Slet</button>' : '<span></span>'}
          <div class="modal-footer-actions">
            <button class="btn" onclick="TaskModal.close()">Annuller</button>
            <button class="btn btn-primary" onclick="TaskModal.save()">Gem</button>
          </div>
        </div>
      </div>
    `;

    this._el.dataset.taskId = taskId || '';
    this._el.classList.add('open');

    // Focus title
    requestAnimationFrame(() => {
      const titleInput = document.getElementById('task-title');
      if (titleInput) titleInput.focus();
    });
  },

  async save() {
    const title = document.getElementById('task-title').value.trim();
    if (!title) {
      document.getElementById('task-title').style.borderColor = 'var(--error)';
      return;
    }

    const tagsRaw = document.getElementById('task-tags').value;
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    const data = {
      title,
      description: document.getElementById('task-desc').value.trim(),
      status: document.getElementById('task-status').value,
      priority: document.getElementById('task-priority').value,
      type: document.getElementById('task-type').value,
      assignee_id: document.getElementById('task-assignee').value || null,
      deadline: document.getElementById('task-deadline').value || null,
      tags
    };

    const taskId = this._el.dataset.taskId;
    if (taskId) {
      await TaskAPI.update(taskId, data);
      App.toast('Opgave opdateret', 'success');
    } else {
      data.tab = App.state.tab;
      await TaskAPI.create(data);
      App.toast('Opgave oprettet', 'success');
    }

    this.close();
    App.render();
  },

  async delete() {
    const taskId = this._el.dataset.taskId;
    if (!taskId) return;
    if (!confirm('Er du sikker? Denne handling kan ikke fortrydes.')) return;

    await TaskAPI.delete(taskId);
    App.toast('Opgave slettet', 'info');
    this.close();
    App.render();
  },

  close() {
    this._el.classList.remove('open');
    this._el.dataset.taskId = '';
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};
