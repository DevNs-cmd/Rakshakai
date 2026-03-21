"""Initial schema for RAKSHAK national-grade system

Revision ID: 0001_initial
Revises:
Create Date: 2024-03-21 00:00:01.000000

"""
from alembic import op
import sqlalchemy as sa
import geoalchemy2

# revision identifiers
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create PostGIS extension
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')

    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role', sa.Enum('admin', 'officer', 'auditor', name='userrole'), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('is_superuser', sa.Boolean(), default=False, nullable=False),
        sa.Column('department', sa.String(100)),
        sa.Column('phone', sa.String(20)),
        sa.Column('last_login', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_role', 'users', ['role'])

    # Contractors table
    op.create_table(
        'contractors',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('registration_no', sa.String(100), unique=True),
        sa.Column('contact_email', sa.String(255)),
        sa.Column('contact_phone', sa.String(20)),
        sa.Column('address', sa.Text()),
        sa.Column('total_projects', sa.Integer(), default=0, nullable=False),
        sa.Column('completed_projects', sa.Integer(), default=0, nullable=False),
        sa.Column('failed_projects', sa.Integer(), default=0, nullable=False),
        sa.Column('avg_delay_days', sa.Float(), default=0.0, nullable=False),
        sa.Column('failure_rate', sa.Float(), default=0.0, nullable=False),
        sa.Column('risk_score', sa.Float(), default=0.0, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_contractors_risk', 'contractors', ['risk_score'])

    # Projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('state', sa.String(100), nullable=False),
        sa.Column('district', sa.String(100)),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('geog_point', geoalchemy2.Geometry(geometry_type='POINT', srid=4326, spatial_index=False)),
        sa.Column('radius_meters', sa.Float(), default=500.0, nullable=False),
        sa.Column('budget', sa.Float(), nullable=False),
        sa.Column('spent_amount', sa.Float(), default=0.0, nullable=False),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deadline', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('progress_percent', sa.Float(), default=0.0, nullable=False),
        sa.Column('status', sa.Enum('active', 'delayed', 'completed', 'suspended', name='projectstatus'), nullable=False),
        sa.Column('risk_score', sa.Float(), default=0.0, nullable=False),
        sa.Column('risk_level', sa.Enum('green', 'yellow', 'red', name='risklevel'), nullable=False),
        sa.Column('last_risk_calc', sa.DateTime(timezone=True)),
        sa.Column('required_evidence_types', sa.JSON(), default=list),
        sa.Column('min_evidence_interval_days', sa.Integer(), default=7),
        sa.Column('contractor_id', sa.String(36), sa.ForeignKey('contractors.id', ondelete='SET NULL')),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_projects_status', 'projects', ['status'])
    op.create_index('idx_projects_risk_level', 'projects', ['risk_level'])
    op.create_index('idx_projects_state', 'projects', ['state'])
    op.create_index('idx_projects_contractor', 'projects', ['contractor_id'])

    # Milestones table
    op.create_table(
        'milestones',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completion_date', sa.DateTime(timezone=True)),
        sa.Column('is_completed', sa.Boolean(), default=False, nullable=False),
        sa.Column('weight_percent', sa.Float(), default=10.0, nullable=False),
        sa.Column('order_index', sa.Integer(), default=0, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_milestones_project', 'milestones', ['project_id', 'order_index'])
    op.create_index('idx_milestones_due', 'milestones', ['due_date'])

    # Evidence table
    op.create_table(
        'evidence',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('milestone_id', sa.String(36), sa.ForeignKey('milestones.id', ondelete='SET NULL')),
        sa.Column('uploaded_by', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=False),
        sa.Column('file_name', sa.String(500), nullable=False),
        sa.Column('file_type', sa.String(100)),
        sa.Column('file_size', sa.Integer()),
        sa.Column('file_url', sa.String(1000), nullable=False),
        sa.Column('sha256_hash', sa.String(64), nullable=False),
        sa.Column('exif_latitude', sa.Float()),
        sa.Column('exif_longitude', sa.Float()),
        sa.Column('exif_timestamp', sa.DateTime(timezone=True)),
        sa.Column('geog_point', geoalchemy2.Geometry(geometry_type='POINT', srid=4326, spatial_index=False)),
        sa.Column('location_verified', sa.Boolean(), default=False, nullable=False),
        sa.Column('verification_distance_m', sa.Float()),
        sa.Column('verification_method', sa.String(50)),
        sa.Column('is_valid', sa.Boolean(), default=True, nullable=False),
        sa.Column('rejection_reason', sa.Text()),
        sa.Column('validation_notes', sa.Text()),
        sa.Column('notes', sa.Text()),  # Uploader-provided notes
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_evidence_project', 'evidence', ['project_id'])
    op.create_index('idx_evidence_hash', 'evidence', ['sha256_hash'])
    op.create_index('idx_evidence_created', 'evidence', ['created_at'])
    op.create_index('idx_evidence_verified', 'evidence', ['project_id', 'is_valid'])

    # Project Officers table
    op.create_table(
        'project_officers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('officer_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('assigned_by', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('is_primary', sa.Boolean(), default=False),
        sa.UniqueConstraint('project_id', 'officer_id', name='uq_project_officer'),
    )

    # Risk History table
    op.create_table(
        'risk_history',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('risk_score', sa.Float(), nullable=False),
        sa.Column('risk_level', sa.Enum('green', 'yellow', 'red', name='risklevel'), nullable=False),
        sa.Column('factors', sa.JSON()),
        sa.Column('trigger_event', sa.String(100)),
        sa.Column('calculated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_risk_history_project', 'risk_history', ['project_id', 'calculated_at'])

    # Alerts table
    op.create_table(
        'alerts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('alert_type', sa.Enum('no_evidence', 'deadline_risk', 'anomaly_spike', 'budget_overrun',
                                       'location_violation', 'contractor_risk', name='alerttype'), nullable=False),
        sa.Column('severity', sa.Enum('low', 'medium', 'high', 'critical', name='alertseverity'),
                  default='medium', nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), default=False, nullable=False),
        sa.Column('is_resolved', sa.Boolean(), default=False, nullable=False),
        sa.Column('resolved_by', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('resolved_at', sa.DateTime(timezone=True)),
        sa.Column('resolution_notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_alerts_project', 'alerts', ['project_id'])
    op.create_index('idx_alerts_unread', 'alerts', ['is_read', 'created_at'])
    op.create_index('idx_alerts_type', 'alerts', ['alert_type'])

    # Audit Logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50)),
        sa.Column('resource_id', sa.String(36)),
        sa.Column('details', sa.JSON()),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('user_agent', sa.Text()),
        sa.Column('hash_reference', sa.String(64)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_audit_user', 'audit_logs', ['user_id', 'created_at'])
    op.create_index('idx_audit_resource', 'audit_logs', ['resource_type', 'resource_id'])
    op.create_index('idx_audit_hash', 'audit_logs', ['hash_reference'])

    # System Health table
    op.create_table(
        'system_health',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('component', sa.String(100), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('metrics', sa.JSON()),
        sa.Column('error_message', sa.Text()),
        sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_health_component', 'system_health', ['component', 'recorded_at'])


def downgrade():
    # Drop in reverse order
    op.drop_table('system_health')
    op.drop_table('audit_logs')
    op.drop_table('alerts')
    op.drop_table('risk_history')
    op.drop_table('project_officers')
    op.drop_table('evidence')
    op.drop_table('milestones')
    op.drop_table('projects')
    op.drop_table('contractors')
    op.drop_table('users')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS alertseverity')
    op.execute('DROP TYPE IF EXISTS alerttype')
    op.execute('DROP TYPE IF EXISTS risklevel')
    op.execute('DROP TYPE IF EXISTS projectstatus')
    op.execute('DROP TYPE IF EXISTS userrole')
