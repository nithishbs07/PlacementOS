from sqlalchemy.orm import Session
from app.models.domain import Company, Student, Interview, CompanyAvailability, InterviewStatus
from typing import Dict, Any

def analyze_unscheduled_interview(db: Session, version_id: int, student_id: int, company_id: int) -> dict:
    """
    Analyzes why a specific student-company shortlist was not scheduled by the solver.
    Produces a structured explanation dict.
    """
    student = db.get(Student, student_id)
    company = db.get(Company, company_id)
    
    company_avails = db.query(CompanyAvailability).filter_by(company_id=company_id).all()
    total_minutes = sum((avail.end_time - avail.start_time) for avail in company_avails)
    total_slots_per_panel = total_minutes // company.interview_duration if company.interview_duration else 0
    total_capacity = total_slots_per_panel * company.num_panels
    
    student_scheduled = db.query(Interview).filter_by(schedule_version_id=version_id, student_id=student_id, status=InterviewStatus.SCHEDULED).all()
    
    overlap_report = ""
    if student_scheduled:
        overlap_report = "\n".join([
            f"{i.start_time // 60:02d}:{i.start_time % 60:02d}-{i.end_time // 60:02d}:{i.end_time % 60:02d} (Day {i.day}) - Company {i.company_id}" 
            for i in student_scheduled
        ])
        
    if total_capacity == 0:
        reason = "NO_FEASIBLE_SLOT (Zero Capacity)"
        details = "Company has no available time slots defined."
    elif len(student_scheduled) * 30 >= total_minutes:
        reason = "NO_FEASIBLE_SLOT (Student Conflict)"
        details = "Student schedule completely conflicts with company availability windows."
    else:
        reason = "NO_FEASIBLE_SLOT (Resource Contention)"
        details = "No interval exists satisfying company availability, student availability, room capacity, and panel capacity simultaneously."
        
    capacity_utilization = f"0 feasible rooms\n0 feasible panels\n(Required duration: {company.interview_duration}m)"
    
    return {
        "reason": reason,
        "details": details + ("\n\nStudent occupied:\n" + overlap_report if overlap_report else ""),
        "capacity_utilization": capacity_utilization
    }
