/* ═══════════════════════════════════════════
   SynergyHub API Facade

   Migration point: now uses REST API (PostgreSQL)
   UI code calls ONLY TaskAPI/CustomerAPI methods.
   All methods return Promises (async-ready).
   ═══════════════════════════════════════════ */

const API_BASE = '/api';

const TaskAPI = {
  async getAll(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.type) params.set('type', filters.type);
    if (filters.assignee_id) params.set('assignee_id', filters.assignee_id);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    const res = await fetch(`${API_BASE}/tasks${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async get(id) {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  },

  async create(data) {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },

  async update(id, data) {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
  },

  async delete(id) {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete task');
    return res.json();
  }
};

const CustomerAPI = {
  async getAll() {
    const res = await fetch(`${API_BASE}/customers`);
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },

  async get(id) {
    const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  },

  async create(data) {
    const res = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create customer');
    return res.json();
  },

  async update(id, data) {
    const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update customer');
    return res.json();
  }
};

const TeamAPI = {
  async getAll() {
    const res = await fetch(`${API_BASE}/team`);
    if (!res.ok) throw new Error('Failed to fetch team');
    return res.json();
  }
};
