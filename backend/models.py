"""
RAKSHAK — National-Grade Database Models
PostgreSQL + PostGIS with strict referential integrity
"""
import uuid
import enum
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    Column, String, Integer, Float, DateTime, Boolean, Text, JSON,
    Enum as SAEnum, ForeignKey, func, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, validates
from geoalchemy2 import Geography

from database import Base


def gen_uuid() -> str:
    """Generate a UUID string."""
    return str(uuid.uuid4())


# ── Enums ───────────────────────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OFFICER = "officer"
    AUDITOR = "auditor"


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    DELAYED = "delayed"
    COMPLETED = "completed"
    SUSPENDED = "suspended"


class RiskLevel(str, enum.Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class AlertType(str, enum.Enum):
    NO_EVIDENCE = "no_evidence"
    DEADLINE_RISK = "deadline_risk"
    ANOMALY_SPIKE = "anomaly_spike"
    BUDGET_OVERRUN = "budget_overrun"
    LOCATION_VIOLATION = "location_violation"
    CONTRACTOR_RISK = "contractor_risk"


class AlertSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ── Core Models ────────────────────────────────────────────────────────────────
class User(Base):
    """System users with role-based access."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.OFFICER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    department = Column(String(100))
    phone = Column(String(20))
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    projects = relationship("ProjectOfficer", back_populates="officer", lazy="selectin")
    audit_logs = relationship("AuditLog", back_populates="user", lazy="selectin")
    evidence_uploads = relationship("Evidence", back_populates="uploader", lazy="selectin")

    __table_args__ = (
        Index('idx_users_email', 'email'),
        Index('idx_users_role', 'role'),
    )

    @validates('email')
    def validate_email(self, key, email):
        return email.lower().strip() if email else email


class Contractor(Base):
    """Contractors with historical performance tracking."""
    __tablename__ = "contractors"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    registration_no = Column(String(100), unique=True, index=True)
    contact_email = Column(String(255))
    contact_phone = Column(String(20))
    address = Column(Text)

    # Performance metrics
    total_projects = Column(Integer, default=0, nullable=False)
    completed_projects = Column(Integer, default=0, nullable=False)
    failed_projects = Column(Integer, default=0, nullable=False)
    avg_delay_days = Column(Float, default=0.0, nullable=False)
    failure_rate = Column(Float, default=0.0, nullable=False)  # 0.0 to 1.0
    risk_score = Column(Float, default=0.0, nullable=False)  # 0.0 to 100.0

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    projects = relationship("Project", back_populates="contractor", lazy="selectin")

    __table_args__ = (
        Index('idx_contractors_risk', 'risk_score'),
    )

    @validates('failure_rate')
    def validate_failure_rate(self, key, value):
        if value is not None:
            return max(0.0, min(1.0, float(value)))
        return value

    @validates('risk_score')
    def validate_risk_score(self, key, value):
        if value is not None:
            return max(0.0, min(100.0, float(value)))
        return value


class Project(Base):
    """Government infrastructure projects."""
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Location (uses PostGIS geography)
    state = Column(String(100), nullable=False, index=True)
    district = Column(String(100), index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    # spatial_index=False here because we create it manually with GIST in create_indexes()
    geog_point = Column(Geography(geometry_type='POINT', srid=4326, spatial_index=False))
    radius_meters = Column(Float, default=500.0, nullable=False)

    # Financial
    budget = Column(Float, nullable=False)
    spent_amount = Column(Float, default=0.0, nullable=False)

    # Timeline
    start_date = Column(DateTime(timezone=True), nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True))

    # Progress
    progress_percent = Column(Float, default=0.0, nullable=False)
    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.ACTIVE, nullable=False)

    # Risk
    risk_score = Column(Float, default=0.0, nullable=False)
    risk_level = Column(SAEnum(RiskLevel), default=RiskLevel.GREEN, nullable=False)
    last_risk_calc = Column(DateTime(timezone=True))

    # Evidence requirements
    required_evidence_types = Column(JSON, default=list)
    min_evidence_interval_days = Column(Integer, default=7)

    # Foreign keys
    contractor_id = Column(String(36), ForeignKey("contractors.id", ondelete="SET NULL"), index=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    contractor = relationship("Contractor", back_populates="projects", lazy="selectin")
    milestones = relationship("Milestone", back_populates="project", lazy="selectin",
                                cascade="all, delete-orphan", order_by="Milestone.order_index")
    evidence = relationship("Evidence", back_populates="project", lazy="selectin",
                             cascade="all, delete-orphan", order_by="Evidence.created_at.desc()")
    officers = relationship("ProjectOfficer", back_populates="project", lazy="selectin",
                           cascade="all, delete-orphan")
    risk_history = relationship("RiskHistory", back_populates="project", lazy="selectin",
                               cascade="all, delete-orphan", order_by="RiskHistory.calculated_at.desc()")
    alerts = relationship("Alert", back_populates="project", lazy="selectin",
                          cascade="all, delete-orphan", order_by="Alert.created_at.desc()")

    __table_args__ = (
        Index('idx_projects_status', 'status'),
        Index('idx_projects_risk_level', 'risk_level'),
        Index('idx_projects_state', 'state'),
        Index('idx_projects_contractor', 'contractor_id'),
        Index('idx_projects_created_at', 'created_at'),
    )

    @validates('progress_percent')
    def validate_progress(self, key, value):
        if value is not None:
            return max(0.0, min(100.0, float(value)))
        return value

    @validates('radius_meters')
    def validate_radius(self, key, value):
        if value is not None:
            return max(10.0, min(10000.0, float(value)))  # 10m to 10km
        return value


class Milestone(Base):
    """Project milestones for tracking progress."""
    __tablename__ = "milestones"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    due_date = Column(DateTime(timezone=True), nullable=False, index=True)
    completion_date = Column(DateTime(timezone=True))
    is_completed = Column(Boolean, default=False, nullable=False)
    weight_percent = Column(Float, default=10.0, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="milestones")
    evidence = relationship("Evidence", back_populates="milestone", lazy="selectin")

    __table_args__ = (
        Index('idx_milestones_project', 'project_id', 'order_index'),
        Index('idx_milestones_due', 'due_date'),
    )


class Evidence(Base):
    """Project evidence with verification and integrity checks."""
    __tablename__ = "evidence"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    milestone_id = Column(String(36), ForeignKey("milestones.id", ondelete="SET NULL"), index=True)
    uploaded_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=False)

    # File info
    file_name = Column(String(500), nullable=False)
    file_type = Column(String(100))
    file_size = Column(Integer)  # bytes
    file_url = Column(String(1000), nullable=False)

    # Integrity
    sha256_hash = Column(String(64), unique=True, nullable=False, index=True)

    # EXIF/Location data
    exif_latitude = Column(Float)
    exif_longitude = Column(Float)
    exif_timestamp = Column(DateTime(timezone=True))
    geog_point = Column(Geography(geometry_type='POINT', srid=4326, spatial_index=False))

    # Verification results
    location_verified = Column(Boolean, default=False, nullable=False)
    verification_distance_m = Column(Float)
    verification_method = Column(String(50))  # 'postgis', 'haversine', 'no_gps'

    # Validation
    is_valid = Column(Boolean, default=True, nullable=False)
    rejection_reason = Column(Text)
    validation_notes = Column(Text)

    # Notes from uploader
    notes = Column(Text)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="evidence")
    milestone = relationship("Milestone", back_populates="evidence")
    uploader = relationship("User", back_populates="evidence_uploads")

    __table_args__ = (
        Index('idx_evidence_project', 'project_id'),
        Index('idx_evidence_hash', 'sha256_hash'),
        Index('idx_evidence_created', 'created_at'),
        Index('idx_evidence_verified', 'project_id', 'is_valid'),
    )


class ProjectOfficer(Base):
    """Many-to-many relationship between projects and officers."""
    __tablename__ = "project_officers"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    officer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    assigned_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    is_primary = Column(Boolean, default=False)

    # Relationships
    project = relationship("Project", back_populates="officers")
    officer = relationship("User", back_populates="projects", foreign_keys=[officer_id])

    __table_args__ = (
        UniqueConstraint('project_id', 'officer_id', name='uq_project_officer'),
    )


class RiskHistory(Base):
    """Historical risk scores for trend analysis."""
    __tablename__ = "risk_history"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    risk_score = Column(Float, nullable=False)
    risk_level = Column(SAEnum(RiskLevel), nullable=False)
    factors = Column(JSON)  # Detailed breakdown of risk factors
    trigger_event = Column(String(100))  # What triggered recalculation
    calculated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="risk_history")

    __table_args__ = (
        Index('idx_risk_history_project', 'project_id', 'calculated_at'),
    )


class Alert(Base):
    """System alerts for anomalies and violations."""
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type = Column(SAEnum(AlertType), nullable=False, index=True)
    severity = Column(SAEnum(AlertSeverity), default=AlertSeverity.MEDIUM, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)

    # Status
    is_read = Column(Boolean, default=False, nullable=False)
    is_resolved = Column(Boolean, default=False, nullable=False)
    resolved_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    resolved_at = Column(DateTime(timezone=True))
    resolution_notes = Column(Text)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="alerts")

    __table_args__ = (
        Index('idx_alerts_project', 'project_id'),
        Index('idx_alerts_unread', 'is_read', 'created_at'),
        Index('idx_alerts_type', 'alert_type'),
        Index('idx_alerts_severity', 'severity'),
    )


class AuditLog(Base):
    """Immutable audit trail for all system actions."""
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50))
    resource_id = Column(String(36))
    details = Column(JSON)
    ip_address = Column(String(45))  # IPv6 compatible
    user_agent = Column(Text)
    hash_reference = Column(String(64), index=True)  # Integrity hash
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index('idx_audit_user', 'user_id', 'created_at'),
        Index('idx_audit_resource', 'resource_type', 'resource_id'),
        Index('idx_audit_hash', 'hash_reference'),
        Index('idx_audit_created', 'created_at'),
    )


class SystemHealth(Base):
    """System health metrics for monitoring."""
    __tablename__ = "system_health"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    component = Column(String(100), nullable=False, index=True)  # 'database', 'redis', 'storage'
    status = Column(String(20), nullable=False)  # 'healthy', 'degraded', 'down'
    metrics = Column(JSON)  # Component-specific metrics
    error_message = Column(Text)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index('idx_health_component', 'component', 'recorded_at'),
    )
