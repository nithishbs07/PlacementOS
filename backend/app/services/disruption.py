from sqlalchemy.orm import Session
from app.models.domain import Disruption, DisruptionType, DisruptionStatus, ScheduleVersion, CompanyAvailability, Interview, InterviewStatus

def get_disruption_impact(db: Session, version_id: int, disruption_type: DisruptionType, target_id: int):
    affected = []
    
    if disruption_type == DisruptionType.COMPANY_DELAY:
        interviews = db.query(Interview).filter_by(schedule_version_id=version_id, company_id=target_id, status=InterviewStatus.SCHEDULED).all()
        affected = interviews
    elif disruption_type == DisruptionType.STUDENT_WITHDRAWAL:
        interviews = db.query(Interview).filter_by(schedule_version_id=version_id, student_id=target_id, status=InterviewStatus.SCHEDULED).all()
        affected = interviews
    elif disruption_type == DisruptionType.PANEL_DROPOUT:
        interviews = db.query(Interview).filter_by(schedule_version_id=version_id, panel_id=target_id, status=InterviewStatus.SCHEDULED).all()
        affected = interviews
    elif disruption_type == DisruptionType.ROOM_UNAVAILABLE:
        interviews = db.query(Interview).filter_by(schedule_version_id=version_id, room_id=target_id, status=InterviewStatus.SCHEDULED).all()
        affected = interviews
        
    return affected

def inject_disruption(db: Session, version_id: int, disruption_type: DisruptionType, target_id: int, delay_minutes: int = 0):
    disruption = Disruption(
        schedule_version_id=version_id,
        disruption_type=disruption_type,
        target_id=target_id,
        delay_minutes=delay_minutes,
        status=DisruptionStatus.PENDING
    )
    db.add(disruption)
    db.commit()
    db.refresh(disruption)
    return disruption

def apply_disruption(db: Session, disruption_id: int):
    disruption = db.query(Disruption).filter_by(id=disruption_id).first()
    if not disruption or disruption.status == DisruptionStatus.APPLIED:
        return disruption
        
    version_id = disruption.schedule_version_id
    target_id = disruption.target_id
    
    if disruption.disruption_type == DisruptionType.COMPANY_DELAY:
        avails = db.query(CompanyAvailability).filter_by(company_id=target_id).all()
        for avail in avails:
            avail.start_time += disruption.delay_minutes
            
    elif disruption.disruption_type == DisruptionType.STUDENT_WITHDRAWAL:
        interviews = db.query(Interview).filter_by(schedule_version_id=version_id, student_id=target_id).all()
        for i in interviews:
            i.status = InterviewStatus.CANCELLED
            i.unscheduled_reason = "Student Withdrew"
            
    elif disruption.disruption_type == DisruptionType.PANEL_DROPOUT:
        from app.models.domain import Panel
        p = db.query(Panel).filter_by(id=target_id).first()
        if p:
            p.is_active = False
        interviews = db.query(Interview).filter_by(schedule_version_id=version_id, panel_id=target_id).all()
        for i in interviews:
            i.status = InterviewStatus.CANCELLED
            i.unscheduled_reason = "Panel Dropout"
            
    elif disruption.disruption_type == DisruptionType.ROOM_UNAVAILABLE:
        interviews = db.query(Interview).filter_by(schedule_version_id=version_id, room_id=target_id).all()
        for i in interviews:
            i.status = InterviewStatus.CANCELLED
            i.unscheduled_reason = "Room Unavailable"

    disruption.status = DisruptionStatus.APPLIED
    db.commit()
    return disruption
