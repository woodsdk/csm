/* ═══════════════════════════════════════════
   SynergyHub API Facade — Typed fetch wrappers
   ═══════════════════════════════════════════ */

import type { Task, TaskFilters, Customer, TeamMember, Shift, ShiftCreate, ShiftListener, DemoBooking, DemoBookingCreate, DemoSlot, DemoInfo, DemoJoinCreate, DemoJoinResult, TrainingItem, FaqItem, Ticket, TicketMessage, OverviewData, OnboardingUser, FeedbackData, ChurnData, ContactPayload, UserDetailData, Signal, GoogleOAuthStatus, MarketingFlow, MarketingFlowStep, MarketingSegment, MarketingSentEmail, MarketingStats, MarketingPreview, MarketingEnrollment, Announcement, CommsStats } from './types';

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

  async bulkDelete(ids: string[]): Promise<{ ok: boolean; count: number; skipped?: number; message?: string }> {
    const res = await fetch(`${API_BASE}/tasks/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error('Failed to bulk delete');
    return res.json();
  },

  async cancel(id: string, reason: string): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to cancel task');
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

  async uploadPhoto(id: string, file: File): Promise<TeamMember> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE}/team/${encodeURIComponent(id)}/photo`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) throw new Error('Failed to upload photo');
    return res.json();
  },

  async deletePhoto(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/team/${encodeURIComponent(id)}/photo`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete photo');
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

  async aiSuggest(ticketId: string, prompt: string = ''): Promise<{ suggestion?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/helpdesk/${encodeURIComponent(ticketId)}/ai-suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error('Failed to generate AI suggestion');
    return res.json();
  },
};

export const OnboardingAPI = {
  async getOverview(period = 30): Promise<OverviewData> {
    const res = await fetch(`${API_BASE}/onboarding/overview?period=${period}`);
    if (!res.ok) throw new Error('Failed to fetch overview');
    return res.json();
  },

  async getUsers(filters: { status?: string; search?: string } = {}): Promise<OnboardingUser[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    const res = await fetch(`${API_BASE}/onboarding/users${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  async getFeedback(period = 30): Promise<FeedbackData> {
    const res = await fetch(`${API_BASE}/onboarding/feedback?period=${period}`);
    if (!res.ok) throw new Error('Failed to fetch feedback');
    return res.json();
  },

  async getChurn(period = 90): Promise<ChurnData> {
    const res = await fetch(`${API_BASE}/onboarding/churn?period=${period}`);
    if (!res.ok) throw new Error('Failed to fetch churn data');
    return res.json();
  },

  async contactUser(data: ContactPayload): Promise<{ ok: boolean; ticket_id: string }> {
    const res = await fetch(`${API_BASE}/onboarding/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to send contact');
    return res.json();
  },

  async getUserTickets(userId: string): Promise<Ticket[]> {
    const res = await fetch(`${API_BASE}/onboarding/users/${encodeURIComponent(userId)}/tickets`);
    if (!res.ok) throw new Error('Failed to fetch user tickets');
    return res.json();
  },

  async generateDraft(data: { user_id: string; feedback_id?: string; prompt?: string }): Promise<{ subject?: string; body?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/onboarding/generate-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to generate draft');
    return res.json();
  },

  async getUserDetail(userId: string): Promise<UserDetailData> {
    const res = await fetch(`${API_BASE}/onboarding/users/${encodeURIComponent(userId)}/detail`);
    if (!res.ok) throw new Error('Failed to fetch user detail');
    return res.json();
  },

  async getSignals(): Promise<Signal[]> {
    const res = await fetch(`${API_BASE}/onboarding/signals`);
    if (!res.ok) throw new Error('Failed to fetch signals');
    return res.json();
  },

  async dismissSignal(signalType: string, userId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/onboarding/signals/${signalType}/${userId}/dismiss`, { method: 'POST' });
    return res.json();
  },

  async restoreSignal(signalType: string, userId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/onboarding/signals/${signalType}/${userId}/restore`, { method: 'POST' });
    return res.json();
  },
};

export const AskAPI = {
  async sendMessage(message: string, history: Array<{ role: string; content: string }>): Promise<{ response?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    return res.json();
  },
};

export const GmailAPI = {
  async syncInbox(): Promise<{ synced: number; created: number; updated: number; errors: string[] }> {
    const res = await fetch(`${API_BASE}/gmail/sync`, { method: 'POST' });
    return res.json();
  },
};

export const GoogleAuthAPI = {
  async getStatus(): Promise<GoogleOAuthStatus> {
    const res = await fetch(`${API_BASE}/google/status`);
    return res.json();
  },
  async getConnectUrl(): Promise<{ auth_url: string }> {
    const res = await fetch(`${API_BASE}/google/connect`);
    return res.json();
  },
  async disconnect(): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/google/disconnect`, { method: 'POST' });
    return res.json();
  },
};

export const MarketingAPI = {
  // ── Flows ──
  async getFlows(): Promise<MarketingFlow[]> {
    const res = await fetch(`${API_BASE}/marketing/flows`);
    if (!res.ok) throw new Error('Failed to fetch flows');
    return res.json();
  },

  async getFlow(id: string): Promise<MarketingFlow> {
    const res = await fetch(`${API_BASE}/marketing/flows/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Failed to fetch flow');
    return res.json();
  },

  async createFlow(data: { name: string; description?: string; trigger_type?: string; trigger_config?: Record<string, any>; segment_id?: string }): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE}/marketing/flows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create flow');
    return res.json();
  },

  async updateFlow(id: string, data: Partial<MarketingFlow>): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/marketing/flows/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update flow');
    return res.json();
  },

  async deleteFlow(id: string): Promise<{ ok?: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/marketing/flows/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete flow');
    return res.json();
  },

  async activateFlow(id: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/marketing/flows/${encodeURIComponent(id)}/activate`, { method: 'POST' });
    return res.json();
  },

  async pauseFlow(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/marketing/flows/${encodeURIComponent(id)}/pause`, { method: 'POST' });
    return res.json();
  },

  async cloneTemplate(templateId: string): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE}/marketing/flows/clone/${encodeURIComponent(templateId)}`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clone template');
    return res.json();
  },

  async getTemplates(): Promise<MarketingFlow[]> {
    const res = await fetch(`${API_BASE}/marketing/templates`);
    if (!res.ok) throw new Error('Failed to fetch templates');
    return res.json();
  },

  // ── Steps ──
  async addStep(flowId: string, data: { step_type: string; config: Record<string, any> }): Promise<{ id: string; step_order: number }> {
    const res = await fetch(`${API_BASE}/marketing/flows/${encodeURIComponent(flowId)}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add step');
    return res.json();
  },

  async updateStep(flowId: string, stepId: string, data: { step_type?: string; config?: Record<string, any> }): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/marketing/flows/${encodeURIComponent(flowId)}/steps/${encodeURIComponent(stepId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update step');
    return res.json();
  },

  async deleteStep(flowId: string, stepId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/marketing/flows/${encodeURIComponent(flowId)}/steps/${encodeURIComponent(stepId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete step');
    return res.json();
  },

  async previewStep(flowId: string, stepId: string): Promise<MarketingPreview & { error?: string }> {
    const res = await fetch(`${API_BASE}/marketing/flows/${encodeURIComponent(flowId)}/preview-step/${encodeURIComponent(stepId)}`, { method: 'POST' });
    return res.json();
  },

  // ── Enrollments ──
  async enrollUsers(flowId: string, userIds: string[]): Promise<{ ok: boolean; enrolled: number }> {
    const res = await fetch(`${API_BASE}/marketing/flows/${encodeURIComponent(flowId)}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: userIds }),
    });
    if (!res.ok) throw new Error('Failed to enroll users');
    return res.json();
  },

  async cancelEnrollment(enrollmentId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/marketing/enrollments/${encodeURIComponent(enrollmentId)}/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to cancel enrollment');
    return res.json();
  },

  // ── Segments ──
  async getSegments(): Promise<MarketingSegment[]> {
    const res = await fetch(`${API_BASE}/marketing/segments`);
    if (!res.ok) throw new Error('Failed to fetch segments');
    return res.json();
  },

  async getSegment(id: string): Promise<MarketingSegment> {
    const res = await fetch(`${API_BASE}/marketing/segments/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Failed to fetch segment');
    return res.json();
  },

  async createSegment(data: { name: string; description?: string; filter_rules?: Record<string, any> }): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE}/marketing/segments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create segment');
    return res.json();
  },

  async updateSegment(id: string, data: Partial<MarketingSegment>): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/marketing/segments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update segment');
    return res.json();
  },

  async deleteSegment(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/marketing/segments/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete segment');
    return res.json();
  },

  // ── History & Stats ──
  async getHistory(flowId = '', limit = 50, offset = 0): Promise<MarketingSentEmail[]> {
    const params = new URLSearchParams();
    if (flowId) params.set('flow_id', flowId);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    const res = await fetch(`${API_BASE}/marketing/history?${params}`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  async getStats(): Promise<MarketingStats> {
    const res = await fetch(`${API_BASE}/marketing/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  // ── Campaign ──
  async sendCampaign(data: { segment_id: string; brief: string; subject_hint?: string }): Promise<{ sent_count?: number; sent?: number; total_users?: number; skipped?: number; errors?: string[]; campaign_batch?: string }> {
    const res = await fetch(`${API_BASE}/marketing/send-campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to send campaign');
    return res.json();
  },

  // ── Engine Status ──
  async getEngineStatus(): Promise<{ running: boolean; pending_enrollments: number }> {
    const res = await fetch(`${API_BASE}/marketing/engine-status`);
    if (!res.ok) throw new Error('Failed to fetch engine status');
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
(window as any).OnboardingAPI = OnboardingAPI;
(window as any).AskAPI = AskAPI;
(window as any).GoogleAuthAPI = GoogleAuthAPI;
(window as any).MarketingAPI = MarketingAPI;



/* ── Platform Communication ── */

export const CommsAPI = {
  // Announcements
  async getAnnouncements(): Promise<Announcement[]> {
    const res = await fetch(`${API_BASE}/comms/announcements`);
    if (!res.ok) throw new Error('Failed to fetch announcements');
    return res.json();
  },

  async createAnnouncement(data: Partial<Announcement>): Promise<{ ok: boolean; id: string }> {
    const res = await fetch(`${API_BASE}/comms/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateAnnouncement(id: string, data: Partial<Announcement>): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/comms/announcements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteAnnouncement(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/comms/announcements/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async publishAnnouncement(id: string): Promise<{ ok: boolean; delivered_to?: number }> {
    const res = await fetch(`${API_BASE}/comms/announcements/${id}/publish`, { method: 'POST' });
    return res.json();
  },

  async getAnnouncementStats(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/comms/announcements/${id}/stats`);
    return res.json();
  },

  async getStats(): Promise<CommsStats> {
    const res = await fetch(`${API_BASE}/comms/stats`);
    return res.json();
  },

  // Platform tickets (filtered from helpdesk)
  async getPlatformTickets(): Promise<Ticket[]> {
    const res = await fetch(`${API_BASE}/helpdesk?source=platform`);
    if (!res.ok) throw new Error('Failed to fetch platform tickets');
    return res.json();
  },
};
(window as any).CommsAPI = CommsAPI;
