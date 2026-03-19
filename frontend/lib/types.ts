// ── Enums ────────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'officer' | 'auditor';
export type ProjectStatus = 'active' | 'delayed' | 'completed' | 'suspended';
export type RiskLevel = 'green' | 'yellow' | 'red';
export type AlertType = 'no_evidence' | 'deadline_risk' | 'anomaly_spike' | 'budget_overrun';

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: User;
}

// ── Contractor ────────────────────────────────────────────────────────────────
export interface Contractor {
  id: string;
  name: string;
  registration_no?: string;
  contact_email?: string;
  total_projects: number;
  completed_projects: number;
  avg_delay_days: number;
  risk_score: number;
  created_at?: string;
}

// ── Milestone ─────────────────────────────────────────────────────────────────
export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  due_date: string;
  completion_date?: string;
  is_completed: boolean;
  weight_percent: number;
  order_index: number;
}

// ── Project ───────────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  description?: string;
  state: string;
  district?: string;
  latitude: number;
  longitude: number;
  budget: number;
  spent_amount: number;
  start_date: string;
  deadline: string;
  progress_percent: number;
  status: ProjectStatus;
  risk_score: number;
  risk_level: RiskLevel;
  contractor?: Contractor;
  milestones: Milestone[];
  required_evidence_types: string[];
  created_at?: string;
}

export interface ProjectMapPoint {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  risk_score: number;
  risk_level: RiskLevel;
  status: ProjectStatus;
  progress_percent: number;
  budget: number;
}

// ── Evidence ──────────────────────────────────────────────────────────────────
export interface Evidence {
  id: string;
  project_id: string;
  milestone_id?: string;
  file_name: string;
  file_type?: string;
  file_url: string;
  sha256_hash: string;
  exif_latitude?: number;
  exif_longitude?: number;
  exif_timestamp?: string;
  location_verified: boolean;
  verification_distance_m?: number;
  notes?: string;
  is_valid: boolean;
  rejection_reason?: string;
  created_at?: string;
}

// ── Risk ──────────────────────────────────────────────────────────────────────
export interface RiskFactors {
  timeline_score: number;
  evidence_frequency_score: number;
  budget_utilization_score: number;
  milestone_completion_score: number;
  contractor_history_score: number;
}

export interface RiskResponse {
  project_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  factors: RiskFactors;
  calculated_at: string;
}

export interface RiskHistoryPoint {
  id: string;
  risk_score: number;
  risk_level: RiskLevel;
  factors?: Record<string, number>;
  calculated_at: string;
}

// ── Alert ─────────────────────────────────────────────────────────────────────
export interface Alert {
  id: string;
  project_id: string;
  alert_type: AlertType;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  is_resolved: boolean;
  created_at?: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardStats {
  total_projects: number;
  active_projects: number;
  high_risk_projects: number;
  delayed_projects: number;
  avg_delay_percent: number;
  total_budget: number;
  integrity_score: number;
  national_risk_score: number;
}

// ── WebSocket Events ──────────────────────────────────────────────────────────
export interface WSEvent {
  type: 'risk_update' | 'evidence_uploaded' | 'project_created' | 'simulation_failure' | 'ping';
  payload: Record<string, unknown>;
}
