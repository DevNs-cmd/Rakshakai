from pydantic import BaseModel, EmailStr, validator, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from enum import Enum

# ── Enums ──────────────────────────────────────────────────────────────────────
class UserRole(str, Enum):
    ADMIN = "admin"
    OFFICER = "officer"
    AUDITOR = "auditor"

class ProjectStatus(str, Enum):
    ACTIVE = "active"
    DELAYED = "delayed"
    COMPLETED = "completed"
    SUSPENDED = "suspended"

class RiskLevel(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"

class AlertType(str, Enum):
    NO_EVIDENCE = "no_evidence"
    DEADLINE_RISK = "deadline_risk"
    ANOMALY_SPIKE = "anomaly_spike"
    BUDGET_OVERRUN = "budget_overrun"

# ── Auth ───────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"

class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.OFFICER
    department: Optional[str] = None

# ── User ───────────────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    department: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ── Contractor ─────────────────────────────────────────────────────────────────
class ContractorCreate(BaseModel):
    name: str
    registration_no: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None

class ContractorOut(BaseModel):
    id: str
    name: str
    registration_no: Optional[str] = None
    contact_email: Optional[str] = None
    total_projects: int
    completed_projects: int
    avg_delay_days: float
    risk_score: float
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ── Milestone ──────────────────────────────────────────────────────────────────
class MilestoneCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: datetime
    weight_percent: float = 10.0
    order_index: int = 0

class MilestoneOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    due_date: datetime
    completion_date: Optional[datetime] = None
    is_completed: bool
    weight_percent: float
    order_index: int

    class Config:
        from_attributes = True

class MilestoneUpdate(BaseModel):
    is_completed: Optional[bool] = None
    completion_date: Optional[datetime] = None

# ── Project ────────────────────────────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    state: str
    district: Optional[str] = None
    latitude: float
    longitude: float
    radius_meters: float = 500.0
    budget: float
    start_date: datetime
    deadline: datetime
    contractor_id: Optional[str] = None
    required_evidence_types: List[str] = []

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    progress_percent: Optional[float] = None
    status: Optional[ProjectStatus] = None
    spent_amount: Optional[float] = None

class ProjectOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    state: str
    district: Optional[str] = None
    latitude: float
    longitude: float
    budget: float
    spent_amount: float
    start_date: datetime
    deadline: datetime
    progress_percent: float
    status: ProjectStatus
    risk_score: float
    risk_level: RiskLevel
    contractor: Optional[ContractorOut] = None
    milestones: List[MilestoneOut] = []
    required_evidence_types: List[str] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ProjectMapOut(BaseModel):
    id: str
    name: str
    state: str
    latitude: float
    longitude: float
    risk_score: float
    risk_level: RiskLevel
    status: ProjectStatus
    progress_percent: float
    budget: float

    class Config:
        from_attributes = True

# ── Evidence ───────────────────────────────────────────────────────────────────
class EvidenceOut(BaseModel):
    id: str
    project_id: str
    milestone_id: Optional[str] = None
    file_name: str
    file_type: Optional[str] = None
    file_url: str
    sha256_hash: str
    exif_latitude: Optional[float] = None
    exif_longitude: Optional[float] = None
    exif_timestamp: Optional[datetime] = None
    location_verified: bool
    verification_distance_m: Optional[float] = None
    notes: Optional[str] = None
    is_valid: bool
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ── Risk ───────────────────────────────────────────────────────────────────────
class RiskFactors(BaseModel):
    timeline_score: float
    evidence_frequency_score: float
    budget_utilization_score: float
    milestone_completion_score: float
    contractor_history_score: float

class RiskResponse(BaseModel):
    project_id: str
    risk_score: float
    risk_level: RiskLevel
    factors: RiskFactors
    calculated_at: datetime

class RiskHistoryOut(BaseModel):
    id: str
    risk_score: float
    risk_level: RiskLevel
    factors: Optional[Dict] = None
    calculated_at: datetime

    class Config:
        from_attributes = True

# ── Alert ──────────────────────────────────────────────────────────────────────
class AlertOut(BaseModel):
    id: str
    project_id: str
    alert_type: AlertType
    title: str
    message: str
    severity: str
    is_read: bool
    is_resolved: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ── Audit ──────────────────────────────────────────────────────────────────────
class AuditLogOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[Dict] = None
    hash_reference: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ── Dashboard ──────────────────────────────────────────────────────────────────
class DashboardStats(BaseModel):
    total_projects: int
    active_projects: int
    high_risk_projects: int
    delayed_projects: int
    avg_delay_percent: float
    total_budget: float
    integrity_score: float
    national_risk_score: float

class SimulateFailureRequest(BaseModel):
    project_id: str
    scenario: str  # "no_evidence", "budget_overrun", "missed_milestones", "contractor_failure"

Token.model_rebuild()
