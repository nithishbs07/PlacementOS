from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from app.core.database import Base

class ScheduleStatus(str, enum.Enum):
    INITIAL = "INITIAL"
    REPLANNED = "REPLANNED"

class InterviewStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    UNSCHEDULED = "UNSCHEDULED"
    CANCELLED = "CANCELLED"

class DisruptionType(str, enum.Enum):
    COMPANY_DELAY = "COMPANY_DELAY"
    PANEL_DROPOUT = "PANEL_DROPOUT"
    STUDENT_WITHDRAWAL = "STUDENT_WITHDRAWAL"
    ROOM_UNAVAILABLE = "ROOM_UNAVAILABLE"

class DisruptionStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPLIED = "APPLIED"

class ChangeSeverity(str, enum.Enum):
    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    industry = Column(String)
    priority_tier = Column(Integer, default=3) # 1 is highest
    cgpa_cutoff = Column(Float, default=0.0)
    branch_eligibility = Column(String) # comma separated
    num_panels = Column(Integer, default=1)
    interview_duration = Column(Integer, default=30) # in minutes
    
    availabilities = relationship("CompanyAvailability", back_populates="company")
    panels = relationship("Panel", back_populates="company")
    shortlists = relationship("StudentShortlist", back_populates="company")

class CompanyAvailability(Base):
    __tablename__ = "company_availabilities"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    day = Column(Integer, nullable=False)
    start_time = Column(Integer, nullable=False) # absolute minute from day start
    end_time = Column(Integer, nullable=False)
    
    company = relationship("Company", back_populates="availabilities")

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    student_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    cgpa = Column(Float, nullable=False)
    branch = Column(String, nullable=False)
    status = Column(String, default="ACTIVE")
    
    shortlists = relationship("StudentShortlist", back_populates="student")

class StudentShortlist(Base):
    __tablename__ = "student_shortlists"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    student = relationship("Student", back_populates="shortlists")
    company = relationship("Company", back_populates="shortlists")

class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

class Panel(Base):
    __tablename__ = "panels"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    
    company = relationship("Company", back_populates="panels")

class ScheduleVersion(Base):
    __tablename__ = "schedule_versions"
    id = Column(Integer, primary_key=True, index=True)
    version_number = Column(Integer, nullable=False, unique=True)
    parent_version_id = Column(Integer, ForeignKey("schedule_versions.id"), nullable=True)
    status = Column(SQLEnum(ScheduleStatus), default=ScheduleStatus.INITIAL)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    interviews = relationship("Interview", back_populates="schedule_version")
    disruptions = relationship("Disruption", back_populates="schedule_version")
    changes = relationship("ScheduleChange", back_populates="schedule_version")

class Interview(Base):
    __tablename__ = "interviews"
    id = Column(Integer, primary_key=True, index=True)
    schedule_version_id = Column(Integer, ForeignKey("schedule_versions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    panel_id = Column(Integer, ForeignKey("panels.id"), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    day = Column(Integer, nullable=True)
    start_time = Column(Integer, nullable=True)
    end_time = Column(Integer, nullable=True)
    status = Column(SQLEnum(InterviewStatus), default=InterviewStatus.SCHEDULED)
    unscheduled_reason = Column(Text, nullable=True)
    
    schedule_version = relationship("ScheduleVersion", back_populates="interviews")
    student = relationship("Student")
    company = relationship("Company")
    panel = relationship("Panel")
    room = relationship("Room")

class Disruption(Base):
    __tablename__ = "disruptions"
    id = Column(Integer, primary_key=True, index=True)
    schedule_version_id = Column(Integer, ForeignKey("schedule_versions.id"), nullable=False)
    disruption_type = Column(SQLEnum(DisruptionType), nullable=False)
    target_id = Column(Integer, nullable=False) # e.g. company_id or panel_id
    delay_minutes = Column(Integer, default=0)
    status = Column(SQLEnum(DisruptionStatus), default=DisruptionStatus.PENDING)
    
    schedule_version = relationship("ScheduleVersion", back_populates="disruptions")

class ScheduleChange(Base):
    __tablename__ = "schedule_changes"
    id = Column(Integer, primary_key=True, index=True)
    schedule_version_id = Column(Integer, ForeignKey("schedule_versions.id"), nullable=False)
    old_interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=True)
    new_interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=True)
    change_severity = Column(SQLEnum(ChangeSeverity), default=ChangeSeverity.NONE)
    reason = Column(Text, nullable=True)
    
    schedule_version = relationship("ScheduleVersion", back_populates="changes")
    old_interview = relationship("Interview", foreign_keys=[old_interview_id])
    new_interview = relationship("Interview", foreign_keys=[new_interview_id])

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    action = Column(String, nullable=False) # e.g. "Schedule generated", "Disruption applied"
    entity = Column(String, nullable=False) # e.g. "ScheduleVersion", "Disruption", "Company"
    entity_id = Column(Integer, nullable=True)
    schedule_version_id = Column(Integer, ForeignKey("schedule_versions.id"), nullable=True)
    actor = Column(String, default="SYSTEM")
    previous_state = Column(Text, nullable=True) # JSON representation
    new_state = Column(Text, nullable=True) # JSON representation
    metadata_json = Column(Text, nullable=True) # additional details e.g., "replan completed with 12 churn"
    
    schedule_version = relationship("ScheduleVersion")
