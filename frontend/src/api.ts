/* ═══════════════════════════════════════════
   SynergyHub API Facade — Typed fetch wrappers
   ═══════════════════════════════════════════ */

import type { Task, TaskFilters, Customer, TeamMember } from './types';

const API_BASE = '/api';

export const TaskAPI = {
  async getAll(filters: TaskFilters = {}): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters.tab) params.set('tab', filters.tab);
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

  async get(id: string): Promise<Task | null> {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  },

  async create(data: Partial<Task>): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },

  async update(id: string, data: Partial<Task>): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
  },

  async delete(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete task');
    return res.json();
  },

  async reorder(ids: string[]): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/tasks/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error('Failed to reorder tasks');
    return res.json();
  },

  async duplicate(id: string): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to duplicate task');
    return res.json();
  },

  async bulkUpdate(ids: string[], data: Partial<Task>): Promise<Task[]> {
    const res = await fetch(`${API_BASE}/tasks/bulk-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, data }),
    });
    if (!res.ok) throw new Error('Failed to bulk update');
    return res.json();
  },

  async bulkDelete(ids: string[]): Promise<{ ok: boolean; count: number }> {
    const res = await fetch(`${API_BASE}/tasks/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error('Failed to bulk delete');
    return res.json();
  },
};

export const CustomerAPI = {
  async getAll(): Promise<Customer[]> {
    const res = await fetch(`${API_BASE}/customers`);
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },

  async get(id: string): Promise<Customer | null> {
    const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  },

  async create(data: Partial<Customer>): Promise<Customer> {
    const res = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create customer');
    return res.json();
  },

  async update(id: string, data: Partial<Customer>): Promise<Customer> {
    const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update customer');
    return res.json();
  },
};

export const TeamAPI = {
  async getAll(): Promise<TeamMember[]> {
    const res = await fetch(`${API_BASE}/team`);
    if (!res.ok) throw new Error('Failed to fetch team');
    return res.json();
  },
};

// Expose globally for inline onclick handlers
(window as any).TaskAPI = TaskAPI;
(window as any).CustomerAPI = CustomerAPI;
(window as any).TeamAPI = TeamAPI;
