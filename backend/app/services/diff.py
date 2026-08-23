from sqlalchemy.orm import Session
from app.models.domain import Disruption, DisruptionType, Interview, Student

def calculate_schedule_diff(db: Session, v1_interviews, v2_interviews, parent_version_id: int):
    # Fetch all applied disruptions targeting the parent version
    disruptions = db.query(Disruption).filter_by(
        schedule_version_id=parent_version_id, 
        status="APPLIED"
    ).all()
    
    delayed_company_ids = [d.target_id for d in disruptions if d.disruption_type == DisruptionType.COMPANY_DELAY]
    dropped_panel_ids = [d.target_id for d in disruptions if d.disruption_type == DisruptionType.PANEL_DROPOUT]
    withdrawn_student_ids = [d.target_id for d in disruptions if d.disruption_type == DisruptionType.STUDENT_WITHDRAWAL]
    unavailable_room_ids = [d.target_id for d in disruptions if d.disruption_type == DisruptionType.ROOM_UNAVAILABLE]

    v1_map = {(i.student_id, i.company_id): i for i in v1_interviews}
    v2_map = {(i.student_id, i.company_id): i for i in v2_interviews}
    
    metrics = {
        "unchanged": 0,
        "moved_day": 0,
        "moved_time": 0,
        "moved_room": 0,
        "moved_panel": 0,
        "cancelled": 0,
        "newly_scheduled": 0,
        "forced_changes": 0,
        "optimization_changes": 0,
        "churn": 0.0
    }
    
    detailed_diffs = []
    
    for key, i_old in v1_map.items():
        if key not in v2_map:
            metrics["cancelled"] += 1
            is_forced = False
            if i_old.student_id in withdrawn_student_ids: is_forced = True
            elif i_old.panel_id in dropped_panel_ids: is_forced = True
            elif i_old.room_id in unavailable_room_ids: is_forced = True
            elif i_old.company_id in delayed_company_ids: is_forced = True
                
            if is_forced: metrics["forced_changes"] += 1
            else: metrics["optimization_changes"] += 1
            
            detailed_diffs.append({
                "student_id": i_old.student_id,
                "company_id": i_old.company_id,
                "change_type": "Cancelled",
                "is_forced": is_forced,
                "previous": {
                    "day": i_old.day, "start_time": i_old.start_time, "end_time": i_old.end_time,
                    "room_id": i_old.room_id, "panel_id": i_old.panel_id
                },
                "new": None
            })
        else:
            i_new = v2_map[key]
            change_type = "Unchanged"
            
            if i_new.day != i_old.day:
                change_type = "Day changed"
                metrics["moved_day"] += 1
            elif i_new.start_time != i_old.start_time:
                change_type = "Time changed"
                metrics["moved_time"] += 1
            elif i_new.room_id != i_old.room_id:
                change_type = "Room changed"
                metrics["moved_room"] += 1
            elif i_new.panel_id != i_old.panel_id:
                change_type = "Panel changed"
                metrics["moved_panel"] += 1
            else:
                metrics["unchanged"] += 1
                
            is_forced = False
            if change_type != "Unchanged":
                if i_old.company_id in delayed_company_ids: is_forced = True
                elif i_old.panel_id in dropped_panel_ids: is_forced = True
                elif i_old.room_id in unavailable_room_ids: is_forced = True
                    
                if is_forced: metrics["forced_changes"] += 1
                else: metrics["optimization_changes"] += 1
                
            detailed_diffs.append({
                "student_id": i_old.student_id,
                "company_id": i_old.company_id,
                "change_type": change_type,
                "is_forced": is_forced if change_type != "Unchanged" else None,
                "previous": {
                    "day": i_old.day, "start_time": i_old.start_time, "end_time": i_old.end_time,
                    "room_id": i_old.room_id, "panel_id": i_old.panel_id
                },
                "new": {
                    "day": i_new.day, "start_time": i_new.start_time, "end_time": i_new.end_time,
                    "room_id": i_new.room_id, "panel_id": i_new.panel_id
                }
            })
                
    for key, i_new in v2_map.items():
        if key not in v1_map:
            metrics["newly_scheduled"] += 1
            detailed_diffs.append({
                "student_id": i_new.student_id,
                "company_id": i_new.company_id,
                "change_type": "Newly scheduled",
                "is_forced": False,
                "previous": None,
                "new": {
                    "day": i_new.day, "start_time": i_new.start_time, "end_time": i_new.end_time,
                    "room_id": i_new.room_id, "panel_id": i_new.panel_id
                }
            })
            
    total_original = len(v1_map)
    changed_count = total_original - metrics["unchanged"]
    metrics["churn"] = round((changed_count / total_original * 100), 1) if total_original > 0 else 0.0
    
    return {
        "metrics": metrics,
        "details": detailed_diffs
    }
