from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.models.domain import ScheduleStatus, InterviewStatus, DisruptionType, DisruptionStatus, ChangeSeverity

class CompanyBase(BaseModel):
    name: str
    industry: Optional[str] = None
    priority_tier: int = 3
    cgpa_cutoff: float = 0.0
    branch_eligibility: Optional[str] = None
    num_panels: int = 1
    interview_duration: int = 30

class CompanyCreate(CompanyBase):
    pass

class CompanyResponse(CompanyBase):
    id: int
    class Config:
        from_attributes = True

class StudentBase(BaseModel):
    student_code: str
    name: str
    cgpa: float
    branch: str

class StudentCreate(StudentBase):
    pass

class StudentResponse(StudentBase):
    id: int
    class Config:
        from_attributes = True

class RoomResponse(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class PanelResponse(BaseModel):
    id: int
    company_id: int
    name: str
    class Config:
        from_attributes = True

class InterviewBase(BaseModel):
    schedule_version_id: int
    student_id: int
    company_id: int
    panel_id: Optional[int] = None
    room_id: Optional[int] = None
    day: Optional[int] = None
    start_time: Optional[int] = None
    end_time: Optional[int] = None
    status: InterviewStatus
    unscheduled_reason: Optional[str] = None

class InterviewCreate(InterviewBase):
    pass

class InterviewResponse(InterviewBase):
    id: int
    class Config:
        from_attributes = True

class ScheduleVersionBase(BaseModel):
    version_number: int
    parent_version_id: Optional[int] = None
    status: ScheduleStatus
    created_at: datetime

class ScheduleVersionResponse(ScheduleVersionBase):
    id: int
    class Config:
        from_attributes = True

class DisruptionCreate(BaseModel):
    schedule_version_id: int
    disruption_type: DisruptionType
    target_id: int
    delay_minutes: int = 0

class DisruptionResponse(DisruptionCreate):
    id: int
    status: DisruptionStatus
    class Config:
        from_attributes = True

class ScheduleChangeResponse(BaseModel):
    id: int
    schedule_version_id: int
    old_interview_id: Optional[int]
    new_interview_id: Optional[int]
    change_severity: ChangeSeverity
    reason: Optional[str]
    class Config:
        from_attributes = True
