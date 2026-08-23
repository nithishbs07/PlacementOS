import json
from collections import defaultdict

with open("schedule_6.json") as f:
    data = json.load(f)

interviews = data.get("interviews", [])

print(f"Total interviews: {len(interviews)}")

days_set = set()
day_counts = defaultdict(int)
for iv in interviews:
    day = iv["day"]
    days_set.add(day)
    day_counts[day] += 1

print("\n--- Days Used ---")
for d in sorted(day_counts.keys()):
    print(f"Day {d}: {day_counts[d]} interviews")

min_day = min(days_set) if days_set else 0
max_day = max(days_set) if days_set else 0
empty_days = [d for d in range(min_day, max_day + 1) if d not in days_set]
print(f"Empty days between {min_day} and {max_day}: {empty_days}")

def get_abs_time(iv):
    start = (iv["day"] - 1) * 1440 + iv["start_time"]
    end = (iv["day"] - 1) * 1440 + (iv["end_time"] if iv["end_time"] else iv["start_time"] + 30)
    return start, end

rooms = defaultdict(list)
students = defaultdict(list)
panels = defaultdict(list)
companies = defaultdict(list)

for iv in interviews:
    if iv["status"] != "SCHEDULED":
        continue
    start, end = get_abs_time(iv)
    if iv.get("room"): rooms[iv["room"]].append((start, end, iv["id"]))
    if iv.get("student"): students[iv["student"]].append((start, end, iv["id"]))
    if iv.get("panel"): panels[iv["panel"]].append((start, end, iv["id"]))
    if iv.get("company"): companies[iv["company"]].append((start, end, iv["id"], iv.get("panel")))

def check_overlap(schedule_list):
    conflicts = []
    schedule_list.sort(key=lambda x: x[0])
    for i in range(len(schedule_list) - 1):
        if schedule_list[i][1] > schedule_list[i+1][0]:
            conflicts.append((schedule_list[i][2], schedule_list[i+1][2]))
    return conflicts

print("\n--- Checking Conflicts ---")
room_c = 0
for r, lst in rooms.items():
    c = check_overlap(lst)
    if c:
        room_c += len(c)
        print(f"Room {r} conflict between IDs: {c}")

student_c = 0
for s, lst in students.items():
    c = check_overlap(lst)
    if c:
        student_c += len(c)
        print(f"Student {s} conflict between IDs: {c}")

panel_c = 0
for p, lst in panels.items():
    c = check_overlap(lst)
    if c:
        panel_c += len(c)
        print(f"Panel {p} conflict between IDs: {c}")

print(f"Room conflicts: {room_c}")
print(f"Student conflicts: {student_c}")
print(f"Panel conflicts: {panel_c}")

print("\n--- Checking Company Capacity ---")
company_capacity_violations = 0
for c, lst in companies.items():
    events = []
    for start, end, iv_id, panel in lst:
        events.append((start, 1))
        events.append((end, -1))
    
    events.sort(key=lambda x: (x[0], x[1]))
    
    max_simultaneous = 0
    current = 0
    for time, change in events:
        current += change
        max_simultaneous = max(max_simultaneous, current)
        
    unique_panels = len(set(p for s, e, i, p in lst if p))
    if max_simultaneous > unique_panels:
        company_capacity_violations += 1
        print(f"Company {c} has {max_simultaneous} simultaneous interviews but only {unique_panels} panels scheduled.")

print(f"Company capacity violations: {company_capacity_violations}")
