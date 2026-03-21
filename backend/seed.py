"""
RAKSHAK — Database Seeder
Creates realistic Indian infrastructure project data
"""
import asyncio
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import async_session
from models import (
    User, Contractor, Project, Milestone, ProjectStatus, RiskLevel
)
from auth import get_password_hash
import logging

logger = logging.getLogger("rakshak.seed")

# ── Sample Data ───────────────────────────────────────────────────────────────

INDIAN_STATES = [
    ("Maharashtra", "Mumbai", 19.0760, 72.8777),
    ("Uttar Pradesh", "Lucknow", 26.8467, 80.9462),
    ("Karnataka", "Bengaluru", 12.9716, 77.5946),
    ("Tamil Nadu", "Chennai", 13.0827, 80.2707),
    ("Rajasthan", "Jaipur", 26.9124, 75.7873),
    ("Gujarat", "Ahmedabad", 23.0225, 72.5714),
    ("West Bengal", "Kolkata", 22.5726, 88.3639),
    ("Telangana", "Hyderabad", 17.3850, 78.4867),
    ("Madhya Pradesh", "Bhopal", 23.2599, 77.4126),
    ("Kerala", "Thiruvananthapuram", 8.5241, 76.9366),
    ("Delhi", "New Delhi", 28.6139, 77.2090),
    ("Bihar", "Patna", 25.5941, 85.1376),
]

INFRASTRUCTURE_PROJECTS = [
    # (name, description, budget in crores, duration days, progress)
    ("National Highway Expansion", "4-lane highway expansion with bridges", 500, 730, 45),
    ("Metro Rail Phase II", "Underground metro line extension", 1200, 1095, 30),
    ("Smart City Infrastructure", "IoT-enabled city management systems", 300, 547, 60),
    ("Water Treatment Plant", "Advanced water purification facility", 150, 456, 75),
    ("Solar Power Station", "500MW solar photovoltaic installation", 800, 912, 40),
    ("AIIMS Medical Campus", "Super-specialty hospital and medical college", 1000, 1460, 25),
    ("Airport Terminal Expansion", "New terminal with enhanced capacity", 600, 912, 55),
    ("Rural Road Connectivity", "PMGSY rural road construction", 80, 365, 80),
    ("Irrigation Canal Network", "Canal construction for agricultural areas", 200, 730, 35),
    ("Digital Education Hub", "Educational technology infrastructure", 120, 456, 70),
]

CONTRACTOR_DATA = [
    ("Larsen & Toubro Ltd", "LNT-CON-1989-001", 12, 0.05),
    ("Tata Projects Ltd", "TPL-CON-1995-002", 8, 0.03),
    ("Gammon India Ltd", "GIL-CON-1922-003", 35, 0.15),
    ("Hindustan Construction Co", "HCC-CON-1926-004", 28, 0.12),
    ("Shapoorji Pallonji & Co", "SPC-CON-1865-005", 15, 0.08),
    ("GMR Infrastructure Ltd", "GMR-INF-1978-006", 22, 0.10),
    ("IRB Infrastructure", "IRB-INF-1998-007", 18, 0.09),
    ("Afcons Infrastructure", "AFC-INF-1976-008", 10, 0.06),
    ("Simplex Infrastructure", "SIC-INF-1924-009", 42, 0.18),
    ("Patel Engineering Ltd", "PEL-CON-1949-010", 55, 0.22),
]

MILESTONE_TEMPLATE = [
    ("Project Planning & Approvals", 5.0),
    ("Land Acquisition", 10.0),
    ("Detailed Design & Engineering", 10.0),
    ("Foundation & Earthwork", 15.0),
    ("Structural Construction", 20.0),
    ("Mechanical & Electrical", 15.0),
    ("Testing & Commissioning", 10.0),
    ("Final Handover", 5.0),
    ("Defect Liability Period", 5.0),
    ("Project Closure", 5.0),
]


def generate_geog_point(lat: float, lon: float) -> str:
    """Generate PostGIS geography point."""
    return f"SRID=4326;POINT({lon} {lat})"


async def seed_database():
    """Seed the database with realistic project data."""
    async with async_session() as db:
        # Check if already seeded
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            logger.info("Database already seeded, skipping")
            return

        logger.info("🌱 Seeding database...")

        # ── Create Users ───────────────────────────────────────────────────
        admin = User(
            email="admin@rakshak.gov.in",
            full_name="System Administrator",
            hashed_password=get_password_hash("Admin@123"),
            role="admin",
            department="Ministry of Infrastructure",
            is_active=True
        )

        officer1 = User(
            email="officer1@rakshak.gov.in",
            full_name="Rajesh Kumar",
            hashed_password=get_password_hash("Officer@123"),
            role="officer",
            department="National Highways",
            is_active=True
        )

        officer2 = User(
            email="officer2@rakshak.gov.in",
            full_name="Priya Sharma",
            hashed_password=get_password_hash("Officer@123"),
            role="officer",
            department="Urban Development",
            is_active=True
        )

        auditor = User(
            email="auditor@rakshak.gov.in",
            full_name="Dr. Venkat Iyer",
            hashed_password=get_password_hash("Auditor@123"),
            role="auditor",
            department="CAG Office",
            is_active=True
        )

        db.add_all([admin, officer1, officer2, auditor])
        await db.flush()
        logger.info(f"✅ Created {4} users")

        # ── Create Contractors ──────────────────────────────────────────────
        contractors = []
        for name, reg_no, avg_delay, failure_rate in CONTRACTOR_DATA:
            contractor = Contractor(
                name=name,
                registration_no=reg_no,
                contact_email=f"contact@{name.lower().replace(' ', '').replace('&', '')}.com",
                contact_phone=f"+91-{random.randint(7000000000, 9999999999)}",
                total_projects=random.randint(20, 200),
                completed_projects=random.randint(10, 150),
                failed_projects=random.randint(0, 10),
                avg_delay_days=avg_delay,
                failure_rate=failure_rate,
                risk_score=min(100, (avg_delay / 60 * 50) + (failure_rate * 100)),
            )
            contractors.append(contractor)
            db.add(contractor)

        await db.flush()
        logger.info(f"✅ Created {len(contractors)} contractors")

        # ── Create Projects ────────────────────────────────────────────────
        now = datetime.now(timezone.utc)
        projects = []

        for i in range(20):  # Create 20 projects
            state_info = INDIAN_STATES[i % len(INDIAN_STATES)]
            project_template = INFRASTRUCTURE_PROJECTS[i % len(INFRASTRUCTURE_PROJECTS)]
            contractor = contractors[i % len(contractors)]

            name, description, budget_crores, duration_days, base_progress = project_template

            # Add state prefix to name
            full_name = f"{state_info[0]}: {name} Phase {i // len(INDIAN_STATES) + 1}"

            # Generate random location near state capital
            lat = state_info[2] + random.uniform(-0.5, 0.5)
            lon = state_info[3] + random.uniform(-0.5, 0.5)

            # Random dates
            days_ago = random.randint(90, 400)
            start_date = now - timedelta(days=days_ago)
            deadline = start_date + timedelta(days=duration_days)

            # Random progress with some variance
            progress = min(100, max(0, base_progress + random.randint(-10, 10)))

            # Determine status
            if progress >= 100:
                status = ProjectStatus.COMPLETED
                progress = 100
            elif deadline < now:
                status = ProjectStatus.DELAYED
            elif progress < days_ago / duration_days * 100 - 20:
                status = ProjectStatus.DELAYED
            else:
                status = ProjectStatus.ACTIVE

            # Calculate spent amount based on progress and some variance
            budget = budget_crores * 10000000  # Convert crores to actual
            spent = budget * (progress / 100) * random.uniform(0.8, 1.3)

            project = Project(
                name=full_name,
                description=f"{description}. Located in {state_info[1]}, {state_info[0]}.",
                state=state_info[0],
                district=state_info[1],
                latitude=lat,
                longitude=lon,
                geog_point=generate_geog_point(lat, lon),
                radius_meters=random.choice([500, 750, 1000, 1500]),
                budget=budget,
                spent_amount=spent,
                start_date=start_date,
                deadline=deadline,
                progress_percent=progress,
                status=status,
                risk_score=0.0,
                risk_level=RiskLevel.GREEN,
                contractor_id=contractor.id,
                created_by=admin.id,
                required_evidence_types=["site_photo", "progress_report", "inspection"],
                min_evidence_interval_days=7,
            )

            projects.append(project)
            db.add(project)

        await db.flush()
        logger.info(f"✅ Created {len(projects)} projects")

        # ── Create Milestones ─────────────────────────────────────────────
        milestone_count = 0
        for project in projects:
            total_duration = (project.deadline - project.start_date).days
            current_date = project.start_date

            for idx, (title, weight) in enumerate(MILESTONE_TEMPLATE):
                # Calculate due date based on weight
                days_offset = int(total_duration * sum(w for _, w in MILESTONE_TEMPLATE[:idx+1]) / 100)
                due_date = project.start_date + timedelta(days=days_offset)

                # Determine if completed based on project progress
                cumulative_weight = sum(w for _, w in MILESTONE_TEMPLATE[:idx+1])
                is_completed = project.progress_percent >= cumulative_weight
                completion_date = None

                if is_completed:
                    completion_date = due_date - timedelta(days=random.randint(0, 14))

                milestone = Milestone(
                    project_id=project.id,
                    title=title,
                    description=f"{title} for {project.name}",
                    due_date=due_date,
                    completion_date=completion_date,
                    is_completed=is_completed,
                    weight_percent=weight,
                    order_index=idx,
                )
                db.add(milestone)
                milestone_count += 1

        await db.flush()
        logger.info(f"✅ Created {milestone_count} milestones")

        # ── Commit Everything ─────────────────────────────────────────────
        await db.commit()
        logger.info("✅ Database seeding complete!")
        logger.info(f"   - Users: 4")
        logger.info(f"   - Contractors: {len(contractors)}")
        logger.info(f"   - Projects: {len(projects)}")
        logger.info(f"   - Milestones: {milestone_count}")


if __name__ == "__main__":
    # Configure logging for standalone run
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_database())
