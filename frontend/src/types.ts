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

export interface DemoBooking {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_clinic: string;
  staff_id: string | null;
  staff_name?: string;
  meet_link: string;
  status: string;
  task_id: string | null;
  calendar_event_id: string | null;
  notes: string;
  created_at: string;
}

export interface DemoBookingCreate {
  date: string;
  start_time: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_clinic?: string;
  notes?: string;
}

export interface DemoSlot {
  start_time: string;
  end_time: string;
}

export interface DemoInfo {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  clinic: string;
  status: string;
  has_calendar_event: boolean;
  participants: DemoParticipant[];
}

export interface DemoParticipant {
  name: string;
  role: string;
  is_primary: boolean;
}

export interface DemoJoinCreate {
  name: string;
  email: string;
  role: string;
}

export interface DemoJoinResult {
  ok: boolean;
  participant_id: string;
  calendar_invite_sent: boolean;
  meet_link: string;
}

export interface TrainingItem {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  created_at: string;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  source: string;
  requester_name: string;
  requester_email: string;
  assignee_id: string | null;
  assignee_name?: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: string;
  sender_name: string;
  sender_email: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface AppState {
  page: 'tasks' | 'vagtplan' | 'team' | 'book-demo' | 'training' | 'helpdesk' | 'helpdesk-detail' | 'calendar';
  tab: string;
  view: 'list' | 'kanban' | 'calendar';
  filters: TaskFilters;
}
