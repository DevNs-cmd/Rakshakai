"""
RAKSHAK — Pydantic Schemas
Strict validation for all API requests and responses
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from typing import Optional, List, Any, Dict
from datetime import datetime
from enum import Enum


# ── Enums ───────────────────────────────────────────────────────────────────────
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
    LOCATION_VIOLATION = "location_violation"
    CONTRACTOR_RISK = "contractor_risk"


class AlertSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ── Auth ───────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    user: "UserOut"


class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.OFFICER
    department: Optional[str] = Field(None, max_length=100)

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


# ── User ───────────────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: UserRole
    department: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2)
    department: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


# ── Contractor ────────────────────────────────────────────────────────────────
class ContractorCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    registration_no: Optional[str] = Field(None, max_length=100)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None


class ContractorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    registration_no: Optional[str] = None
    contact_email: Optional[str] = None
    total_projects: int = 0
    completed_projects: int = 0
    failed_projects: int = 0
    avg_delay_days: float = 0.0
    failure_rate: float = 0.0
    risk_score: float = 0.0
    created_at: Optional[datetime] = None


class ContractorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None


# ── Milestone ──────────────────────────────────────────────────────────────────
class MilestoneCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    due_date: datetime
    weight_percent: float = Field(default=10.0, ge=0, le=100)
    order_index: int = Field(default=0, ge=0)


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    due_date: datetime
    completion_date: Optional[datetime] = None
    is_completed: bool = False
    weight_percent: float
    order_index: int


class MilestoneUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2)
    description: Optional[str] = None
    is_completed: Optional[bool] = None
    completion_date: Optional[datetime] = None
    weight_percent: Optional[float] = Field(None, ge=0, le=100)


# ── Project ─────────────────────────────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    state: str = Field(..., min_length=2, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_meters: float = Field(default=500.0, ge=10, le=10000)
    budget: float = Field(..., gt=0)
    start_date: datetime
    deadline: datetime
    contractor_id: Optional[str] = None
    required_evidence_types: List[str] = Field(default_factory=list)
    min_evidence_interval_days: int = Field(default=7, ge=1, le=365)

    @field_validator('deadline')
    @classmethod
    def validate_deadline(cls, v: datetime, info) -> datetime:
        values = info.data
        if 'start_date' in values and values['start_date'] and v <= values['start_date']:
            raise ValueError("Deadline must be after start date")
        return v

    @field_validator('budget')
    @classmethod
    def validate_budget(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Budget must be greater than 0")
        return v


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3)
    description: Optional[str] = None
    progress_percent: Optional[float] = Field(None, ge=0, le=100)
    status: Optional[ProjectStatus] = None
    spent_amount: Optional[float] = Field(None, ge=0)
    radius_meters: Optional[float] = Field(None, ge=10, le=10000)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    min_evidence_interval_days: Optional[int] = Field(None, ge=1, le=365)


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    state: str
    district: Optional[str] = None
    latitude: float
    longitude: float
    budget: float
    spent_amount: float = 0.0
    start_date: datetime
    deadline: datetime
    progress_percent: float = 0.0
    status: ProjectStatus
    risk_score: float = 0.0
    risk_level: RiskLevel
    contractor: Optional[ContractorOut] = None
    milestones: List[MilestoneOut] = []
    required_evidence_types: List[str] = []
    min_evidence_interval_days: int = 7
    radius_meters: float = 500.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProjectMapOut(BaseModel):
    """Lightweight project data for map rendering — optimized payload."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    state: str
    district: Optional[str] = None
    latitude: float
    longitude: float
    risk_score: float
    risk_level: RiskLevel
    status: ProjectStatus
    progress_percent: float
    budget: float


class ProjectListOut(BaseModel):
    """Project list item with essential fields."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    state: str
    district: Optional[str] = None
    status: ProjectStatus
    risk_score: float
    risk_level: RiskLevel
    progress_percent: float
    budget: float
    spent_amount: float
    deadline: datetime
    contractor_name: Optional[str] = None


# ── Evidence ───────────────────────────────────────────────────────────────────
class EvidenceUploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    milestone_id: Optional[str] = None
    file_name: str
    file_type: Optional[str] = None
    file_size: int
    file_url: str
    sha256_hash: str
    exif_latitude: Optional[float] = None
    exif_longitude: Optional[float] = None
    exif_timestamp: Optional[datetime] = None
    location_verified: bool
    verification_distance_m: Optional[float] = None
    verification_method: Optional[str] = None
    notes: Optional[str] = None
    is_valid: bool
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    milestone_id: Optional[str] = None
    file_name: str
    file_type: Optional[str] = None
    file_size: int
    file_url: str
    sha256_hash: str
    exif_latitude: Optional[float] = None
    exif_longitude: Optional[float] = None
    exif_timestamp: Optional[datetime] = None
    location_verified: bool
    verification_distance_m: Optional[float] = None
    verification_method: Optional[str] = None
    notes: Optional[str] = None
    is_valid: bool
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    uploader: Optional[UserOut] = None


# ── Risk ───────────────────────────────────────────────────────────────────────
class RiskFeatures(BaseModel):
    """Detailed risk feature breakdown for explainability."""
    delay_ratio: float
    days_to_deadline: int
    days_from_start: int
    timeline_pressure: float
    evidence_count: int
    evidence_frequency: float
    evidence_gap_days: float
    last_evidence_days: float
    evidence_compliance: float
    budget_utilization: float
    budget_vs_progress_ratio: float
    budget_efficiency: float
    overspend_risk: float
    milestone_completion: float
    overdue_milestones: int
    total_milestones: int
    milestone_delay_avg: float
    contractor_risk: float
    contractor_failure_rate: float
    contractor_avg_delay: float


class RiskBreakdown(BaseModel):
    """Complete risk analysis breakdown with explainability."""
    project_id: str
    project_name: str
    risk_score: float
    risk_level: RiskLevel
    features: RiskFeatures
    feature_weights: Dict[str, float]
    contributing_factors: List[str]
    recommendations: List[str]
    calculated_at: datetime


class RiskResponse(BaseModel):
    """Risk score response."""
    project_id: str
    project_name: str
    risk_score: float
    risk_level: RiskLevel
    calculated_at: datetime


class RiskHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    risk_score: float
    risk_level: RiskLevel
    factors: Optional[Dict] = None
    trigger_event: Optional[str] = None
    calculated_at: datetime


# ── Alert ───────────────────────────────────────────────────────────────────────
class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    project_name: Optional[str] = None
    alert_type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    is_read: bool = False
    is_resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: Optional[datetime] = None


class AlertUpdate(BaseModel):
    is_read: Optional[bool] = None
    is_resolved: Optional[bool] = None
    resolution_notes: Optional[str] = None


class AlertCreate(BaseModel):
    project_id: str
    alert_type: AlertType
    severity: AlertSeverity = AlertSeverity.MEDIUM
    title: str = Field(..., min_length=5)
    message: str = Field(..., min_length=10)


# ── Audit ─────────────────────────────────────────────────────────────────────
class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[Dict] = None
    ip_address: Optional[str] = None
    hash_reference: Optional[str] = None
    created_at: Optional[datetime] = None


# ── Dashboard ──────────────────────────────────────────────────────────────────
class DashboardStats(BaseModel):
    """National-level dashboard statistics — all values from live DB."""
    total_projects: int
    active_projects: int
    high_risk_projects: int
    medium_risk_projects: int
    delayed_projects: int
    avg_delay_percent: float
    total_budget: float
    total_spent: float
    budget_utilization: float
    integrity_score: float
    national_risk_score: float
    risk_distribution: Dict[str, int]
    recent_alerts: int
    unread_alerts: int
    total_contractors: int = 0


class IntegrityScoreResponse(BaseModel):
    """National integrity score API response."""
    integrity_score: float
    national_risk_score: float
    avg_project_risk: float
    max_project_risk: float
    risk_distribution: Dict[str, int]
    project_count: int
    high_risk_percentage: float
    top_risk_projects: List[Dict[str, Any]] = []
    last_updated: datetime


# ── Simulation ─────────────────────────────────────────────────────────────────
class SimulateFailureRequest(BaseModel):
    """
    Request body for project-specific failure simulation.
    Note: project_id comes from path parameter, not request body.
    """
    scenario: str = Field(
        ...,
        pattern="^(no_evidence|budget_overrun|missed_milestones|contractor_failure|risk_spike)$",
        description="Scenario to simulate"
    )
    intensity: float = Field(default=0.5, ge=0.0, le=1.0, description="Intensity level 0.0-1.0")


class SimulationResponse(BaseModel):
    status: str
    message: str
    project_id: str
    scenario: str
    original_risk_score: float
    new_risk_score: float
    risk_level: str
    triggered_alerts: int
    timestamp: datetime


# ── System Health ───────────────────────────────────────────────────────────────
class SystemHealth(BaseModel):
    status: str
    components: Dict[str, Any]
    timestamp: datetime


class HealthCheck(BaseModel):
    status: str
    service: str
    version: str
    database: Dict[str, Any]
    redis: str
    timestamp: datetime


# Fix forward references
Token.model_rebuild()
