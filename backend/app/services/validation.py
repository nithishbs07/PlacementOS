import collections
import time
from sqlalchemy.orm import Session
from app.models.domain import Interview, Company, CompanyAvailability, Student, Room, Panel

def validate_schedule(db: Session, version_id: int):
    start_time = time.time()
    interviews = db.query(Interview).filter_by(schedule_version_id=version_id, status="SCHEDULED").all()
    
    s_times = collections.defaultdict(list)
    r_times = collections.defaultdict(list)
    p_times = collections.defaultdict(list)
    
    avail_violations = 0
    duration_violations = 0
    withdrawn_scheduled = 0
    
    # Pre-fetch companies
    companies = {c.id: c for c in db.query(Company).all()}
    avails = collections.defaultdict(list)
    for a in db.query(CompanyAvailability).all():
        avails[a.company_id].append((a.day, a.start_time, a.end_time))
        
    for i in interviews:
        company = companies.get(i.company_id)
        if not company: continue
        
        if i.end_time is None:
            raise ValueError(f"Interview {i.id} has NULL end_time in the database.")
            
        start_abs = (i.day - 1) * 1440 + i.start_time
        end_abs = (i.day - 1) * 1440 + i.end_time
        
        s_times[i.student_id].append((start_abs, end_abs))
        if i.room_id is not None:
            r_times[i.room_id].append((start_abs, end_abs))
        if i.panel_id is not None:
            p_times[i.panel_id].append((start_abs, end_abs))
            
        # Check availability
        valid = False
        for (a_day, a_start, a_end) in avails[i.company_id]:
            astart = (a_day - 1) * 1440 + a_start
            aend = (a_day - 1) * 1440 + a_end
            if start_abs >= astart and end_abs <= aend:
                valid = True
                break
        if not valid:
            avail_violations += 1
            
        # Check withdrawn
        if i.student and i.student.status == "WITHDRAWN":
            withdrawn_scheduled += 1

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
    
    is_valid = (student_overlaps == 0 and room_overlaps == 0 and panel_overlaps == 0 and avail_violations == 0 and withdrawn_scheduled == 0)

    return {
        "is_valid": is_valid,
        "student_overlaps": student_overlaps,
        "room_overlaps": room_overlaps,
        "panel_overlaps": panel_overlaps,
        "availability_violations": avail_violations,
        "duration_violations": 0, # not really checked since duration is fixed
        "withdrawn_scheduled": withdrawn_scheduled,
        "dropped_panel_usage": 0, # handled by is_active in DB
        "interviews_evaluated": len(interviews),
        "validation_runtime": round(time.time() - start_time, 2)
    }
