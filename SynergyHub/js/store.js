/* ═══════════════════════════════════════════
   SynergyHub Store — localStorage Data Layer
   Pattern: Lisn store.js (same CRUD interface)
   ═══════════════════════════════════════════ */

const Store = {
  _prefix: 'synergy_',

  // ── Helpers ──

  _get(key, fallback = null) {
    try {
      const v = localStorage.getItem(`${this._prefix}${key}`);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },

  _set(key, value) {
    localStorage.setItem(`${this._prefix}${key}`, JSON.stringify(value));
  },

  _id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  // ── Tasks ──

  getTasks() {
    return this._get('tasks', []).filter(t => !t.is_archived);
  },

  getAllTasks() {
    return this._get('tasks', []);
  },

  getTask(id) {
    return this._get('tasks', []).find(t => t.id === id) || null;
  },

  createTask(data) {
    const tasks = this._get('tasks', []);
    const task = {
      id: 't_' + this._id(),
      title: data.title || '',
      description: data.description || '',
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      type: data.type || 'internal',
      tags: data.tags || [],
      assignee_id: data.assignee_id || null,
      created_by: data.created_by || null,
      deadline: data.deadline || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      customer_id: data.customer_id || null,
      customer_name: data.customer_name || '',
      ticket_ref: null,
      calendar_event_id: null,
      parent_task_id: null,
      sort_order: tasks.length,
      is_archived: false
    };
    tasks.unshift(task);
    this._set('tasks', tasks);
    this._addActivity(task.id, 'created', null, null, task.created_by);
    return task;
  },

  updateTask(id, data) {
    const tasks = this._get('tasks', []);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const old = { ...tasks[idx] };

    // Merge data
    for (const key of Object.keys(data)) {
      if (data[key] !== undefined) tasks[idx][key] = data[key];
    }
    tasks[idx].updated_at = new Date().toISOString();

    // Track completion
    if (data.status === 'done' && old.status !== 'done') {
      tasks[idx].completed_at = new Date().toISOString();
    } else if (data.status && data.status !== 'done') {
      tasks[idx].completed_at = null;
    }

    this._set('tasks', tasks);

    // Log status changes
    if (data.status && data.status !== old.status) {
      this._addActivity(id, 'status_changed', old.status, data.status);
    }
    if (data.assignee_id && data.assignee_id !== old.assignee_id) {
      this._addActivity(id, 'assigned', old.assignee_id, data.assignee_id);
    }

    return tasks[idx];
  },

  deleteTask(id) {
    const tasks = this._get('tasks', []).filter(t => t.id !== id);
    this._set('tasks', tasks);
    this._addActivity(id, 'deleted', null, null);
  },

  // ── Customers ──

  getCustomers() {
    return this._get('customers', []);
  },

  getCustomer(id) {
    return this._get('customers', []).find(c => c.id === id) || null;
  },

  createCustomer(data) {
    const customers = this._get('customers', []);
    const customer = {
      id: 'cust_' + this._id(),
      name: data.name || '',
      segment: data.segment || 'direct',
      lifecycle: data.lifecycle || 'lead',
      contact_name: data.contact_name || '',
      contact_email: data.contact_email || '',
      plan: data.plan || 'freemium',
      licenses_total: data.licenses_total || 0,
      licenses_used: data.licenses_used || 0,
      mrr: data.mrr || 0,
      dpa_signed: data.dpa_signed || false,
      dpa_signed_at: data.dpa_signed_at || null,
      onboarding_started_at: data.onboarding_started_at || null,
      go_live_at: data.go_live_at || null,
      last_active_at: null,
      consultations_this_month: null,
      health_score: null,
      created_at: new Date().toISOString(),
      notes: data.notes || ''
    };
    customers.push(customer);
    this._set('customers', customers);
    return customer;
  },

  updateCustomer(id, data) {
    const customers = this._get('customers', []);
    const idx = customers.findIndex(c => c.id === id);
    if (idx === -1) return null;
    for (const key of Object.keys(data)) {
      if (data[key] !== undefined) customers[idx][key] = data[key];
    }
    this._set('customers', customers);
    return customers[idx];
  },

  // ── Team Members ──

  getTeamMembers() {
    return this._get('team_members', []).filter(m => m.is_active);
  },

  // ── Activity Log ──

  getActivities(taskId) {
    return this._get('activity_log', []).filter(a => a.task_id === taskId);
  },

  _addActivity(taskId, action, oldValue, newValue, actorId = null) {
    const log = this._get('activity_log', []);
    log.unshift({
      id: 'a_' + this._id(),
      task_id: taskId,
      action,
      actor_id: actorId,
      old_value: oldValue,
      new_value: newValue,
      created_at: new Date().toISOString()
    });
    this._set('activity_log', log.slice(0, 500));
  },

  // ── Seed Data ──

  seedIfEmpty() {
    if (this._get('tasks', []).length > 0) return;

    // Team members
    this._set('team_members', [
      { id: 'morten', name: 'Morten', role: 'lead', avatar_color: '#38456D', is_active: true },
      { id: 'shubi', name: 'Shubi', role: 'support', avatar_color: '#5669A4', is_active: true },
      { id: 'simon', name: 'Simon', role: 'cs', avatar_color: '#22C55E', is_active: true }
    ]);

    // Customers
    const customers = [
      {
        id: 'cust_1', name: 'Klinik Vesterbro', segment: 'plo', lifecycle: 'onboarding',
        contact_name: 'Dr. Hansen', contact_email: 'hansen@klinikvb.dk',
        plan: 'premium', licenses_total: 8, licenses_used: 5, mrr: 3992,
        dpa_signed: true, dpa_signed_at: '2026-03-01',
        onboarding_started_at: '2026-03-05', go_live_at: null,
        last_active_at: null, consultations_this_month: null, health_score: null,
        created_at: '2026-03-01T00:00:00Z',
        notes: '6-læge praksis i Valby. Interesseret i klinikdrift-dashboard.'
      },
      {
        id: 'cust_2', name: 'Sundhedshuset Amager', segment: 'vores-klinik', lifecycle: 'active',
        contact_name: 'Dr. Pedersen', contact_email: 'info@sundhedshusetamager.dk',
        plan: 'freemium', licenses_total: 4, licenses_used: 4, mrr: 0,
        dpa_signed: true, dpa_signed_at: '2026-02-15',
        onboarding_started_at: '2026-02-15', go_live_at: '2026-02-20',
        last_active_at: '2026-03-12', consultations_this_month: 87, health_score: 82,
        created_at: '2026-02-10T00:00:00Z',
        notes: 'Freemium bruger. Potentiel upsell til premium.'
      },
      {
        id: 'cust_3', name: 'Lægehuset Nørrebro', segment: 'cgm-xmo', lifecycle: 'trial',
        contact_name: 'Dr. Jensen', contact_email: 'jensen@laegehuset-n.dk',
        plan: 'premium', licenses_total: 12, licenses_used: 3, mrr: 0,
        dpa_signed: false, dpa_signed_at: null,
        onboarding_started_at: null, go_live_at: null,
        last_active_at: '2026-03-11', consultations_this_month: 12, health_score: 45,
        created_at: '2026-03-08T00:00:00Z',
        notes: '12-læge praksis. CGM XMO integration. Trial startet 8/3.'
      },
      {
        id: 'cust_4', name: 'Rosengård Lægepraksis', segment: 'plo', lifecycle: 'lead',
        contact_name: 'Dr. Nielsen', contact_email: 'nielsen@rosengaard.dk',
        plan: 'freemium', licenses_total: 0, licenses_used: 0, mrr: 0,
        dpa_signed: false, dpa_signed_at: null,
        onboarding_started_at: null, go_live_at: null,
        last_active_at: null, consultations_this_month: null, health_score: null,
        created_at: '2026-03-10T00:00:00Z',
        notes: 'Kontaktet via PLO netværk. Afventer demo.'
      }
    ];
    this._set('customers', customers);

    // Tasks
    const tasks = [
      {
        id: 't_seed1', title: 'Onboard Klinik Vesterbro \u2014 DPA + demo',
        description: 'DPA underskrevet 1/3. Demo booket torsdag kl. 14:00. Forbered credentials og klinik-setup i admin.',
        status: 'in-progress', priority: 'high', type: 'onboarding',
        tags: ['plo', 'pilot'], assignee_id: 'simon', created_by: 'morten',
        deadline: '2026-03-20',
        created_at: '2026-03-05T09:00:00Z', updated_at: '2026-03-12T14:00:00Z', completed_at: null,
        customer_id: 'cust_1', customer_name: 'Klinik Vesterbro',
        ticket_ref: null, calendar_event_id: null, parent_task_id: null,
        sort_order: 0, is_archived: false
      },
      {
        id: 't_seed2', title: 'Fix login-fejl for Sundhedshuset Amager',
        description: 'Bruger rapporterer 403-fejl ved login. Tjek RBAC og session-token.',
        status: 'todo', priority: 'critical', type: 'bug',
        tags: ['urgent'], assignee_id: 'shubi', created_by: 'shubi',
        deadline: '2026-03-14',
        created_at: '2026-03-13T08:00:00Z', updated_at: '2026-03-13T08:00:00Z', completed_at: null,
        customer_id: 'cust_2', customer_name: 'Sundhedshuset Amager',
        ticket_ref: null, calendar_event_id: null, parent_task_id: null,
        sort_order: 1, is_archived: false
      },
      {
        id: 't_seed3', title: 'Forbered Q1 kunderapport',
        description: 'Aggregér usage data, satisfaction scores og churn metrics for Q1. Klar til board-meeting.',
        status: 'review', priority: 'medium', type: 'internal',
        tags: ['rapport', 'q1'], assignee_id: 'morten', created_by: 'morten',
        deadline: '2026-03-31',
        created_at: '2026-03-10T10:00:00Z', updated_at: '2026-03-12T16:00:00Z', completed_at: null,
        customer_id: null, customer_name: '',
        ticket_ref: null, calendar_event_id: null, parent_task_id: null,
        sort_order: 2, is_archived: false
      },
      {
        id: 't_seed4', title: 'Følg op på Lægehuset Nørrebro trial',
        description: 'Kun 3 af 12 licenser aktiveret. Ring og hør hvordan det går med CGM XMO integrationen.',
        status: 'todo', priority: 'medium', type: 'cs-followup',
        tags: ['cgm-xmo', 'adoption'], assignee_id: 'simon', created_by: 'simon',
        deadline: '2026-03-18',
        created_at: '2026-03-11T11:00:00Z', updated_at: '2026-03-11T11:00:00Z', completed_at: null,
        customer_id: 'cust_3', customer_name: 'Lægehuset Nørrebro',
        ticket_ref: null, calendar_event_id: null, parent_task_id: null,
        sort_order: 3, is_archived: false
      },
      {
        id: 't_seed5', title: 'PLO pilot-evaluering \u2014 50 brugere',
        description: 'Forbered evalueringsrapport for PLO pilot. 70% kvalitet / 30% pris scoring. Deadline for submission.',
        status: 'todo', priority: 'high', type: 'onboarding',
        tags: ['plo', 'tender', 'pilot'], assignee_id: 'morten', created_by: 'morten',
        deadline: '2026-03-25',
        created_at: '2026-03-08T09:00:00Z', updated_at: '2026-03-08T09:00:00Z', completed_at: null,
        customer_id: null, customer_name: '',
        ticket_ref: null, calendar_event_id: null, parent_task_id: null,
        sort_order: 4, is_archived: false
      },
      {
        id: 't_seed6', title: 'Opdater onboarding-guide til CGM XMO',
        description: 'Tilføj screenshots af nye CGM XMO integration steps. Opdater FAQ-sektion.',
        status: 'done', priority: 'low', type: 'internal',
        tags: ['docs', 'cgm-xmo'], assignee_id: 'shubi', created_by: 'morten',
        deadline: '2026-03-12',
        created_at: '2026-03-06T10:00:00Z', updated_at: '2026-03-12T15:00:00Z',
        completed_at: '2026-03-12T15:00:00Z',
        customer_id: null, customer_name: '',
        ticket_ref: null, calendar_event_id: null, parent_task_id: null,
        sort_order: 5, is_archived: false
      }
    ];
    this._set('tasks', tasks);
  },

  // ── Reset ──

  clearAll() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this._prefix));
    keys.forEach(k => localStorage.removeItem(k));
  }
};
