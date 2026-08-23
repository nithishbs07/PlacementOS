import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.domain import Company, Student, Room, Panel, Interview, CompanyAvailability
from app.services.generator import generate_mock_data
from app.services.solver import create_schedule

@pytest.fixture(scope="module")
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    
    # Use 35/800 dataset for acceptance validation
    generate_mock_data(db, num_companies=35, num_students=800, num_rooms=20, num_days=4)
    
    yield db
    db.close()

def get_scheduled_interviews(db, solver, vars_map, rooms, panels_by_company):
    interviews = []
    for idx, v in vars_map.items():
        if solver.Value(v["is_scheduled"]):
            c_id = v["sl"].company_id
            start = solver.Value(v["start"])
            duration = db.get(Company, c_id).interview_duration
            r_idx = v.get("room_assigned_value")
            p_idx = v.get("panel_assigned_value")
            
            interviews.append({
                "student_id": v["sl"].student_id,
                "company_id": c_id,
                "start": start,
                "duration": duration,
                "end": start + duration,
                "room_id": rooms[r_idx].id if rooms else None,
                "panel_id": panels_by_company[c_id][p_idx].id if p_idx is not None else None
            })
    return interviews

def check_no_overlap(intervals_dict, entity_name):
    for entity_id, intervals in intervals_dict.items():
        intervals.sort(key=lambda x: x[0])
        for i in range(len(intervals) - 1):
            assert intervals[i][1] <= intervals[i+1][0], f"Overlap detected for {entity_name} {entity_id}"

def test_hard_constraints(test_db):
    status, solver, vars_map, rooms, panels_by_company = create_schedule(test_db)
    if status not in [2, 4]:
        print("\nSOLVER FAILED. STATS:")
        print(solver.ResponseStats())
    assert status in [2, 4], "Scheduler should find a feasible or optimal solution"
    
    interviews = get_scheduled_interviews(test_db, solver, vars_map, rooms, panels_by_company)
    
    student_intervals = {}
    room_intervals = {}
    panel_intervals = {}
    
    for iv in interviews:
        # Check correct duration
        c = test_db.get(Company, iv["company_id"])
        assert iv["end"] - iv["start"] == c.interview_duration, "Incorrect interview duration"
        
        # Check company availability compliance
        avails = test_db.query(CompanyAvailability).filter_by(company_id=c.id).all()
        is_available = False
        for a in avails:
            avail_start = (a.day - 1) * 1440 + a.start_time
            avail_end = (a.day - 1) * 1440 + a.end_time
            if iv["start"] >= avail_start and iv["end"] <= avail_end:
                is_available = True
                break
        assert is_available, f"Interview for company {c.id} scheduled outside availability window"
        
        # Collect intervals for overlap checks
        student_intervals.setdefault(iv["student_id"], []).append((iv["start"], iv["end"]))
        if iv["room_id"]:
            room_intervals.setdefault(iv["room_id"], []).append((iv["start"], iv["end"]))
        if iv["panel_id"]:
            panel_intervals.setdefault(iv["panel_id"], []).append((iv["start"], iv["end"]))
            
    # Run overlap checks
    check_no_overlap(student_intervals, "student")
    check_no_overlap(room_intervals, "room")
    check_no_overlap(panel_intervals, "panel")
    
    # Assert no withdrawn student remains scheduled
    for iv in interviews:
        student = test_db.get(Student, iv["student_id"])
        assert student.status != "WITHDRAWN", f"Withdrawn student {student.id} was scheduled"
