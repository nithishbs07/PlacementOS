from sqlalchemy.orm import Session
from app.models.domain import Company, Student, StudentShortlist, CompanyAvailability, Room, Panel, Interview
import collections

def greedy_schedule(db: Session):
    """
    Earliest Available Slot Greedy Scheduler Baseline.
    """
    companies = db.query(Company).all()
    rooms = db.query(Room).all()
    shortlists = db.query(StudentShortlist).all()
    avails = db.query(CompanyAvailability).all()
    
    # Sort shortlists by company priority then student cgpa
    shortlists.sort(key=lambda x: (x.company.priority_tier, -x.student.cgpa))
    
    # Simple data structures to track time usage (integer minutes)
    room_usage = collections.defaultdict(list) # room_id -> list of (start, end)
    student_usage = collections.defaultdict(list) # student_id -> list of (start, end)
    panel_usage = collections.defaultdict(list) # panel_id -> list of (start, end)
    
    scheduled_interviews = []
    
    def overlaps(usage_list, start, end):
        for us, ue in usage_list:
            if not (end <= us or start >= ue):
                return True
        return False

    for sl in shortlists:
        c = sl.company
        duration = c.interview_duration
        c_avails = [a for a in avails if a.company_id == c.id]
        
        # Find first valid slot
        assigned = False
        for avail in c_avails:
            if assigned: break
            
            day_offset = (avail.day - 1) * 1440
            start_search = day_offset + avail.start_time
            end_search = day_offset + avail.end_time
            
            curr_start = start_search
            while curr_start + duration <= end_search:
                curr_end = curr_start + duration
                
                # Check student
                if overlaps(student_usage[sl.student_id], curr_start, curr_end):
                    curr_start += 15 # step by 15 mins
                    continue
                    
                # Check Room
                available_room = None
                for r in rooms:
                    if not overlaps(room_usage[r.id], curr_start, curr_end):
                        available_room = r
                        break
                
                if not available_room:
                    curr_start += 15
                    continue
                    
                # Check Panel
                available_panel = None
                for p in c.panels:
                    if not overlaps(panel_usage[p.id], curr_start, curr_end):
                        available_panel = p
                        break
                        
                if not available_panel:
                    curr_start += 15
                    continue
                    
                # Assign
                student_usage[sl.student_id].append((curr_start, curr_end))
                room_usage[available_room.id].append((curr_start, curr_end))
                panel_usage[available_panel.id].append((curr_start, curr_end))
                
                scheduled_interviews.append({
                    "student_id": sl.student_id,
                    "company_id": c.id,
                    "room_id": available_room.id,
                    "panel_id": available_panel.id,
                    "start_abs": curr_start,
                    "end_abs": curr_end
                })
                assigned = True
                break
                
    return scheduled_interviews
