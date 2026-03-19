"""
Database seeder — creates realistic Indian infrastructure project data.
"""
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from database import AsyncSessionLocal
from models import User, Contractor, Project, Milestone, ProjectStatus, RiskLevel
from auth import get_password_hash
import random

INDIAN_PROJECTS = [
    {
        "name": "NH-44 Highway Expansion - Jammu to Srinagar",
        "state": "Jammu & Kashmir",
        "district": "Ramban",
        "latitude": 33.2455,
        "longitude": 75.2590,
        "budget": 45000000000,
        "progress_percent": 38.0,
        "status": ProjectStatus.ACTIVE,
        "description": "National Highway expansion for all-weather connectivity",
    },
    {
        "name": "Mumbai Coastal Road Phase 2",
        "state": "Maharashtra",
        "district": "Mumbai",
        "latitude": 18.9217,
        "longitude": 72.8318,
        "budget": 12800000000,
        "progress_percent": 62.0,
        "status": ProjectStatus.ACTIVE,
        "description": "Coastal road for decongesting Mumbai",
    },
    {
        "name": "Narmada District Irrigation Canal",
        "state": "Madhya Pradesh",
        "district": "Narmadapuram",
        "latitude": 22.7577,
        "longitude": 77.7327,
        "budget": 6200000000,
        "progress_percent": 21.0,
        "status": ProjectStatus.DELAYED,
        "description": "Canal network for agricultural irrigation",
    },
    {
        "name": "Bangalore Metro Phase 3 - Outer Ring Road",
        "state": "Karnataka",
        "district": "Bengaluru Urban",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "budget": 15600000000,
        "progress_percent": 47.0,
        "status": ProjectStatus.ACTIVE,
        "description": "Metro expansion to outer ring road corridors",
    },
    {
        "name": "Rajasthan Solar Park - Bhadla Phase 4",
        "state": "Rajasthan",
        "district": "Jodhpur",
        "latitude": 27.5330,
        "longitude": 71.9167,
        "budget": 8900000000,
        "progress_percent": 78.0,
        "status": ProjectStatus.ACTIVE,
        "description": "2300MW solar park extension",
    },
    {
        "name": "Kolkata East-West Metro Extension",
        "state": "West Bengal",
        "district": "Howrah",
        "latitude": 22.5726,
        "longitude": 88.3639,
        "budget": 9400000000,
        "progress_percent": 55.0,
        "status": ProjectStatus.ACTIVE,
        "description": "Metro extension to Howrah Maidan",
    },
    {
        "name": "Rural Electrification - Odisha Tribal Belt",
        "state": "Odisha",
        "district": "Koraput",
        "latitude": 18.8135,
        "longitude": 82.7126,
        "budget": 2100000000,
        "progress_percent": 15.0,
        "status": ProjectStatus.DELAYED,
        "description": "Last-mile electricity connectivity for tribal villages",
    },
    {
        "name": "Chennai Peripheral Ring Road",
        "state": "Tamil Nadu",
        "district": "Kancheepuram",
        "latitude": 12.8829,
        "longitude": 80.0817,
        "budget": 11200000000,
        "progress_percent": 33.0,
        "status": ProjectStatus.ACTIVE,
        "description": "128km peripheral ring road for freight movement",
    },
    {
        "name": "Uttarakhand Char Dham All-Weather Road",
        "state": "Uttarakhand",
        "district": "Chamoli",
        "latitude": 30.4162,
        "longitude": 79.3124,
        "budget": 12000000000,
        "progress_percent": 44.0,
        "status": ProjectStatus.ACTIVE,
        "description": "Four-lane highway to all four dhams",
    },
    {
        "name": "Delhi-Meerut RRTS Corridor",
        "state": "Uttar Pradesh",
        "district": "Ghaziabad",
        "latitude": 28.6692,
        "longitude": 77.4538,
        "budget": 30200000000,
        "progress_percent": 71.0,
        "status": ProjectStatus.ACTIVE,
        "description": "Regional Rapid Transit System corridor",
    },
    {
        "name": "Guwahati Water Supply Project",
        "state": "Assam",
        "district": "Kamrup Metro",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "budget": 1800000000,
        "progress_percent": 29.0,
        "status": ProjectStatus.DELAYED,
        "description": "24x7 piped water supply for Guwahati city",
    },
    {
        "name": "Kochi Smart City Infrastructure",
        "state": "Kerala",
        "district": "Ernakulam",
        "latitude": 9.9312,
        "longitude": 76.2673,
        "budget": 3400000000,
        "progress_percent": 58.0,
        "status": ProjectStatus.ACTIVE,
        "description": "Smart city command center and fiber network",
    },
]

CONTRACTORS = [
    {"name": "L&T Construction Ltd", "registration_no": "LT-CON-2019-001", "avg_delay_days": 12, "risk_score": 15},
    {"name": "GMR Infrastructure Ltd", "registration_no": "GMR-INF-2018-002", "avg_delay_days": 25, "risk_score": 28},
    {"name": "Afcons Infrastructure Ltd", "registration_no": "AFC-INF-2017-003", "avg_delay_days": 8, "risk_score": 12},
    {"name": "Dilip Buildcon Ltd", "registration_no": "DBL-CON-2020-004", "avg_delay_days": 45, "risk_score": 65},
    {"name": "KEC International Ltd", "registration_no": "KEC-INT-2019-005", "avg_delay_days": 18, "risk_score": 32},
]


async def seed_database():
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            return  # Already seeded
        
        # Create admin user
        admin = User(
            email="admin@rakshak.gov.in",
            full_name="System Administrator",
            hashed_password=get_password_hash("Admin@123"),
            role="admin",
            department="Ministry of Road Transport",
        )
        
        officer = User(
            email="officer@rakshak.gov.in",
            full_name="Field Officer Singh",
            hashed_password=get_password_hash("Officer@123"),
            role="officer",
            department="NHAI",
        )
        
        auditor = User(
            email="auditor@rakshak.gov.in",
            full_name="Dr. Priya Auditor",
            hashed_password=get_password_hash("Auditor@123"),
            role="auditor",
            department="CAG",
        )
        
        db.add_all([admin, officer, auditor])
        await db.flush()
        
        # Create contractors
        contractors = []
        for c_data in CONTRACTORS:
            contractor = Contractor(
                name=c_data["name"],
                registration_no=c_data["registration_no"],
                avg_delay_days=c_data["avg_delay_days"],
                risk_score=c_data["risk_score"],
                total_projects=random.randint(10, 50),
                completed_projects=random.randint(5, 30),
            )
            db.add(contractor)
            contractors.append(contractor)
        
        await db.flush()
        
        # Create projects
        now = datetime.now(timezone.utc)
        for i, p_data in enumerate(INDIAN_PROJECTS):
            contractor = contractors[i % len(contractors)]
            start = now - timedelta(days=random.randint(180, 730))
            deadline = now + timedelta(days=random.randint(90, 730))
            
            project = Project(
                name=p_data["name"],
                state=p_data["state"],
                district=p_data["district"],
                latitude=p_data["latitude"],
                longitude=p_data["longitude"],
                budget=p_data["budget"],
                spent_amount=p_data["budget"] * (p_data["progress_percent"] / 100) * random.uniform(0.8, 1.3),
                start_date=start,
                deadline=deadline,
                progress_percent=p_data["progress_percent"],
                status=p_data["status"],
                description=p_data["description"],
                contractor_id=contractor.id,
                radius_meters=1000.0,
                required_evidence_types=["construction_photo", "material_delivery", "inspection_report"],
                created_by=admin.id,
                risk_score=0.0,
                risk_level=RiskLevel.GREEN,
            )
            
            db.add(project)
            await db.flush()
            
            # Add milestones
            milestone_templates = [
                ("Site Preparation & Clearance", 10.0),
                ("Foundation & Earthwork", 20.0),
                ("Structural Work Phase 1", 20.0),
                ("Structural Work Phase 2", 20.0),
                ("Finishing & QC", 15.0),
                ("Inspection & Handover", 15.0),
            ]
            
            for j, (title, weight) in enumerate(milestone_templates):
                ms_date = start + timedelta(days=int((deadline - start).days * (j + 1) / len(milestone_templates)))
                ms = Milestone(
                    project_id=project.id,
                    title=title,
                    due_date=ms_date,
                    weight_percent=weight,
                    order_index=j,
                    is_completed=p_data["progress_percent"] >= (sum(w for _, w in milestone_templates[:j + 1])),
                )
                db.add(ms)
        
        await db.commit()
