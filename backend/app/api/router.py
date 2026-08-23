import collections
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
import time
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.database import get_db
from app.models.domain import ScheduleVersion, ScheduleStatus, Company, Student, Interview, DisruptionType, Room, Disruption, InterviewStatus, DisruptionStatus, StudentShortlist, Panel, CompanyAvailability
from app.services.solver import create_schedule
from app.services.validation import validate_schedule
from app.services.infeasibility import analyze_unscheduled_interview
from app.services.disruption import inject_disruption, get_disruption_impact, apply_disruption
from app.services.diff import calculate_schedule_diff
from app.services.audit import log_action

router = APIRouter()

from pydantic import BaseModel
from typing import List, Optional

# --- Schemas ---
class StudentCreate(BaseModel):
    student_code: str
    name: str
    cgpa: float
    branch: str

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    cgpa: Optional[float] = None
    branch: Optional[str] = None
    status: Optional[str] = None

class CompanyCreate(BaseModel):
    name: str
    industry: str
    priority_tier: int = 3
    cgpa_cutoff: float = 0.0
    branch_eligibility: str = ""
    num_panels: int = 1
    interview_duration: int = 30

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    priority_tier: Optional[int] = None
    cgpa_cutoff: Optional[float] = None
    branch_eligibility: Optional[str] = None
    num_panels: Optional[int] = None
    interview_duration: Optional[int] = None

class RoomCreate(BaseModel):
    name: str

class PanelCreate(BaseModel):
    name: str
    company_id: int
    is_active: bool = True

class PanelUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class DisruptionCreate(BaseModel):
    disruption_type: DisruptionType
    target_id: int
    delay_minutes: int = 0

# --- Companies CRUD ---
@router.get("/companies")
def get_companies(db: Session = Depends(get_db)):
    # Include shortlist count
    companies = db.query(Company).all()
    res = []
    for c in companies:
        shortlist_count = db.query(StudentShortlist).filter_by(company_id=c.id).count()
        scheduled_count = db.query(Interview).filter_by(company_id=c.id, status=InterviewStatus.SCHEDULED).count()
        res.append({
            "id": c.id,
            "name": c.name,
            "industry": c.industry,
            "priority_tier": c.priority_tier,
            "shortlist_count": shortlist_count,
            "scheduled_count": scheduled_count
        })
    return res

@router.get("/companies/{id}")
def get_company(id: int, db: Session = Depends(get_db)):
    c = db.query(Company).filter(Company.id == id).first()
    if not c: raise HTTPException(status_code=404, detail="Company not found")
    
    avail = db.query(CompanyAvailability).filter_by(company_id=c.id).all()
    shortlists = db.query(StudentShortlist).options(joinedload(StudentShortlist.student)).filter_by(company_id=c.id).all()
    
    # Get interviews from active schedule
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    schedule = []
    if active_version:
        interviews = db.query(Interview).options(joinedload(Interview.student), joinedload(Interview.room), joinedload(Interview.panel)).filter_by(company_id=c.id, schedule_version_id=active_version.id).all()
        for iv in interviews:
            schedule.append({
                "id": iv.id, "day": iv.day, "start_time": iv.start_time, "end_time": iv.end_time,
                "student": iv.student.name if iv.student else None,
                "room": iv.room.name if iv.room else None,
                "panel": iv.panel.name if iv.panel else None,
                "status": iv.status
            })
            
    return {
        "id": c.id, "name": c.name, "industry": c.industry, "priority_tier": c.priority_tier,
        "interview_duration": c.interview_duration,
        "availabilities": [{"day": a.day, "start_time": a.start_time, "end_time": a.end_time} for a in avail],
        "shortlists": [{"student_id": s.student.id, "student_name": s.student.name, "branch": s.student.branch} for s in shortlists if s.student],
        "schedule": schedule
    }

@router.post("/companies")
def create_company(comp: CompanyCreate, db: Session = Depends(get_db)):
    db_comp = Company(**comp.dict())
    db.add(db_comp)
    db.commit()
    db.refresh(db_comp)
    return db_comp

@router.patch("/companies/{id}")
def update_company(id: int, comp: CompanyUpdate, db: Session = Depends(get_db)):
    db_comp = db.query(Company).filter(Company.id == id).first()
    if not db_comp: raise HTTPException(status_code=404, detail="Company not found")
    for k, v in comp.dict(exclude_unset=True).items():
        setattr(db_comp, k, v)
    db.commit()
    db.refresh(db_comp)
    return db_comp

@router.delete("/companies/{id}")
def delete_company(id: int, db: Session = Depends(get_db)):
    db_comp = db.query(Company).filter(Company.id == id).first()
    if not db_comp: raise HTTPException(status_code=404, detail="Company not found")
    
    if db.query(Interview).filter_by(company_id=id).first():
        raise HTTPException(status_code=400, detail="Cannot delete company with existing schedule relationships.")
    
    db.query(StudentShortlist).filter_by(company_id=id).delete()
    db.query(CompanyAvailability).filter_by(company_id=id).delete()
    db.query(Panel).filter_by(company_id=id).delete()
    db.delete(db_comp)
    db.commit()
    return {"status": "deleted"}

# --- Students CRUD ---
@router.get("/students")
def get_students(db: Session = Depends(get_db)):
    students = db.query(Student).all()
    return students

@router.get("/students/{id}")
def get_student(id: int, db: Session = Depends(get_db)):
    s = db.query(Student).filter(Student.id == id).first()
    if not s: raise HTTPException(status_code=404, detail="Student not found")
    
    shortlists = db.query(StudentShortlist).options(joinedload(StudentShortlist.company)).filter_by(student_id=s.id).all()
    
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    schedule = []
    if active_version:
        interviews = db.query(Interview).options(joinedload(Interview.company), joinedload(Interview.room), joinedload(Interview.panel)).filter_by(student_id=s.id, schedule_version_id=active_version.id).all()
        for iv in interviews:
            schedule.append({
                "id": iv.id, "day": iv.day, "start_time": iv.start_time, "end_time": iv.end_time,
                "company": iv.company.name if iv.company else None,
                "room": iv.room.name if iv.room else None,
                "panel": iv.panel.name if iv.panel else None,
                "status": iv.status
            })
            
    return {
        "id": s.id, "student_code": s.student_code, "name": s.name, "branch": s.branch, "cgpa": s.cgpa, "status": s.status,
        "shortlists": [{"company_id": sl.company.id, "company_name": sl.company.name} for sl in shortlists if sl.company],
        "schedule": schedule
    }

@router.post("/students")
def create_student(student: StudentCreate, db: Session = Depends(get_db)):
    db_student = Student(**student.dict())
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student

@router.patch("/students/{id}")
def update_student(id: int, student: StudentUpdate, db: Session = Depends(get_db)):
    db_student = db.query(Student).filter(Student.id == id).first()
    if not db_student: raise HTTPException(status_code=404, detail="Student not found")
    for k, v in student.dict(exclude_unset=True).items():
        setattr(db_student, k, v)
    db.commit()
    db.refresh(db_student)
    return db_student

@router.delete("/students/{id}")
def delete_student(id: int, db: Session = Depends(get_db)):
    db_student = db.query(Student).filter(Student.id == id).first()
    if not db_student: raise HTTPException(status_code=404, detail="Student not found")
    
    if db.query(Interview).filter_by(student_id=id).first():
        # Soft delete instead of corrupting history
        db_student.status = "WITHDRAWN"
        db.commit()
        return {"status": "withdrawn"}
        
    db.query(StudentShortlist).filter_by(student_id=id).delete()
    db.delete(db_student)
    db.commit()
    return {"status": "deleted"}

# --- Rooms CRUD ---
@router.get("/rooms")
def get_rooms(db: Session = Depends(get_db)):
    rooms = db.query(Room).all()
    res = []
    
    # Pre-calculate active interviews per room to get utilization
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    iv_counts = {}
    if active_version:
        counts = db.query(Interview.room_id, func.count(Interview.id)).filter_by(
            schedule_version_id=active_version.id, 
            status=InterviewStatus.SCHEDULED
        ).group_by(Interview.room_id).all()
        iv_counts = {r_id: count for r_id, count in counts if r_id is not None}
        
    for r in rooms:
        # Since Room lacks is_active, status is always "Available"
        count = iv_counts.get(r.id, 0)
        res.append({
            "id": r.id,
            "name": r.name,
            "status": "Available",
            "interviews_count": count,
            "utilization": min(100, round((count / 48) * 100)) # assuming 48 slots per day max
        })
    return res

@router.get("/rooms/{id}")
def get_room(id: int, db: Session = Depends(get_db)):
    r = db.query(Room).filter(Room.id == id).first()
    if not r: raise HTTPException(status_code=404, detail="Room not found")
    
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    schedule = []
    if active_version:
        interviews = db.query(Interview).options(joinedload(Interview.company), joinedload(Interview.student)).filter_by(room_id=r.id, schedule_version_id=active_version.id, status=InterviewStatus.SCHEDULED).all()
        for iv in interviews:
            schedule.append({
                "id": iv.id, "day": iv.day, "start_time": iv.start_time, "end_time": iv.end_time,
                "company": iv.company.name if iv.company else None,
                "student": iv.student.name if iv.student else None,
                "student_code": iv.student.student_code if iv.student else None
            })
            
    return {
        "id": r.id, "name": r.name, "status": "Available",
        "schedule": schedule
    }

@router.post("/rooms")
def create_room(room: RoomCreate, db: Session = Depends(get_db)):
    db_room = Room(**room.dict())
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room

@router.delete("/rooms/{id}")
def delete_room(id: int, db: Session = Depends(get_db)):
    db_room = db.query(Room).filter(Room.id == id).first()
    if not db_room: raise HTTPException(status_code=404, detail="Room not found")
    
    if db.query(Interview).filter_by(room_id=id).first():
        raise HTTPException(status_code=400, detail="Cannot delete room with existing schedule relationships. Deactivation is not supported by the domain model.")
    
    db.delete(db_room)
    db.commit()
    return {"status": "deleted"}

# --- Panels CRUD ---
@router.get("/panels")
def get_panels(db: Session = Depends(get_db)):
    panels = db.query(Panel).options(joinedload(Panel.company)).all()
    res = []
    
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    iv_counts = {}
    if active_version:
        counts = db.query(Interview.panel_id, func.count(Interview.id)).filter_by(
            schedule_version_id=active_version.id, 
            status=InterviewStatus.SCHEDULED
        ).group_by(Interview.panel_id).all()
        iv_counts = {p_id: count for p_id, count in counts if p_id is not None}
        
    for p in panels:
        count = iv_counts.get(p.id, 0)
        res.append({
            "id": p.id,
            "name": p.name,
            "company_id": p.company_id,
            "company_name": p.company.name if p.company else None,
            "is_active": p.is_active,
            "interviews_count": count,
            "utilization": min(100, round((count / 48) * 100))
        })
    return res

@router.get("/panels/{id}")
def get_panel(id: int, db: Session = Depends(get_db)):
    p = db.query(Panel).options(joinedload(Panel.company)).filter(Panel.id == id).first()
    if not p: raise HTTPException(status_code=404, detail="Panel not found")
    
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    schedule = []
    if active_version:
        interviews = db.query(Interview).options(joinedload(Interview.company), joinedload(Interview.student)).filter_by(panel_id=p.id, schedule_version_id=active_version.id, status=InterviewStatus.SCHEDULED).all()
        for iv in interviews:
            schedule.append({
                "id": iv.id, "day": iv.day, "start_time": iv.start_time, "end_time": iv.end_time,
                "company": iv.company.name if iv.company else None,
                "student": iv.student.name if iv.student else None,
                "student_code": iv.student.student_code if iv.student else None
            })
            
    return {
        "id": p.id, "name": p.name, "company_id": p.company_id, "company_name": p.company.name if p.company else None,
        "is_active": p.is_active,
        "schedule": schedule
    }

@router.post("/panels")
def create_panel(panel: PanelCreate, db: Session = Depends(get_db)):
    db_panel = Panel(**panel.dict())
    db.add(db_panel)
    db.commit()
    db.refresh(db_panel)
    return db_panel

@router.patch("/panels/{id}")
def update_panel(id: int, panel: PanelUpdate, db: Session = Depends(get_db)):
    db_panel = db.query(Panel).filter(Panel.id == id).first()
    if not db_panel: raise HTTPException(status_code=404, detail="Panel not found")
    for k, v in panel.dict(exclude_unset=True).items():
        setattr(db_panel, k, v)
    db.commit()
    db.refresh(db_panel)
    return db_panel

@router.delete("/panels/{id}")
def delete_panel(id: int, db: Session = Depends(get_db)):
    db_panel = db.query(Panel).filter(Panel.id == id).first()
    if not db_panel: raise HTTPException(status_code=404, detail="Panel not found")
    
    if db.query(Interview).filter_by(panel_id=id).first():
        # Soft deactivate instead of corrupting history
        db_panel.is_active = False
        db.commit()
        return {"status": "deactivated"}
        
    db.delete(db_panel)
    db.commit()
    return {"status": "deleted"}

@router.get("/schedule/versions")
def get_versions(db: Session = Depends(get_db)):
    versions = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).all()
    res = []
    for v in versions:
        iv_count = db.query(func.count(Interview.id)).filter_by(schedule_version_id=v.id, status=InterviewStatus.SCHEDULED).scalar()
        res.append({
            "id": v.id,
            "version_number": v.version_number,
            "parent_version_id": v.parent_version_id,
            "status": v.status,
            "created_at": v.created_at,
            "scheduled_count": iv_count
        })
    return res

@router.get("/schedule/{version_id}/validation")
def get_schedule_validation(version_id: int, db: Session = Depends(get_db)):
    v = db.query(ScheduleVersion).filter_by(id=version_id).first()
    if not v: raise HTTPException(404)
    return validate_schedule(db, version_id)

# --- Operations Job State ---
job_store = {
    "status": "IDLE",
    "stage": "",
    "start_time": 0,
    "runtime": 0,
    "result": None,
    "error": None
}

def generate_schedule_task(db: Session, parent_version_id: int):
    global job_store
    try:
        job_store["stage"] = "SOLVING"
        start_time = time.time()
        
        status, solver, vars_map, rooms, panels_by_company = create_schedule(db, parent_version_id=parent_version_id)
        
        job_store["stage"] = "VALIDATING"
        
        # Determine new version number
        last_v = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
        new_v_num = last_v.version_number + 1 if last_v else 1
        
        # Always save as REPLANNED if there is a parent, else INITIAL
        sched_status = ScheduleStatus.REPLANNED if parent_version_id else ScheduleStatus.INITIAL
        new_version = ScheduleVersion(version_number=new_v_num, parent_version_id=parent_version_id, status=sched_status)
        db.add(new_version)
        db.flush()
        db.refresh(new_version)
        
        scheduled_count = 0
        from ortools.sat.python import cp_model
        if status in [cp_model.FEASIBLE, cp_model.OPTIMAL]:
            for idx, v in vars_map.items():
                if solver.Value(v["is_scheduled"]):
                    scheduled_count += 1
                    iv = Interview(
                        schedule_version_id=new_version.id,
                        student_id=v["sl"].student_id,
                        company_id=v["sl"].company_id,
                        day=(solver.Value(v["start"]) // 1440) + 1,
                        start_time=solver.Value(v["start"]) % 1440,
                        room_id=rooms[v.get("room_assigned_value")].id if rooms and v.get("room_assigned_value") is not None else None,
                        panel_id=panels_by_company[v["sl"].company_id][v.get("panel_assigned_value")].id if panels_by_company and v.get("panel_assigned_value") is not None else None,
                        status=InterviewStatus.SCHEDULED
                    )
                    db.add(iv)
            db.commit()
            
        validation = validate_schedule(db, new_version.id)
        
        total_students = db.query(Student).filter(Student.status != "WITHDRAWN").count()
        total_companies = db.query(Company).count()
        scheduled_students = db.query(Interview.student_id).filter_by(schedule_version_id=new_version.id, status=InterviewStatus.SCHEDULED).distinct().count()
        scheduled_companies = db.query(Interview.company_id).filter_by(schedule_version_id=new_version.id, status=InterviewStatus.SCHEDULED).distinct().count()
        
        job_store["status"] = "COMPLETED"
        job_store["stage"] = "COMPLETED"
        job_store["runtime"] = round(time.time() - start_time, 2)
        job_store["result"] = {
            "version_id": new_version.id,
            "solver_status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE" if status == cp_model.FEASIBLE else "INFEASIBLE",
            "scheduled_count": scheduled_count,
            "unscheduled_count": len(vars_map) - scheduled_count,
            "coverage": round((scheduled_students / max(1, total_students)) * 100),
            "utilization": round((scheduled_companies / max(1, total_companies)) * 100),
            "validation": validation
        }
        
        # Audit Logs
        log_action(db, "Schedule generated", "ScheduleVersion", new_version.id, new_version.id, metadata=job_store["result"])
        log_action(db, "Schedule validated", "ScheduleVersion", new_version.id, new_version.id, metadata=validation)
        
    except Exception as e:
        job_store["status"] = "FAILED"
        job_store["error"] = str(e)
        db.rollback()
    finally:
        db.close()

@router.get("/operations/status")
def get_operations_status(db: Session = Depends(get_db)):
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    stats = None
    if active_version:
        iv_count = db.query(func.count(Interview.id)).filter_by(schedule_version_id=active_version.id, status=InterviewStatus.SCHEDULED).scalar()
        unscheduled_count = db.query(func.count(StudentShortlist.id)).scalar() - iv_count
        companies_covered = db.query(func.count(func.distinct(Interview.company_id))).filter_by(schedule_version_id=active_version.id, status=InterviewStatus.SCHEDULED).scalar()
        students_scheduled = db.query(func.count(func.distinct(Interview.student_id))).filter_by(schedule_version_id=active_version.id, status=InterviewStatus.SCHEDULED).scalar()
        
        stats = {
            "version_id": active_version.id,
            "timestamp": active_version.created_at,
            "scheduled_count": iv_count,
            "unscheduled_count": unscheduled_count,
            "companies_covered": companies_covered,
            "students_scheduled": students_scheduled
        }
    
    return {
        "job": job_store,
        "active_schedule": stats
    }

@router.post("/schedule/generate")
def trigger_generation(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    global job_store
    if job_store["status"] == "RUNNING":
        raise HTTPException(400, "A schedule generation job is already running.")
        
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    parent_id = active_version.id if active_version else None
    
    job_store = {
        "status": "RUNNING",
        "stage": "READY",
        "start_time": time.time(),
        "runtime": 0,
        "result": None,
        "error": None
    }
    
    from app.core.database import SessionLocal
    background_db = SessionLocal()
    background_tasks.add_task(generate_schedule_task, background_db, parent_id)
    return {"message": "Generation started"}

@router.get("/schedule/active")
def get_active_schedule(db: Session = Depends(get_db)):
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    if not active_version:
        raise HTTPException(status_code=404, detail="No active schedule found")
    return get_schedule(active_version.id, db)

@router.get("/schedule/lineage")
def get_schedule_lineage(db: Session = Depends(get_db)):
    # Returns the history tree: V1 -> disruption -> V2 -> disruption -> V3 etc.
    versions = db.query(ScheduleVersion).order_by(ScheduleVersion.id.asc()).all()
    disruptions = db.query(Disruption).all()
    
    # map disruptions to their target versions
    d_map = collections.defaultdict(list)
    for d in disruptions:
        d_map[d.schedule_version_id].append({
            "id": d.id,
            "type": d.disruption_type.name,
            "status": d.status.name,
            "target_id": d.target_id
        })
        
    lineage = []
    for v in versions:
        iv_count = db.query(func.count(Interview.id)).filter_by(schedule_version_id=v.id, status=InterviewStatus.SCHEDULED).scalar()
        lineage.append({
            "id": v.id,
            "version_number": v.version_number,
            "parent_version_id": v.parent_version_id,
            "status": v.status.name,
            "created_at": v.created_at,
            "scheduled_count": iv_count,
            "disruptions": d_map[v.id]
        })
    return lineage

@router.get("/schedule/{version_id}")
def get_schedule(version_id: int, db: Session = Depends(get_db)):
    # Eagerly load relationships to avoid N+1 queries and provide full context
    interviews = db.query(Interview)\
        .options(
            joinedload(Interview.company),
            joinedload(Interview.student),
            joinedload(Interview.room),
            joinedload(Interview.panel)
        )\
        .filter_by(schedule_version_id=version_id)\
        .all()
    
    version = db.query(ScheduleVersion).filter_by(id=version_id).first()
    
    result = []
    for iv in interviews:
        result.append({
            "id": iv.id,
            "status": iv.status,
            "day": iv.day,
            "start_time": iv.start_time,
            "end_time": iv.end_time,
            "company": iv.company.name if iv.company else None,
            "student": iv.student.name if iv.student else None,
            "student_code": iv.student.student_code if iv.student else None,
            "room": iv.room.name if iv.room else None,
            "panel": iv.panel.name if iv.panel else None,
            "version_id": version_id,
            "version_status": version.status if version else None
        })
    return {"version_id": version_id, "interviews": result}

@router.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_companies = db.query(Company).count()
    total_students = db.query(Student).count()
    total_rooms = db.query(Room).count()
    
    # Get active schedule version (latest)
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    
    scheduled_interviews = 0
    conflicts = 0
    utilization = 0.0
    pending_disruptions = 0
    schedule_health = 100.0
    next_interviews = []
    
    if active_version:
        interviews = db.query(Interview).filter_by(
            schedule_version_id=active_version.id, 
            status=InterviewStatus.SCHEDULED
        ).order_by(Interview.day, Interview.start_time).all()
        
        scheduled_interviews = len(interviews)
        
        pending_disruptions = db.query(Disruption).filter_by(
            schedule_version_id=active_version.id,
            status=DisruptionStatus.PENDING
        ).count()
        
        # Pull utilization logic from analytics (simple version)
        utilization = min(100.0, round((scheduled_interviews / max(1, total_rooms * 48)) * 100, 1))
        
        if pending_disruptions > 0:
            schedule_health = 85.0
        else:
            schedule_health = 100.0
            
        # Top 5 upcoming (simplification for dashboard)
        for iv in interviews[:5]:
            next_interviews.append({
                "id": iv.id,
                "time": f"09:{str(iv.start_time).rjust(2, '0')}" if iv.start_time < 60 else f"{9 + iv.start_time // 60}:{str(iv.start_time % 60).rjust(2, '0')}",
                "company": iv.company.name if iv.company else "Unknown",
                "student": iv.student.name if iv.student else "Unknown",
                "room": iv.room.name if iv.room else "TBD"
            })

    return {
        "total_companies": total_companies,
        "total_rooms": total_rooms,
        "scheduled_students": total_students,
        "today_interviews": scheduled_interviews,
        "utilization": round(utilization),
        "conflicts": conflicts,
        "pending_disruptions": pending_disruptions,
        "schedule_health": round(schedule_health),
        "active_version": active_version.version_number if active_version else None,
        "next_interviews": next_interviews
    }

from app.services.generator import generate_mock_data

@router.post("/schedule/generate/initial")
def generate_initial_schedule(db: Session = Depends(get_db)):
    if db.query(Company).count() == 0:
        generate_mock_data(db, num_companies=35, num_students=800, num_rooms=20, num_days=4)
        
    status, solver, vars_map, rooms, panels = create_schedule(db)
    
    if status in [4, 2]: # OPTIMAL=4, FEASIBLE=2 in OR-Tools Python
        new_version = ScheduleVersion(version_number=1, status=ScheduleStatus.INITIAL)
        db.add(new_version)
        db.commit()
        db.refresh(new_version)
        
        # Save scheduled interviews
        for idx, v in vars_map.items():
            is_scheduled = solver.Value(v["is_scheduled"])
            sl = v["sl"]
            
            interview = Interview(
                schedule_version_id=new_version.id,
                student_id=sl.student_id,
                company_id=sl.company_id,
            )
            
            if is_scheduled:
                start_abs = solver.Value(v["start"])
                day = (start_abs // 1440) + 1
                start_time = start_abs % 1440
                end_time = start_time + db.get(Company, sl.company_id).interview_duration
                
                interview.day = day
                interview.start_time = start_time
                interview.end_time = end_time
                r_idx = v.get("room_assigned_value")
                p_idx = v.get("panel_assigned_value")
                interview.room_id = rooms[r_idx].id if rooms and r_idx is not None else None
                
                # Panel
                if p_idx is not None:
                    interview.panel_id = panels[sl.company_id][p_idx].id
            else:
                interview.status = "UNSCHEDULED"
                # TODO: use infeasibility engine here
                interview.unscheduled_reason = "No feasible slot found."
                
            db.add(interview)
            
        db.commit()
        return {"status": "success", "version_id": new_version.id}
    else:
        raise HTTPException(status_code=400, detail="Could not generate schedule")

# --- Phase 6 Disruption Center ---
@router.get("/disruptions")
def get_disruptions(db: Session = Depends(get_db)):
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    version_id = active_version.id if active_version else 0
    return db.query(Disruption).filter_by(schedule_version_id=version_id).order_by(Disruption.id.desc()).all()

@router.post("/disruptions")
def create_disruption(d: DisruptionCreate, db: Session = Depends(get_db)):
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    if not active_version: raise HTTPException(400, "No active schedule")
    disruption = inject_disruption(db, active_version.id, d.disruption_type, d.target_id, d.delay_minutes)
    log_action(db, "Disruption pending", "Disruption", disruption.id, active_version.id, metadata={"type": d.disruption_type, "target": d.target_id})
    return disruption

@router.get("/disruptions/{id}")
def get_disruption(id: int, db: Session = Depends(get_db)):
    d = db.query(Disruption).filter_by(id=id).first()
    if not d: raise HTTPException(404)
    return d

@router.post("/disruptions/{id}/preview")
def preview_disruption(id: int, db: Session = Depends(get_db)):
    d = db.query(Disruption).filter_by(id=id).first()
    if not d: raise HTTPException(404)
    
    affected_interviews = get_disruption_impact(db, d.schedule_version_id, d.disruption_type, d.target_id)
    
    res = []
    for iv in affected_interviews:
        student = db.query(Student).get(iv.student_id)
        company = db.query(Company).get(iv.company_id)
        res.append({
            "interview_id": iv.id,
            "student_name": student.name if student else "Unknown",
            "company_name": company.name if company else "Unknown",
            "day": iv.day,
            "start_time": iv.start_time
        })
    return {"affected_count": len(res), "affected_interviews": res}

@router.post("/disruptions/{id}/apply")
def apply_disruption_route(id: int, db: Session = Depends(get_db)):
    d = db.query(Disruption).filter_by(id=id).first()
    if not d: raise HTTPException(404)
    if d.status == DisruptionStatus.APPLIED:
        raise HTTPException(400, "Already applied")
    
    applied = apply_disruption(db, id)
    log_action(db, "Disruption applied", "Disruption", id, d.schedule_version_id, metadata={"type": d.disruption_type})
    return applied

replan_job_store = {
    "status": "IDLE",
    "stage": "",
    "start_time": 0,
    "runtime": 0,
    "result": None,
    "error": None
}

def execute_replan_task(db: Session, parent_version_id: int):
    global replan_job_store
    try:
        replan_job_store["stage"] = "PRESERVING SCHEDULE"
        start_time = time.time()
        
        # We assume the solver's internal logger prints or tracks stages,
        # but the function `create_schedule` runs all stages synchronously.
        # So we just say "MINIMIZING CANCELLATIONS" / "MINIMIZING MOVEMENT" etc based on elapsed time 
        # or just let it run. To be accurate to the solver's stages without modifying it,
        # we just set the stage to "SOLVING" essentially. But UI expects the stages.
        # We will just show SOLVING. The user said: "The UI must make it clear that these correspond to the existing four lexicographic optimization stages... Do not fake progress. Use actual backend job state."
        # Wait, if `create_schedule` is frozen, we can't emit intermediate stages unless we hook stdout.
        # We will just map it to SOLVING, and when it returns we say VALIDATING.
        replan_job_store["stage"] = "LEXICOGRAPHIC SOLVING"
        
        # Apply any pending disruptions for the active schedule before generating
        pending_disruptions = db.query(Disruption).filter_by(
            schedule_version_id=parent_version_id, 
            status=DisruptionStatus.PENDING
        ).all()
        for d in pending_disruptions:
            apply_disruption(db, d.id)
            log_action(db, "Disruption applied by Replan Engine", "Disruption", d.id, parent_version_id, metadata={"type": d.disruption_type.name})
            
        status, solver, vars_map, rooms, panels = create_schedule(db, parent_version_id=parent_version_id)
        
        replan_job_store["stage"] = "VALIDATING"
        
        last_v = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
        new_v_num = last_v.version_number + 1 if last_v else 1
        
        new_version = ScheduleVersion(version_number=new_v_num, parent_version_id=parent_version_id, status=ScheduleStatus.REPLANNED)
        db.add(new_version)
        db.flush()
        db.refresh(new_version)
        
        scheduled_count = 0
        from ortools.sat.python import cp_model
        
        v2_interviews_list = []
        if status in [cp_model.FEASIBLE, cp_model.OPTIMAL]:
            for idx, v in vars_map.items():
                if solver.Value(v["is_scheduled"]):
                    scheduled_count += 1
                    iv = Interview(
                        schedule_version_id=new_version.id,
                        student_id=v["sl"].student_id,
                        company_id=v["sl"].company_id,
                        day=(solver.Value(v["start"]) // 1440) + 1,
                        start_time=solver.Value(v["start"]) % 1440,
                        room_id=rooms[v.get("room_assigned_value")].id if rooms and v.get("room_assigned_value") is not None else None,
                        panel_id=panels[v["sl"].company_id][v.get("panel_assigned_value")].id if panels and v.get("panel_assigned_value") is not None else None,
                        status=InterviewStatus.SCHEDULED
                    )
                    db.add(iv)
                    v2_interviews_list.append(iv)
            db.commit()
            
        validation = validate_schedule(db, new_version.id)
        
        # Calculate diffs
        v1_interviews_list = db.query(Interview).filter_by(schedule_version_id=parent_version_id, status=InterviewStatus.SCHEDULED).all()
        diff_metrics = calculate_schedule_diff(db, v1_interviews_list, v2_interviews_list, parent_version_id)
        
        total_students = db.query(Student).filter(Student.status != "WITHDRAWN").count()
        total_companies = db.query(Company).count()
        scheduled_students = db.query(Interview.student_id).filter_by(schedule_version_id=new_version.id, status=InterviewStatus.SCHEDULED).distinct().count()
        scheduled_companies = db.query(Interview.company_id).filter_by(schedule_version_id=new_version.id, status=InterviewStatus.SCHEDULED).distinct().count()
        
        replan_job_store["status"] = "COMPLETED"
        replan_job_store["stage"] = "COMPLETED"
        replan_job_store["runtime"] = round(time.time() - start_time, 2)
        replan_job_store["result"] = {
            "version_id": new_version.id,
            "solver_status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE" if status == cp_model.FEASIBLE else "INFEASIBLE",
            "scheduled_count": scheduled_count,
            "unscheduled_count": len(vars_map) - scheduled_count,
            "coverage": round((scheduled_students / max(1, total_students)) * 100),
            "utilization": round((scheduled_companies / max(1, total_companies)) * 100),
            "validation": validation,
            "diff": diff_metrics["metrics"] # only return metrics to the job store
        }
        
        # Audit Logs
        log_action(db, "Replan completed", "ScheduleVersion", new_version.id, new_version.id, metadata=replan_job_store["result"])
        log_action(db, "Schedule validated", "ScheduleVersion", new_version.id, new_version.id, metadata=validation)
        
    except Exception as e:
        replan_job_store["status"] = "FAILED"
        replan_job_store["error"] = str(e)
        db.rollback()
    finally:
        db.close()

@router.get("/replan/status")
def get_replan_status():
    return replan_job_store

@router.post("/schedule/{version_id}/replan")
def trigger_replanning(version_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    global replan_job_store
    if replan_job_store["status"] == "RUNNING":
        raise HTTPException(400, "A replan job is already running.")
        
    replan_job_store = {
        "status": "RUNNING",
        "stage": "READY",
        "start_time": time.time(),
        "runtime": 0,
        "result": None,
        "error": None
    }
    
    log_action(db, "Replan initiated", "ScheduleVersion", version_id, version_id)
    
    from app.core.database import SessionLocal
    background_db = SessionLocal()
    background_tasks.add_task(execute_replan_task, background_db, version_id)
    return {"message": "Replan started"}

@router.get("/schedule/{v1_id}/diff/{v2_id}")
def get_schedule_diff(v1_id: int, v2_id: int, db: Session = Depends(get_db)):
    v1_interviews = db.query(Interview).filter_by(schedule_version_id=v1_id, status=InterviewStatus.SCHEDULED).all()
    v2_interviews = db.query(Interview).filter_by(schedule_version_id=v2_id, status=InterviewStatus.SCHEDULED).all()
    
    diff_data = calculate_schedule_diff(db, v1_interviews, v2_interviews, v1_id)
    
    # Enrich detailed diffs with entity names
    student_ids = set()
    company_ids = set()
    room_ids = set()
    panel_ids = set()
    
    for d in diff_data["details"]:
        student_ids.add(d["student_id"])
        company_ids.add(d["company_id"])
        if d["previous"]:
            if d["previous"]["room_id"]: room_ids.add(d["previous"]["room_id"])
            if d["previous"]["panel_id"]: panel_ids.add(d["previous"]["panel_id"])
        if d["new"]:
            if d["new"]["room_id"]: room_ids.add(d["new"]["room_id"])
            if d["new"]["panel_id"]: panel_ids.add(d["new"]["panel_id"])
            
    students = {s.id: s.name for s in db.query(Student).filter(Student.id.in_(student_ids)).all()} if student_ids else {}
    companies = {c.id: c.name for c in db.query(Company).filter(Company.id.in_(company_ids)).all()} if company_ids else {}
    rooms = {r.id: r.name for r in db.query(Room).filter(Room.id.in_(room_ids)).all()} if room_ids else {}
    panels = {p.id: p.name for p in db.query(Panel).filter(Panel.id.in_(panel_ids)).all()} if panel_ids else {}
    
    for d in diff_data["details"]:
        d["student_name"] = students.get(d["student_id"], "Unknown")
        d["company_name"] = companies.get(d["company_id"], "Unknown")
        if d["previous"]:
            d["previous"]["room_name"] = rooms.get(d["previous"]["room_id"], "Unknown") if d["previous"]["room_id"] else None
            d["previous"]["panel_name"] = panels.get(d["previous"]["panel_id"], "Unknown") if d["previous"]["panel_id"] else None
        if d["new"]:
            d["new"]["room_name"] = rooms.get(d["new"]["room_id"], "Unknown") if d["new"]["room_id"] else None
            d["new"]["panel_name"] = panels.get(d["new"]["panel_id"], "Unknown") if d["new"]["panel_id"] else None
            
    return diff_data

from app.services.analytics import get_full_analytics

@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    return get_full_analytics(db)

from app.models.domain import AuditLog

@router.get("/audit-logs")
def get_audit_logs(schedule_version_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(AuditLog).order_by(AuditLog.id.desc())
    if schedule_version_id:
        query = query.filter_by(schedule_version_id=schedule_version_id)
    return query.all()

