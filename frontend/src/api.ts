/* ═══════════════════════════════════════════
   SynergyHub API Facade — Typed fetch wrappers
   ═══════════════════════════════════════════ */

import type { Task, TaskFilters, Customer, TeamMember, Shift, ShiftCreate, ShiftListener, DemoBooking, DemoBookingCreate, DemoSlot, DemoInfo, DemoJoinCreate, DemoJoinResult, TrainingItem, FaqItem, Ticket, TicketMessage } from './types';

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
  async getAll(includeInactive = false): Promise<TeamMember[]> {
    const qs = includeInactive ? '?include_inactive=true' : '';
    const res = await fetch(`${API_BASE}/team${qs}`);
    if (!res.ok) throw new Error('Failed to fetch team');
    return res.json();
  },

  async get(id: string): Promise<TeamMember | null> {
    const res = await fetch(`${API_BASE}/team/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  },

  async create(data: Partial<TeamMember>): Promise<TeamMember> {
    const res = await fetch(`${API_BASE}/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create team member');
    return res.json();
  },

  async update(id: string, data: Partial<TeamMember>): Promise<TeamMember> {
    const res = await fetch(`${API_BASE}/team/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update team member');
    return res.json();
  },

  async delete(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/team/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete team member');
    return res.json();
  },
};

export const ShiftAPI = {
  async getByDateRange(fromDate: string, toDate: string): Promise<Shift[]> {
    const res = await fetch(`${API_BASE}/shifts?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`);
    if (!res.ok) throw new Error('Failed to fetch shifts');
    return res.json();
  },

  async create(data: ShiftCreate): Promise<Shift> {
    const res = await fetch(`${API_BASE}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create shift' }));
      throw new Error(err.detail || 'Failed to create shift');
    }
    return res.json();
  },

  async cancel(shiftId: string): Promise<Shift> {
    const res = await fetch(`${API_BASE}/shifts/${encodeURIComponent(shiftId)}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to cancel shift');
    return res.json();
  },

  async addListener(shiftId: string, data: { listener_name: string; listener_email: string; listener_phone?: string }): Promise<ShiftListener> {
    const res = await fetch(`${API_BASE}/shifts/${encodeURIComponent(shiftId)}/listeners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add listener');
    return res.json();
  },

  async removeListener(shiftId: string, listenerId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/shifts/${encodeURIComponent(shiftId)}/listeners/${encodeURIComponent(listenerId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove listener');
    return res.json();
  },
};

export const DemoAPI = {
  async getAvailableDates(): Promise<string[]> {
    const res = await fetch(`${API_BASE}/demos/available-dates`);
    if (!res.ok) throw new Error('Failed to fetch available dates');
    return res.json();
  },

  async getAvailableSlots(date: string): Promise<DemoSlot[]> {
    const res = await fetch(`${API_BASE}/demos/available-slots?date=${encodeURIComponent(date)}`);
    if (!res.ok) throw new Error('Failed to fetch available slots');
    return res.json();
  },

  async book(data: DemoBookingCreate): Promise<DemoBooking> {
    const res = await fetch(`${API_BASE}/demos/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Booking fejlede' }));
      throw new Error(err.error || 'Booking fejlede');
    }
    return res.json();
  },

  async getInfo(bookingId: string): Promise<DemoInfo> {
    const res = await fetch(`${API_BASE}/demos/${encodeURIComponent(bookingId)}/info`);
    if (!res.ok) throw new Error('Kunne ikke hente booking-info');
    return res.json();
  },

  async join(bookingId: string, data: DemoJoinCreate): Promise<DemoJoinResult> {
    const res = await fetch(`${API_BASE}/demos/${encodeURIComponent(bookingId)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Tilmelding fejlede' }));
      throw new Error(err.error || 'Tilmelding fejlede');
    }
    return res.json();
  },
};

export const TrainingAPI = {
  async getAll(): Promise<TrainingItem[]> {
    const res = await fetch(`${API_BASE}/training`);
    if (!res.ok) throw new Error('Failed to fetch training items');
    return res.json();
  },

  async create(data: { title: string; description?: string }): Promise<TrainingItem> {
    const res = await fetch(`${API_BASE}/training`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create training item');
    return res.json();
  },

  async update(id: string, data: { title?: string; description?: string }): Promise<TrainingItem> {
    const res = await fetch(`${API_BASE}/training/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update training item');
    return res.json();
  },

  async delete(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/training/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete training item');
    return res.json();
  },

  async reorder(ids: string[]): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/training/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error('Failed to reorder training items');
    return res.json();
  },
};

export const FaqAPI = {
  async getAll(): Promise<FaqItem[]> {
    const res = await fetch(`${API_BASE}/faq`);
    if (!res.ok) throw new Error('Failed to fetch FAQ items');
    return res.json();
  },

  async create(data: { question: string; answer: string; category?: string }): Promise<FaqItem> {
    const res = await fetch(`${API_BASE}/faq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create FAQ item');
    return res.json();
  },

  async update(id: string, data: { question?: string; answer?: string; category?: string }): Promise<FaqItem> {
    const res = await fetch(`${API_BASE}/faq/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update FAQ item');
    return res.json();
  },

  async delete(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/faq/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete FAQ item');
    return res.json();
  },
};

export const HelpdeskAPI = {
  async getAll(filters: { status?: string; priority?: string; assignee_id?: string } = {}): Promise<Ticket[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.assignee_id) params.set('assignee_id', filters.assignee_id);
    const qs = params.toString();
    const res = await fetch(`${API_BASE}/helpdesk${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error('Failed to fetch tickets');
    return res.json();
  },

  async get(id: string): Promise<Ticket & { messages: TicketMessage[] }> {
    const res = await fetch(`${API_BASE}/helpdesk/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Failed to fetch ticket');
    return res.json();
  },

  async create(data: Partial<Ticket>): Promise<Ticket> {
    const res = await fetch(`${API_BASE}/helpdesk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create ticket');
    return res.json();
  },

  async update(id: string, data: Partial<Ticket>): Promise<Ticket> {
    const res = await fetch(`${API_BASE}/helpdesk/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update ticket');
    return res.json();
  },

  async addMessage(ticketId: string, data: Partial<TicketMessage>): Promise<TicketMessage> {
    const res = await fetch(`${API_BASE}/helpdesk/${encodeURIComponent(ticketId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add message');
    return res.json();
  },

  async getStats(): Promise<{ open_count: number; in_progress_count: number; resolved_count: number; closed_count: number; total: number }> {
    const res = await fetch(`${API_BASE}/helpdesk/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async aiSuggest(ticketId: string): Promise<{ suggestion?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/helpdesk/${encodeURIComponent(ticketId)}/ai-suggest`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to generate AI suggestion');
    return res.json();
  },
};

// Expose globally for inline onclick handlers
(window as any).TaskAPI = TaskAPI;
(window as any).CustomerAPI = CustomerAPI;
(window as any).TeamAPI = TeamAPI;
(window as any).ShiftAPI = ShiftAPI;
(window as any).DemoAPI = DemoAPI;
(window as any).TrainingAPI = TrainingAPI;
(window as any).FaqAPI = FaqAPI;
(window as any).HelpdeskAPI = HelpdeskAPI;
