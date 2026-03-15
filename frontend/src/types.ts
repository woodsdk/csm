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

export type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'review' | 'done';
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
  title: string;
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
  platform_user_id: string | null;
  platform_user_name?: string;
  platform_user_email?: string;
  platform_user_clinic?: string;
  platform_user_health?: number;
  platform_user_status?: string;
  platform_user_consultations?: number;
  platform_user_avg_rating?: number | null;
  platform_user_days_since_signup?: number;
  priority_source?: string;
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
  page: 'tasks' | 'vagtplan' | 'team' | 'book-demo' | 'training' | 'helpdesk' | 'helpdesk-detail' | 'calendar' | 'onboarding' | 'user-detail' | 'ask-synergyhub' | 'settings' | 'marketing' | 'dpa';
  tab: string;
  view: 'list' | 'kanban' | 'calendar';
  filters: TaskFilters;
}

/* ── Onboarding & Retention ── */

export interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  clinic_name: string;
  speciale: string;
  status: string;
  plan: string;
  mrr: number;
  signup_at: string;
  first_consultation_at: string | null;
  last_active_at: string | null;
  churned_at: string | null;
  churn_reason: string | null;
  health_score: number;
  days_since_signup: number;
  consultation_count: number;
  avg_rating: number | null;
  review_count: number;
  latest_issue: string | null;
  ticket_count: number;
  open_ticket_count: number;
}

export interface ContactPayload {
  user_id: string;
  channel: 'email' | 'message';
  subject: string;
  body: string;
  assignee_id?: string;
}

export interface OverviewData {
  kpis: {
    total_users: number;
    active_users: number;
    inactive_users: number;
    churned_users: number;
    onboarding_users: number;
    new_this_period: number;
    churned_this_period: number;
    total_clinics: number;
    avg_time_to_value: number;
    mrr_at_risk: number;
    net_retention_rate: number;
  };
  funnel: Array<{ stage: string; label: string; count: number }>;
  daily_signups: Array<{ date: string; count: number }>;
  daily_consultations: Array<{ date: string; count: number }>;
}

export interface FeedbackData {
  avg_rating: number;
  review_count: number;
  nps_score: number;
  nps_breakdown: { promoters: number; passives: number; detractors: number };
  rating_distribution: Array<{ bucket: string; count: number }>;
  sentiments: Array<{ sentiment: string; count: number }>;
  top_themes: Array<{ theme: string; count: number }>;
  recent_reviews: Array<{
    id: string; user_id: string; user_name: string; clinic_name: string;
    rating: number; comment: string; sentiment: string; created_at: string;
  }>;
}

export interface ChurnData {
  churn_rate: number;
  avg_lifetime_days: number;
  at_risk_count: number;
  at_risk_mrr: number;
  churn_reasons: Array<{ reason: string; label: string; count: number }>;
  churn_timing: Array<{ week: string; count: number }>;
  at_risk_users: Array<OnboardingUser & { days_inactive: number }>;
}

/* ── User Detail & Signals ── */

export interface HealthBreakdown {
  total: number;
  recency: number;
  frequency: number;
  satisfaction: number;
  support: number;
}

export interface UserDetailData {
  profile: OnboardingUser & { health_breakdown: HealthBreakdown };
  consultations: Array<{ date: string; duration_minutes: number; rating: number | null }>;
  weekly_consultations: Array<{ week: string; count: number }>;
  reviews: Array<{ id: string; rating: number; comment: string; sentiment: string; created_at: string }>;
  tickets: Ticket[];
  events: Array<{ event_type: string; created_at: string }>;
  communication_log: Array<{ id: string; ticket_subject: string; body: string; sender_name: string; created_at: string }>;
}

export interface Signal {
  type: 'declining_activity' | 'stuck_onboarding' | 'negative_feedback' | 'critical_health';
  severity: 'high' | 'medium';
  user_id: string;
  user_name: string;
  clinic_name: string;
  message: string;
  created_at: string;
  feedback_id?: string;
}

/* ── Google OAuth ── */

export interface GoogleOAuthStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
  connected_at?: string;
}

/* ── Marketing & Automation ── */

export interface MarketingFlow {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  segment_id: string | null;
  status: 'draft' | 'active' | 'paused' | 'archived';
  is_template: boolean;
  created_at: string;
  updated_at: string;
  step_count?: number;
  enrollment_count?: number;
  sent_count?: number;
  steps?: MarketingFlowStep[];
  enrollments?: MarketingEnrollment[];
}

export interface MarketingFlowStep {
  id: string;
  flow_id: string;
  step_order: number;
  step_type: 'email' | 'wait' | 'condition';
  config: Record<string, any>;
}

export interface MarketingEnrollment {
  id: string;
  flow_id: string;
  user_id: string;
  current_step: number;
  status: 'active' | 'completed' | 'cancelled';
  enrolled_at: string;
  next_action_at: string | null;
  user_name?: string;
  clinic_name?: string;
  user_email?: string;
}

export interface MarketingSegment {
  id: string;
  name: string;
  description: string;
  filter_rules: Record<string, any>;
  user_count: number;
  is_preset: boolean;
  created_at: string;
  updated_at: string;
  users?: Array<{ id: string; name: string; email: string; clinic_name: string; status: string; health_score: number }>;
}

export interface MarketingSentEmail {
  id: string;
  enrollment_id: string | null;
  flow_id: string | null;
  step_id: string | null;
  user_id: string;
  to_email: string;
  subject: string;
  body_html: string;
  brief: string;
  gmail_message_id: string | null;
  sent_at: string;
  user_name?: string;
  clinic_name?: string;
  flow_name?: string;
}

export interface MarketingStats {
  total_sent: number;
  sent_this_week: number;
  active_flows: number;
  active_enrollments: number;
  per_flow: Array<{ flow_id: string; flow_name: string; sent_count: number }>;
}

export interface MarketingPreview {
  subject: string;
  body_html: string;
  preview_user: { name: string; clinic_name: string };
}

/* ── DPA (Databehandleraftale) ── */

export interface DPADocument {
  id: string;
  version: number;
  language: string;
  filename: string;
  uploaded_by: string;
  is_current: boolean;
  created_at: string;
  file_size?: number;
}

export interface DPASigning {
  id: string;
  customer_id: string;
  document_id: string;
  token: string;
  language: string;
  status: 'pending' | 'signed' | 'expired';
  signer_name: string;
  signer_email: string;
  signer_title: string;
  ip_address: string;
  user_agent: string;
  sent_at: string;
  signed_at: string | null;
  expires_at: string;
  sent_by: string;
  reminder_count: number;
  last_reminder_at: string | null;
  cs_notified: boolean;
  customer_name?: string;
  customer_email?: string;
  document_version?: number;
  document_filename?: string;
}

export interface DPAStats {
  unsigned_count: number;
  pending_count: number;
  signed_count: number;
  expired_count: number;
  needs_attention_count: number;
}

export interface DPAPendingCustomer {
  id: string;
  name: string;
  contact_name: string;
  contact_email: string;
  lifecycle: string;
  plan: string;
  dpa_signed: boolean;
  dpa_signed_at: string | null;
  latest_signing_id: string | null;
  latest_signing_status: string | null;
  latest_sent_at: string | null;
  latest_language: string | null;
}
