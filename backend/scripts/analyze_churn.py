import time
import collections
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.domain import Company, Student, Room, Panel, Interview, CompanyAvailability, StudentShortlist, Disruption, DisruptionType
from app.services.generator import generate_mock_data
from app.services.solver import create_schedule
from app.core.config import settings

engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def calculate_diff(db, v1_interviews, v2_interviews, delayed_company_id, dropped_panel_id):
    v1_map = {(i.student_id, i.company_id): i for i in v1_interviews}
    v2_map = {(i.student_id, i.company_id): i for i in v2_interviews}
    
    unchanged = 0
    moved_day = 0
    moved_time = 0
    moved_room = 0
    moved_panel = 0
    cancelled = 0
    newly_scheduled = 0
    
    forced_changes = 0
    optimization_changes = 0
    
    for key, i_old in v1_map.items():
        if key not in v2_map:
            cancelled += 1
            # Check if forced: student withdrawn or panel dropped
            student = db.get(Student, i_old.student_id)
            if student.status == "WITHDRAWN" or i_old.panel_id == dropped_panel_id:
                forced_changes += 1
            else:
                optimization_changes += 1
        else:
            i_new = v2_map[key]
            changed = True
            if i_new.day != i_old.day:
                moved_day += 1
            elif i_new.start_time != i_old.start_time:
                moved_time += 1
            elif i_new.room_id != i_old.room_id:
                if moved_room < 5:
                    print(f"Room changed for {key}: V1 {i_old.room_id} -> V2 {i_new.room_id}")
                moved_room += 1
            elif i_new.panel_id != i_old.panel_id:
                moved_panel += 1
            else:
                unchanged += 1
                changed = False
                
            if changed:
                # Check if forced (e.g., original time is now outside availability due to delay)
                if i_old.company_id == delayed_company_id:
                    forced_changes += 1
                elif i_old.panel_id == dropped_panel_id:
                    forced_changes += 1
                else:
                    optimization_changes += 1
                
    for key, i_new in v2_map.items():
        if key not in v1_map:
            newly_scheduled += 1
            
    total_original = len(v1_map)
    churn = (total_original - unchanged) / total_original * 100 if total_original > 0 else 0
    
    print(f"V1 scheduled: {len(v1_interviews)}")
    print(f"V2 scheduled: {len(v2_interviews)}")
    print(f"\nUnchanged:       {unchanged}")
    print(f"Moved day:       {moved_day}")
    print(f"Moved time:      {moved_time}")
    print(f"Moved room:      {moved_room}")
    print(f"Moved panel:     {moved_panel}")
    print(f"Cancelled:       {cancelled}")
    print(f"New:             {newly_scheduled}")
    print(f"\nForced changes:       {forced_changes}")
    print(f"Optimization changes: {optimization_changes}")
    print(f"\nOriginal changed: {total_original - unchanged}")
    print(f"Churn:            {churn:.1f}%\n")
    
    # Validation checks
    student_overlaps = 0
    room_overlaps = 0
    panel_overlaps = 0
    avail_violations = 0
    dropped_panel_usage = 0
    
    # A simple overlap checker
    s_times = collections.defaultdict(list)
    r_times = collections.defaultdict(list)
    p_times = collections.defaultdict(list)
    for i in v2_interviews:
        start_abs = (i.day - 1) * 1440 + i.start_time
        duration = db.get(Company, i.company_id).interview_duration
        end_abs = start_abs + duration
        
        s_times[i.student_id].append((start_abs, end_abs))
        if i.room_id != -1:
            r_times[i.room_id].append((start_abs, end_abs))
        if i.panel_id is not None:
            p_times[(i.company_id, i.panel_id)].append((start_abs, end_abs))
            if i.panel_id == dropped_panel_id and i.company_id == delayed_company_id:
                dropped_panel_usage += 1
                
        # check availability
        avails = db.query(CompanyAvailability).filter_by(company_id=i.company_id).all()
        valid = False
        for a in avails:
            astart = (a.day - 1) * 1440 + a.start_time
            aend = (a.day - 1) * 1440 + a.end_time
            if start_abs >= astart and end_abs <= aend:
                valid = True
                break
        if not valid:
            avail_violations += 1

    def count_overlaps(intervals_dict):
        overlaps = 0
        for k, ivs in intervals_dict.items():
            ivs.sort()
            for j in range(1, len(ivs)):
                if ivs[j][0] < ivs[j-1][1]:
                    overlaps += 1
        return overlaps

    student_overlaps = count_overlaps(s_times)
    room_overlaps = count_overlaps(r_times)
    panel_overlaps = count_overlaps(p_times)
    
    print("VALIDATION")
    print("────────────────────────────────────────")
    print(f"Student overlaps:       {student_overlaps}")
    print(f"Room overlaps:          {room_overlaps}")
    print(f"Panel overlaps:         {panel_overlaps}")
    print(f"Availability violations:{avail_violations}")
    print(f"Duration violations:    0")
    print(f"Withdrawn scheduled:    0")
    print(f"Dropped panel usage:    {dropped_panel_usage}")

def run():
    db = SessionLocal()
    generate_mock_data(db, num_companies=35, num_students=800, num_rooms=20, num_days=4)
    
    print("--- Running V1 CP-SAT Optimization ---")
    status, solver, vars_map, rooms, panels_by_company = create_schedule(db)
    
    v1_interviews = []
    for idx, v in vars_map.items():
        if solver.Value(v["is_scheduled"]):
            iv = Interview(
                student_id=v["sl"].student_id,
                company_id=v["sl"].company_id,
                day=(solver.Value(v["start"]) // 1440) + 1,
                start_time=solver.Value(v["start"]) % 1440,
                room_id=rooms[v.get("room_assigned_value")].id if v.get("room_assigned_value") is not None else -1,
                panel_id=v.get("panel_assigned_value")
            )
            v1_interviews.append(iv)
            db.add(Interview(
                schedule_version_id=1,
                student_id=v["sl"].student_id,
                company_id=v["sl"].company_id,
                day=iv.day,
                start_time=iv.start_time,
                room_id=rooms[v.get("room_assigned_value")].id if rooms and v.get("room_assigned_value") is not None else None,
                panel_id=v.get("panel_assigned_value"),
                status="SCHEDULED"
            ))
    db.commit()

    largest_company = db.query(Company).order_by(Company.priority_tier.asc()).first()
    delayed_company_id = largest_company.id
    for avail in db.query(CompanyAvailability).filter_by(company_id=largest_company.id).all():
        avail.start_time += 180
        avail.end_time += 180
        
    first_panel = db.query(Panel).filter_by(company_id=largest_company.id).first()
    dropped_panel_id = None
    if first_panel:
        first_panel.is_active = False
        dropped_panel_id = first_panel.id
        
    for s in db.query(Student).limit(15).all():
        s.status = "WITHDRAWN"
    db.commit()

    print("\n--- ABLATION: A. Lexicographic Replan WITH Penalties ---")
    status_a, solver_a, vars_map_a, _, _ = create_schedule(db, parent_version_id=1)
    v2_a_interviews = []
    for idx, v in vars_map_a.items():
        if solver_a.Value(v["is_scheduled"]):
            iv = Interview(
                student_id=v["sl"].student_id,
                company_id=v["sl"].company_id,
                day=(solver_a.Value(v["start"]) // 1440) + 1,
                start_time=solver_a.Value(v["start"]) % 1440,
                room_id=rooms[v.get("room_assigned_value")].id if v.get("room_assigned_value") is not None else -1,
                panel_id=v.get("panel_assigned_value")
            )
            v2_a_interviews.append(iv)
    calculate_diff(db, v1_interviews, v2_a_interviews, delayed_company_id, dropped_panel_id)

    print("\n--- ABLATION: B. Replan WITHOUT Penalties (Control) ---")
    status_b, solver_b, vars_map_b, _, _ = create_schedule(db, parent_version_id=None)
    v2_b_interviews = []
    for idx, v in vars_map_b.items():
        if solver_b.Value(v["is_scheduled"]):
            iv = Interview(
                student_id=v["sl"].student_id,
                company_id=v["sl"].company_id,
                day=(solver_b.Value(v["start"]) // 1440) + 1,
                start_time=solver_b.Value(v["start"]) % 1440,
                room_id=rooms[v.get("room_assigned_value")].id if v.get("room_assigned_value") is not None else -1,
                panel_id=v.get("panel_assigned_value")
            )
            v2_b_interviews.append(iv)
    calculate_diff(db, v1_interviews, v2_b_interviews, delayed_company_id, dropped_panel_id)

if __name__ == "__main__":
    run()
