/* ═══════════════════════════════════════════
   SynergyHub Type Definitions
   ═══════════════════════════════════════════ */

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  tags: string[];
  checklist: ChecklistItem[];
  assignee_id: string | null;
  created_by: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  customer_id: string | null;
  customer_name: string;
  ticket_ref: string | null;
  calendar_event_id: string | null;
  parent_task_id: string | null;
  sort_order: number;
  is_archived: boolean;
  tab: string;
}

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskType = 'onboarding' | 'support' | 'bug' | 'feature-request' | 'cs-followup' | 'internal';

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface TaskFilters {
  tab?: string;
  search?: string;
  status?: string;
  priority?: string;
  type?: string;
  assignee_id?: string;
}

export interface Customer {
  id: string;
  name: string;
  segment: string;
  lifecycle: string;
  contact_name: string;
  contact_email: string;
  plan: string;
  licenses_total: number;
  licenses_used: number;
  mrr: number;
  dpa_signed: boolean;
  dpa_signed_at: string | null;
  onboarding_started_at: string | null;
  go_live_at: string | null;
  last_active_at: string | null;
  consultations_this_month: number | null;
  health_score: number | null;
  created_at: string;
  notes: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar_color: string;
  is_active: boolean;
  email: string;
  phone: string;
}

export interface ActivityLogEntry {
  id: string;
  task_id: string;
  action: string;
  actor_id: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  isAllDay: boolean;
  date: string;
  attendees: Array<{ email: string; name: string; status: string }>;
  organizer: string;
  htmlLink: string;
  status: string;
  color: string | null;
}

export interface ShiftListener {
  id: string;
  shift_id: string;
  listener_name: string;
  listener_email: string;
  listener_phone: string;
  created_at: string;
}

export interface Shift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  staff_name: string;
  staff_email: string;
  staff_phone: string;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  listeners?: ShiftListener[];
}

export interface ShiftSlot {
  start: string;
  end: string;
  label: string;
}

export interface ShiftCreate {
  date: string;
  start_time: string;
  end_time: string;
  staff_name: string;
  staff_email: string;
  staff_phone?: string;
}

export interface AppState {
  page: 'tasks' | 'vagtplan' | 'team';
  tab: string;
  view: 'list' | 'kanban' | 'calendar';
  filters: TaskFilters;
}
