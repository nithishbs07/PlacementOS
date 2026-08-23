from ortools.sat.python import cp_model
from sqlalchemy.orm import Session
from app.models.domain import (
    Company, Student, StudentShortlist, CompanyAvailability, Room, Panel,
    ScheduleVersion, Interview, InterviewStatus, ScheduleStatus
)
import collections
import time

def create_schedule(db: Session, parent_version_id: int = None):
    # Fetch data
    companies = db.query(Company).all()
    students = db.query(Student).filter(Student.status != "WITHDRAWN").all()
    rooms = db.query(Room).all()
    panels = db.query(Panel).filter_by(is_active=True).all()
    shortlists = db.query(StudentShortlist).all()
    availabilities = db.query(CompanyAvailability).all()
    
    existing_interviews = []
    if parent_version_id:
        existing_interviews = db.query(Interview).filter_by(
            schedule_version_id=parent_version_id,
            status=InterviewStatus.SCHEDULED
        ).all()

    model = cp_model.CpModel()
    
    company_avail_map = collections.defaultdict(list)
    for avail in availabilities:
        start_abs = (avail.day - 1) * 1440 + avail.start_time
        end_abs = (avail.day - 1) * 1440 + avail.end_time
        company_avail_map[avail.company_id].append((start_abs, end_abs))
        
    panels_by_company = collections.defaultdict(list)
    for p in panels:
        panels_by_company[p.company_id].append(p)
        
    company_by_id = {c.id: c for c in companies}
    student_by_id = {s.id: s for s in students}

    vars_map = {}
    student_intervals = collections.defaultdict(list)
    all_room_intervals = []
    all_room_demands = []
    company_intervals = collections.defaultdict(list)
    
    valid_starts_by_company = {}
    for c_id, avails in company_avail_map.items():
        domain_list = []
        duration = company_by_id[c_id].interview_duration
        for start, end in avails:
            if end - start >= duration:
                domain_list.extend([start, end - duration])
        if domain_list:
            valid_starts_by_company[c_id] = cp_model.Domain.FromIntervals([
                [start, end - duration] for start, end in avails if end - start >= duration
            ])

    for idx, sl in enumerate(shortlists):
        c_id = sl.company_id
        s_id = sl.student_id
        if s_id not in student_by_id:
            continue
        c = company_by_id[c_id]
        
        if c_id not in valid_starts_by_company:
            continue
            
        duration = c.interview_duration
        
        is_scheduled = model.NewBoolVar(f"is_scheduled_{idx}")
        start = model.NewIntVarFromDomain(valid_starts_by_company[c_id], f"start_{idx}")
        end = model.NewIntVar(0, 4 * 1440, f"end_{idx}")
        
        interval = model.NewOptionalIntervalVar(start, duration, end, is_scheduled, f"interval_{idx}")
        student_intervals[s_id].append(interval)
        all_room_intervals.append(interval)
        all_room_demands.append(1)
        company_intervals[c_id].append(interval)
            
        vars_map[idx] = {
            "sl": sl,
            "is_scheduled": is_scheduled,
            "start": start,
            "end": end,
            "interval": interval
        }

    # Constraints
    # 1. Student NoOverlap
    for s_id, intervals in student_intervals.items():
        if len(intervals) > 1:
            model.AddNoOverlap(intervals)
            
    # 2. Room Capacity (Cumulative)
    if all_room_intervals:
        model.AddCumulative(all_room_intervals, all_room_demands, len(rooms))
        
    # 3. Panel Capacity (Cumulative)
    for c_id, intervals in company_intervals.items():
        panel_count = len(panels_by_company[c_id])
        if intervals:
            model.AddCumulative(intervals, [1]*len(intervals), panel_count)

    # Base hint
    for v in vars_map.values():
        model.AddHint(v["is_scheduled"], 0)

    # Base solving parameters
    def get_solver(time_limit=10.0):
        s = cp_model.CpSolver()
        s.parameters.max_time_in_seconds = time_limit
        s.parameters.num_search_workers = 8
        return s

    status = cp_model.UNKNOWN
    solver = None

    if parent_version_id and existing_interviews:
        # Lexicographic Replanning
        exist_map = {(i.student_id, i.company_id): i for i in existing_interviews}
        
        preserved_vars = []
        retained_vars = []
        day_changed_vars = []
        time_changed_vars = []
        
        for idx, v in vars_map.items():
            sl = v["sl"]
            key = (sl.student_id, sl.company_id)
            if key in exist_map:
                old = exist_map[key]
                old_start_abs = (old.day - 1) * 1440 + old.start_time
                old_day = old.day
                
                # Preserved (Time & Day unchanged)
                is_preserved = model.NewBoolVar(f"preserved_{idx}")
                is_start_same = model.NewBoolVar(f"start_same_{idx}")
                model.Add(v["start"] == old_start_abs).OnlyEnforceIf(is_start_same)
                model.Add(v["start"] != old_start_abs).OnlyEnforceIf(is_start_same.Not())
                # Preserved iff scheduled AND start time is same
                model.AddBoolAnd([v["is_scheduled"], is_start_same]).OnlyEnforceIf(is_preserved)
                model.AddBoolOr([v["is_scheduled"].Not(), is_start_same.Not()]).OnlyEnforceIf(is_preserved.Not())
                preserved_vars.append(is_preserved)
                
                # Retained (Scheduled at all)
                retained_vars.append(v["is_scheduled"])
                
                # Day change logic
                new_day = model.NewIntVar(0, 4, f"day_{idx}")
                model.AddDivisionEquality(new_day, v["start"], 1440)
                # +1 offset logic since day starts at 1
                new_day_adj = model.NewIntVar(1, 4, f"day_adj_{idx}")
                model.Add(new_day_adj == new_day + 1)
                
                is_day_changed_raw = model.NewBoolVar(f"day_changed_raw_{idx}")
                model.Add(new_day_adj != old_day).OnlyEnforceIf(is_day_changed_raw)
                model.Add(new_day_adj == old_day).OnlyEnforceIf(is_day_changed_raw.Not())
                
                # Time change logic (just start != old_start_abs)
                is_time_changed_raw = model.NewBoolVar(f"time_changed_raw_{idx}")
                model.Add(v["start"] != old_start_abs).OnlyEnforceIf(is_time_changed_raw)
                model.Add(v["start"] == old_start_abs).OnlyEnforceIf(is_time_changed_raw.Not())
                
                is_day_changed = model.NewBoolVar(f"day_changed_{idx}")
                model.AddBoolAnd([v["is_scheduled"], is_day_changed_raw]).OnlyEnforceIf(is_day_changed)
                model.AddBoolOr([v["is_scheduled"].Not(), is_day_changed_raw.Not()]).OnlyEnforceIf(is_day_changed.Not())
                
                is_time_changed = model.NewBoolVar(f"time_changed_{idx}")
                model.AddBoolAnd([v["is_scheduled"], is_time_changed_raw]).OnlyEnforceIf(is_time_changed)
                model.AddBoolOr([v["is_scheduled"].Not(), is_time_changed_raw.Not()]).OnlyEnforceIf(is_time_changed.Not())
                
                day_changed_vars.append(is_day_changed)
                time_changed_vars.append(is_time_changed)

        print("\nREPLAN LEXICOGRAPHIC SOLVE")
        print("────────────────────────────────────")

        # STAGE 1: Maximize Preserved
        t0 = time.time()
        model.Maximize(sum(preserved_vars))
        s1 = get_solver(time_limit=10.0)
        s1_status = s1.Solve(model)
        status_str1 = s1.StatusName(s1_status)
        p_opt = int(s1.ObjectiveValue()) if s1_status in [cp_model.FEASIBLE, cp_model.OPTIMAL] else 0
        print(f"Stage 1\n  Status: {status_str1}\n  Objective: preserved appointments\n  Optimal preserved: {p_opt}\n  Runtime: {time.time()-t0:.2f}s\n")
        model.Add(sum(preserved_vars) >= p_opt)

        # STAGE 2: Maximize Retained (Minimize Cancellations)
        t0 = time.time()
        model.Maximize(sum(retained_vars))
        s2 = get_solver(time_limit=10.0)
        s2_status = s2.Solve(model)
        status_str2 = s2.StatusName(s2_status)
        e_opt = int(s2.ObjectiveValue()) if s2_status in [cp_model.FEASIBLE, cp_model.OPTIMAL] else 0
        print(f"Stage 2\n  Status: {status_str2}\n  Objective: retained existing appointments\n  Optimal retained: {e_opt}\n  Runtime: {time.time()-t0:.2f}s\n")
        model.Add(sum(retained_vars) >= e_opt)

        # STAGE 3: Minimize Temporal Movement
        t0 = time.time()
        model.Minimize(sum(day_changed_vars) * 1000 + sum(time_changed_vars))
        s3 = get_solver(time_limit=10.0)
        s3_status = s3.Solve(model)
        status_str3 = s3.StatusName(s3_status)
        m_opt = int(s3.ObjectiveValue()) if s3_status in [cp_model.FEASIBLE, cp_model.OPTIMAL] else sum(v["sl"].company_id for v in vars_map.values())*1000 # fallback
        print(f"Stage 3\n  Status: {status_str3}\n  Objective: temporal movement\n  Minimum movement: {m_opt}\n  Runtime: {time.time()-t0:.2f}s\n")
        model.Add(sum(day_changed_vars) * 1000 + sum(time_changed_vars) <= m_opt)

        # STAGE 4: Coverage Recovery
        t0 = time.time()
        scheduled_interviews = [v["is_scheduled"] for v in vars_map.values()]
        priority_score = sum(v["is_scheduled"] * (4 - company_by_id[v["sl"].company_id].priority_tier) for v in vars_map.values())
        model.Maximize(sum(scheduled_interviews) * 1000 + priority_score)
        
        solver = get_solver(time_limit=20.0)
        status = solver.Solve(model)
        status_str4 = solver.StatusName(status)
        s_opt = sum(solver.Value(v["is_scheduled"]) for v in vars_map.values()) if status in [cp_model.FEASIBLE, cp_model.OPTIMAL] else 0
        print(f"Stage 4\n  Status: {status_str4}\n  Objective: coverage recovery\n  Scheduled: {s_opt}\n  Runtime: {time.time()-t0:.2f}s\n────────────────────────────────────")

    else:
        # V1 Baseline mode (Just Coverage)
        scheduled_interviews = [v["is_scheduled"] for v in vars_map.values()]
        priority_score = sum(v["is_scheduled"] * (4 - company_by_id[v["sl"].company_id].priority_tier) for v in vars_map.values())
        model.Maximize(sum(scheduled_interviews) * 1000 + priority_score)
        
        solver = get_solver(time_limit=30.0)
        status = solver.Solve(model)

    # Post-process assignments (Deterministic Interval Coloring)
    if status in [cp_model.FEASIBLE, cp_model.OPTIMAL]:
        # Pre-process for existing logic
        exist_map = {}
        if parent_version_id and existing_interviews:
            exist_map = {(i.student_id, i.company_id): i for i in existing_interviews}
            
        def color_intervals_deterministic(intervals, resource_ids, exist_map, is_room=True):
            # intervals is a list of dicts: {'start', 'end', 'idx', 's_id', 'c_id'}
            # Sort order: 1. existing interviews first, 2. unchanged time first, 3. start_time ascending, 4. idx
            
            def get_sort_key(iv):
                key = (iv['s_id'], iv['c_id'])
                is_existing = key in exist_map
                unchanged = False
                prev_resource = None
                if is_existing:
                    old = exist_map[key]
                    old_start = (old.day - 1) * 1440 + old.start_time
                    if old_start == iv['start']:
                        unchanged = True
                    prev_resource = old.room_id if is_room else old.panel_id
                iv['prev_resource'] = prev_resource if unchanged else None
                return (iv['start'], iv['idx'])
                
            intervals.sort(key=get_sort_key)
            assignments = {}
            resource_end_times = {r_id: 0 for r_id in resource_ids}
            
            for iv in intervals:
                assigned = False
                # Try previous resource first
                if iv['prev_resource'] is not None and iv['prev_resource'] in resource_ids:
                    if resource_end_times[iv['prev_resource']] <= iv['start']:
                        assignments[iv['idx']] = iv['prev_resource']
                        resource_end_times[iv['prev_resource']] = iv['end']
                        assigned = True
                        
                # Fallback to first available deterministic resource
                if not assigned:
                    for r_id in resource_ids: # Assumes resource_ids is deterministic (e.g. sorted by ID)
                        if resource_end_times[r_id] <= iv['start']:
                            assignments[iv['idx']] = r_id
                            resource_end_times[r_id] = iv['end']
                            assigned = True
                            break
                if not assigned:
                    raise ValueError(f"Could not color interval {iv['idx']}. Capacity exceeded.")
            return assignments

        # Assign rooms
        global_scheduled = []
        for idx, v in vars_map.items():
            if solver.Value(v["is_scheduled"]):
                start_val = solver.Value(v["start"])
                duration = company_by_id[v["sl"].company_id].interview_duration
                global_scheduled.append({
                    'start': start_val, 'end': start_val + duration, 'idx': idx,
                    's_id': v["sl"].student_id, 'c_id': v["sl"].company_id
                })
                
        room_ids = sorted([r.id for r in rooms])
        if global_scheduled:
            try:
                room_assignments = color_intervals_deterministic(global_scheduled, room_ids, exist_map, is_room=True)
                for idx in room_assignments:
                    r_id = room_assignments[idx]
                    r_idx = next(i for i, r in enumerate(rooms) if r.id == r_id)
                    vars_map[idx]["room_assigned_value"] = r_idx
            except ValueError as e:
                print(f"Room coloring error: {e}")
                pass 
            
        # Assign panels
        for c_id, intervals in company_intervals.items():
            comp_scheduled = []
            for v_idx, v in vars_map.items():
                if v["sl"].company_id == c_id and solver.Value(v["is_scheduled"]):
                    start_val = solver.Value(v["start"])
                    duration = company_by_id[c_id].interview_duration
                    comp_scheduled.append({
                        'start': start_val, 'end': start_val + duration, 'idx': v_idx,
                        's_id': v["sl"].student_id, 'c_id': c_id
                    })
                    
            p_ids = sorted([p.id for p in panels_by_company[c_id]])
            if comp_scheduled and p_ids:
                try:
                    panel_assignments = color_intervals_deterministic(comp_scheduled, p_ids, exist_map, is_room=False)
                    for idx in panel_assignments:
                        p_id = panel_assignments[idx]
                        p_idx = next(i for i, p in enumerate(panels_by_company[c_id]) if p.id == p_id)
                        vars_map[idx]["panel_assigned_value"] = p_idx
                except ValueError as e:
                    print(f"Panel coloring error: {e}")
                    pass

    return status, solver, vars_map, rooms, panels_by_company
