from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.domain import ScheduleVersion, Interview, InterviewStatus, Disruption, DisruptionType, Room, Panel, Student, Company, StudentShortlist
from app.services.diff import calculate_schedule_diff
import collections

def get_full_analytics(db: Session):
    # 1. Overall KPIs from Active Schedule
    active_version = db.query(ScheduleVersion).order_by(ScheduleVersion.id.desc()).first()
    if not active_version:
        return {}

    total_students = db.query(Student).filter(Student.status != "WITHDRAWN").count()
    total_shortlists = db.query(StudentShortlist).count()
    
    scheduled_interviews = db.query(Interview).filter_by(
        schedule_version_id=active_version.id, 
        status=InterviewStatus.SCHEDULED
    ).all()
    scheduled_count = len(scheduled_interviews)
    
    # Coverage %
    coverage = round((scheduled_count / max(1, total_shortlists)) * 100, 1)
    
    # 2. Resource Utilization (Rooms & Panels)
    room_interviews = collections.defaultdict(int)
    panel_interviews = collections.defaultdict(int)
    for iv in scheduled_interviews:
        if iv.room_id: room_interviews[iv.room_id] += 1
        if iv.panel_id: panel_interviews[iv.panel_id] += 1
        
    rooms = db.query(Room).all()
    room_util = []
    for r in rooms:
        # Assuming 4 days, 12 hours = 48 slots per room
        slots = room_interviews.get(r.id, 0)
        util = min(100, round((slots / 48.0) * 100))
        room_util.append({"name": r.name, "utilization": util, "scheduled": slots})
        
    panels = db.query(Panel).all()
    panel_util = []
    for p in panels:
        slots = panel_interviews.get(p.id, 0)
        util = min(100, round((slots / 48.0) * 100))
        panel_util.append({"name": p.name, "company_id": p.company_id, "utilization": util, "scheduled": slots})
        
    avg_utilization = round(sum(u["utilization"] for u in room_util) / max(1, len(room_util)), 1)
        
    # 3. Replanning Performance (Historical)
    versions = db.query(ScheduleVersion).order_by(ScheduleVersion.id.asc()).all()
    
    historical_churns = []
    historical_preserved = []
    historical_forced = []
    historical_optimization = []
    
    disruption_stats = collections.defaultdict(lambda: {"count": 0, "forced": 0, "churn_contrib": 0})
    
    # Calculate diffs between consecutive versions
    for i in range(1, len(versions)):
        parent = versions[i-1]
        child = versions[i]
        
        v1_ivs = db.query(Interview).filter_by(schedule_version_id=parent.id, status=InterviewStatus.SCHEDULED).all()
        v2_ivs = db.query(Interview).filter_by(schedule_version_id=child.id, status=InterviewStatus.SCHEDULED).all()
        
        diff = calculate_schedule_diff(db, v1_ivs, v2_ivs, parent.id)
        metrics = diff["metrics"]
        
        historical_churns.append(metrics["churn"])
        historical_preserved.append(metrics["unchanged"])
        historical_forced.append(metrics["forced_changes"])
        historical_optimization.append(metrics["optimization_changes"])
        
        # Attribute to disruptions targeting the parent
        disruptions = db.query(Disruption).filter_by(schedule_version_id=parent.id, status="APPLIED").all()
        for d in disruptions:
            dtype = d.disruption_type.name
            disruption_stats[dtype]["count"] += 1
            # We don't perfectly isolate multiple disruptions in the same replan here, 
            # but we can just average the forced changes over them for the demo
            disruption_stats[dtype]["forced"] += metrics["forced_changes"] / max(1, len(disruptions))
            disruption_stats[dtype]["churn_contrib"] += metrics["churn"] / max(1, len(disruptions))
            
    avg_churn = round(sum(historical_churns) / max(1, len(historical_churns)), 1) if historical_churns else 0
    avg_preserved = round(sum(historical_preserved) / max(1, len(historical_preserved)), 1) if historical_preserved else 0
    
    # 4. Company Performance
    companies = db.query(Company).all()
    comp_stats = []
    
    comp_shortlists = collections.defaultdict(int)
    for sl in db.query(StudentShortlist).all():
        comp_shortlists[sl.company_id] += 1
        
    comp_scheduled = collections.defaultdict(int)
    for iv in scheduled_interviews:
        comp_scheduled[iv.company_id] += 1
        
    for c in companies:
        sc = comp_scheduled.get(c.id, 0)
        sl_c = comp_shortlists.get(c.id, 0)
        cov = min(100.0, round((sc / max(1, sl_c)) * 100, 1))
        comp_stats.append({
            "id": c.id,
            "name": c.name,
            "shortlists": sl_c,
            "scheduled": sc,
            "coverage": cov
        })

    return {
        "kpis": {
            "coverage": coverage,
            "utilization": avg_utilization,
            "avg_churn": avg_churn,
            "interviews": scheduled_count
        },
        "rooms": sorted(room_util, key=lambda x: x["utilization"], reverse=True),
        "panels": sorted(panel_util, key=lambda x: x["utilization"], reverse=True),
        "replanning": {
            "avg_churn": avg_churn,
            "avg_preserved": avg_preserved,
            "avg_forced": round(sum(historical_forced) / max(1, len(historical_forced)), 1) if historical_forced else 0,
            "avg_optimization": round(sum(historical_optimization) / max(1, len(historical_optimization)), 1) if historical_optimization else 0,
            "history": historical_churns
        },
        "disruptions": [
            {
                "type": k, 
                "count": v["count"], 
                "avg_forced": round(v["forced"] / max(1, v["count"]), 1),
                "avg_churn": round(v["churn_contrib"] / max(1, v["count"]), 1)
            } for k, v in disruption_stats.items()
        ],
        "companies": sorted(comp_stats, key=lambda x: x["coverage"])
    }
