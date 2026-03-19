from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, JSON, Enum as SAEnum, ForeignKey, func, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from database import Base

def gen_uuid():
    return str(uuid.uuid4())

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

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.OFFICER, nullable=False)
    is_active = Column(Boolean, default=True)
    department = Column(String)
    phone = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    projects = relationship("ProjectOfficer", back_populates="officer")
    audit_logs = relationship("AuditLog", back_populates="user")

class Contractor(Base):
    __tablename__ = "contractors"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    registration_no = Column(String, unique=True)
    contact_email = Column(String)
    contact_phone = Column(String)
    address = Column(Text)
    total_projects = Column(Integer, default=0)
    completed_projects = Column(Integer, default=0)
    avg_delay_days = Column(Float, default=0.0)
    risk_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    projects = relationship("Project", back_populates="contractor")

class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    description = Column(Text)
    state = Column(String, nullable=False)
    district = Column(String)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_meters = Column(Float, default=500.0)
    budget = Column(Float, nullable=False)
    spent_amount = Column(Float, default=0.0)
    start_date = Column(DateTime(timezone=True), nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=False)
    progress_percent = Column(Float, default=0.0)
    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.ACTIVE)
    risk_score = Column(Float, default=0.0)
    risk_level = Column(SAEnum(RiskLevel), default=RiskLevel.GREEN)
    contractor_id = Column(String, ForeignKey("contractors.id"))
    required_evidence_types = Column(JSON, default=list)
    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    contractor = relationship("Contractor", back_populates="projects")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")
    evidence = relationship("Evidence", back_populates="project", cascade="all, delete-orphan")
    officers = relationship("ProjectOfficer", back_populates="project")
    risk_history = relationship("RiskHistory", back_populates="project", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="project", cascade="all, delete-orphan")

class Milestone(Base):
    __tablename__ = "milestones"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    due_date = Column(DateTime(timezone=True), nullable=False)
    completion_date = Column(DateTime(timezone=True))
    is_completed = Column(Boolean, default=False)
    weight_percent = Column(Float, default=10.0)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="milestones")
    evidence = relationship("Evidence", back_populates="milestone")

class Evidence(Base):
    __tablename__ = "evidence"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    milestone_id = Column(String, ForeignKey("milestones.id"))
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_type = Column(String)
    file_size = Column(Integer)
    file_url = Column(String, nullable=False)
    sha256_hash = Column(String, unique=True, nullable=False, index=True)
    exif_latitude = Column(Float)
    exif_longitude = Column(Float)
    exif_timestamp = Column(DateTime(timezone=True))
    location_verified = Column(Boolean, default=False)
    verification_distance_m = Column(Float)
    notes = Column(Text)
    is_valid = Column(Boolean, default=True)
    rejection_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="evidence")
    milestone = relationship("Milestone", back_populates="evidence")

class ProjectOfficer(Base):
    __tablename__ = "project_officers"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    officer_id = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="officers")
    officer = relationship("User", back_populates="projects")

class RiskHistory(Base):
    __tablename__ = "risk_history"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    risk_score = Column(Float, nullable=False)
    risk_level = Column(SAEnum(RiskLevel), nullable=False)
    factors = Column(JSON)
    calculated_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="risk_history")

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    alert_type = Column(SAEnum(AlertType), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String, default="medium")
    is_read = Column(Boolean, default=False)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="alerts")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    action = Column(String, nullable=False)
    resource_type = Column(String)
    resource_id = Column(String)
    details = Column(JSON)
    ip_address = Column(String)
    hash_reference = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")
