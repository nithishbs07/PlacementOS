import os
import sys
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.domain import Company, Student, Room, Panel, Interview, CompanyAvailability, StudentShortlist, Disruption, DisruptionType, ScheduleVersion, ScheduleStatus
from app.services.generator import generate_mock_data
from app.services.solver import create_schedule
from app.services.baseline import greedy_schedule
from app.services.infeasibility import analyze_unscheduled_interview

def print_infeasibility(db, v1_version_id, limit=3):
    print("\n--- INFESIBILITY EXPLANATIONS ---")
    unscheduled = db.query(Interview).filter_by(schedule_version_id=v1_version_id, status="UNSCHEDULED").limit(limit).all()
    if not unscheduled:
        print("No unscheduled interviews found.")
        return
        
    for i in unscheduled:
        student = db.get(Student, i.student_id)
        company = db.get(Company, i.company_id)
        analysis = analyze_unscheduled_interview(db, v1_version_id, i.student_id, i.company_id)
        
        print("\nUNSCHEDULED INTERVIEW")
        print("---------------------")
        print(f"Student: {student.name}")
        print(f"Company: {company.name}")
        print(f"\nReason: {analysis['reason']}")
        print("\nExplanation:")
        print(f"{analysis['details']}")
        print(f"Capacity utilization: {analysis['capacity_utilization']}")

def get_scheduled_dict(db, version_id):
    interviews = db.query(Interview).filter_by(schedule_version_id=version_id, status="SCHEDULED").all()
    return {(i.student_id, i.company_id): i for i in interviews}

def calculate_diff(db, v1_id, v2_id):
    v1 = get_scheduled_dict(db, v1_id)
    v2 = get_scheduled_dict(db, v2_id)
    
    total_before = len(v1)
    total_after = len(v2)
    
    unchanged = 0
    moved = 0
    cancelled = 0
    newly_scheduled = 0
    
    time_changes = 0
    room_changes = 0
    panel_changes = 0
    
    for key, i1 in v1.items():
        if key not in v2:
            cancelled += 1
        else:
            i2 = v2[key]
            if i1.start_time == i2.start_time and i1.day == i2.day and i1.room_id == i2.room_id and i1.panel_id == i2.panel_id:
                unchanged += 1
            else:
                moved += 1
                if i1.start_time != i2.start_time or i1.day != i2.day:
                    time_changes += 1
                if i1.room_id != i2.room_id:
                    room_changes += 1
                if i1.panel_id != i2.panel_id:
                    panel_changes += 1
                    
    for key in v2.keys():
        if key not in v1:
            newly_scheduled += 1
            
    changed = moved + cancelled
    churn = (changed / total_before * 100) if total_before > 0 else 0
            
    print("\nREPLAN METRICS")
    print("--------------")
    print(f"Total interviews before: {total_before}")
    print(f"Total interviews after: {total_after}")
    print(f"Unaffected interviews: {unchanged}")
    print(f"Changed interviews: {changed} (Churn: {churn:.1f}%)")
    print(f"  - Moved: {moved}")
    print(f"  - Cancelled: {cancelled}")
    print(f"  - Newly scheduled: {newly_scheduled}")
    print(f"Time changes: {time_changes}")
    print(f"Room changes: {room_changes}")
    print(f"Panel changes: {panel_changes}")

def validate_schedule(db, version_id):
    interviews = db.query(Interview).filter_by(schedule_version_id=version_id, status="SCHEDULED").all()
    student_ivs = {}
    room_ivs = {}
    panel_ivs = {}
    
    for i in interviews:
        student_ivs.setdefault(i.student_id, []).append((i.day, i.start_time, i.end_time))
        if i.room_id:
            room_ivs.setdefault(i.room_id, []).append((i.day, i.start_time, i.end_time))
        if i.panel_id:
            panel_ivs.setdefault(i.panel_id, []).append((i.day, i.start_time, i.end_time))
            
    def check_overlap(ivs):
        for key, arr in ivs.items():
            arr.sort(key=lambda x: (x[0], x[1]))
            for k in range(len(arr)-1):
                assert arr[k][0] != arr[k+1][0] or arr[k][2] <= arr[k+1][1], f"Overlap on {key}"
                
    check_overlap(student_ivs)
    check_overlap(room_ivs)
    check_overlap(panel_ivs)
    print("Validation passed: zero student, room, or panel overlaps.")

def run_scenarios():
    print("--- Setting up In-Memory Database ---")
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    
    try:
        print("--- Generating Mock Data (Production Scale) ---")
        generate_mock_data(db, num_companies=35, num_students=800, num_rooms=20, num_days=4)
        total_shortlists = db.query(StudentShortlist).count()
        print(f"Generated 35 companies, 800 students, 20 rooms. Total shortlists: {total_shortlists}")
        
        print("\n--- Running Greedy Baseline ---")
        t0 = time.time()
        greedy_version = greedy_schedule(db)
        t_greedy = time.time() - t0
        scheduled_greedy = len(greedy_version)
        print(f"Greedy Scheduled: {scheduled_greedy} / {total_shortlists} (Runtime: {t_greedy:.2f}s)")
        
        print("\n--- Running CP-SAT Optimization ---")
        t0 = time.time()
        status, solver, vars_map, rooms, panels = create_schedule(db)
        t_cp = time.time() - t0
        
        # Save V1
        v1 = ScheduleVersion(version_number=1, status=ScheduleStatus.INITIAL)
        db.add(v1)
        db.commit()
        db.refresh(v1)
        
        scheduled_cp = 0
        for idx, v in vars_map.items():
            sl = v["sl"]
            is_scheduled = solver.Value(v["is_scheduled"])
            interview = Interview(schedule_version_id=v1.id, student_id=sl.student_id, company_id=sl.company_id)
            if is_scheduled:
                start_abs = solver.Value(v["start"])
                day = (start_abs // 1440) + 1
                start_time = start_abs % 1440
                end_time = start_time + db.get(Company, sl.company_id).interview_duration
                r_idx = v.get("room_assigned_value")
                p_idx = v.get("panel_assigned_value")
                interview.status = "SCHEDULED"
                interview.day = day
                interview.start_time = start_time
                interview.end_time = end_time
                interview.room_id = rooms[r_idx].id if rooms and r_idx is not None else None
                interview.panel_id = panels[sl.company_id][p_idx].id if p_idx is not None else None
                scheduled_cp += 1
            else:
                interview.status = "UNSCHEDULED"
            db.add(interview)
        db.commit()
        
        print(f"Status: {status} (2=FEASIBLE, 4=OPTIMAL)")
        print(f"CP-SAT Scheduled: {scheduled_cp} / {total_shortlists} (Runtime: {t_cp:.2f}s)")
        
        print_infeasibility(db, v1.id, limit=3)
        validate_schedule(db, v1.id)
        
        print("\n--- Scenario 5: Combined Disaster ---")
        print("Injecting: Largest Day-1 recruiter delayed 3 hours, 1 Panel dropped, 15 Students withdrew.")
        
        # 1. Company Delay
        largest_company = db.query(Company).order_by(Company.priority_tier.asc()).first()
        db.add(Disruption(schedule_version_id=v1.id, disruption_type=DisruptionType.COMPANY_DELAY, target_id=largest_company.id, delay_minutes=180))
        for avail in db.query(CompanyAvailability).filter_by(company_id=largest_company.id).all():
            avail.start_time += 180
            avail.end_time += 180
        
        # 2. Panel dropped
        first_panel = db.query(Panel).filter_by(company_id=largest_company.id).first()
        if first_panel:
            first_panel.is_active = False
            
        # 3. 15 students withdraw
        students = db.query(Student).limit(15).all()
        for s in students:
            s.status = "WITHDRAWN"
        db.commit()
        
        print("Running replanner with change penalties...")
        t0 = time.time()
        replan_status, r_solver, r_vars, r_rooms, r_panels = create_schedule(db, parent_version_id=v1.id)
        t_replan = time.time() - t0
        
        v2 = ScheduleVersion(version_number=2, parent_version_id=v1.id, status=ScheduleStatus.REPLANNED)
        db.add(v2)
        db.commit()
        db.refresh(v2)
        
        replan_scheduled = 0
        for idx, v in r_vars.items():
            sl = v["sl"]
            is_scheduled = r_solver.Value(v["is_scheduled"])
            interview = Interview(schedule_version_id=v2.id, student_id=sl.student_id, company_id=sl.company_id)
            if is_scheduled:
                start_abs = r_solver.Value(v["start"])
                day = (start_abs // 1440) + 1
                start_time = start_abs % 1440
                end_time = start_time + db.get(Company, sl.company_id).interview_duration
                r_idx = v.get("room_assigned_value")
                p_idx = v.get("panel_assigned_value")
                interview.status = "SCHEDULED"
                interview.day = day
                interview.start_time = start_time
                interview.end_time = end_time
                interview.room_id = r_rooms[r_idx].id if r_rooms and r_idx is not None else None
                interview.panel_id = r_panels[sl.company_id][p_idx].id if p_idx is not None else None
                replan_scheduled += 1
            else:
                interview.status = "UNSCHEDULED"
            db.add(interview)
        db.commit()
        
        print(f"Replan Status: {replan_status} (Runtime: {t_replan:.2f}s)")
        
        calculate_diff(db, v1.id, v2.id)
        print("\nValidating V2 invariants...")
        validate_schedule(db, v2.id)
        
    finally:
        db.close()

if __name__ == "__main__":
    run_scenarios()
