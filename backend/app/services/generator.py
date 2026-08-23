import random
from sqlalchemy.orm import Session
from app.models.domain import Company, Student, Room, Panel, CompanyAvailability, StudentShortlist
from typing import List

# Fixed seed for reproducibility
random.seed(42)

def generate_mock_data(db: Session, 
                       num_companies: int = 35, 
                       num_students: int = 800, 
                       num_rooms: int = 20, 
                       num_days: int = 4):
    
    # 1. Generate Rooms
    rooms = []
    for i in range(num_rooms):
        room = Room(name=f"Room-{i+1:02d}")
        db.add(room)
        rooms.append(room)
    
    db.commit()

    # 2. Generate Companies
    industries = ["Finance", "Technology", "Consulting", "Core Engineering", "E-Commerce"]
    branches = ["CSE", "ECE", "MECH", "CIVIL", "EE"]
    
    companies = []
    for i in range(num_companies):
        tier = random.choices([1, 2, 3], weights=[15, 35, 50])[0] # Tier 1 is highest priority
        cgpa_cutoff = random.choice([7.0, 7.5, 8.0, 8.5, 9.0]) if tier <= 2 else random.choice([6.0, 6.5, 7.0])
        num_panels = random.randint(1, 4) if tier == 1 else random.randint(1, 2)
        duration = random.choice([30, 45, 60])
        
        # Day 1 companies (Tier 1) usually come early.
        available_days = []
        if tier == 1:
            available_days = [1]
        elif tier == 2:
            available_days = [1, 2]
        else:
            available_days = [2, 3, 4]
            
        company = Company(
            name=f"Company-{i+1:02d}",
            industry=random.choice(industries),
            priority_tier=tier,
            cgpa_cutoff=cgpa_cutoff,
            branch_eligibility=",".join(random.sample(branches, k=random.randint(2, 5))),
            num_panels=num_panels,
            interview_duration=duration
        )
        db.add(company)
        db.commit()
        db.refresh(company)
        companies.append(company)

        # Generate Panels for Company
        for p in range(num_panels):
            panel = Panel(company_id=company.id, name=f"{company.name}-P{p+1}")
            db.add(panel)
            
        # Generate Availability (09:00 to 18:00 -> minute 540 to 1080 if 0 is midnight. 
        # But let's use 0 = 09:00, 540 = 18:00 for simplicity)
        for day in available_days:
            start_minute = random.choice([0, 60]) # 9 AM or 10 AM
            end_minute = random.choice([420, 480, 540]) # 4 PM, 5 PM, or 6 PM
            avail = CompanyAvailability(
                company_id=company.id,
                day=day,
                start_time=start_minute,
                end_time=end_minute
            )
            db.add(avail)
            
    db.commit()
    
    # 3. Generate Students
    students = []
    for i in range(num_students):
        student = Student(
            student_code=f"S-{i+1:04d}",
            name=f"Student {i+1}",
            cgpa=round(random.uniform(6.0, 9.8), 2),
            branch=random.choice(branches)
        )
        db.add(student)
        students.append(student)
        
    db.commit()
    
    # 4. Generate Non-Uniform Shortlists
    # High CGPA students get more shortlists. Tier 1 companies shortlist fewer students but high CGPA ones.
    for company in companies:
        eligible_students = [
            s for s in students 
            if s.cgpa >= company.cgpa_cutoff and s.branch in company.branch_eligibility
        ]
        
        # Sort by CGPA descending for Tier 1, randomly for others but weighted by CGPA
        if company.priority_tier == 1:
            eligible_students.sort(key=lambda x: x.cgpa, reverse=True)
            shortlist_count = random.randint(15, 30) * company.num_panels
        else:
            random.shuffle(eligible_students)
            shortlist_count = random.randint(20, 50) * company.num_panels
            
        selected = eligible_students[:shortlist_count]
        for s in selected:
            sl = StudentShortlist(student_id=s.id, company_id=company.id)
            db.add(sl)
            
    db.commit()
    print(f"Generated {num_companies} companies, {num_students} students, {num_rooms} rooms.")
