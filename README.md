# PlacementOS

A constraint-optimization operations platform for placement interview scheduling.

## Problem

35 companies
800 students
4 days
20 interview rooms

The real-world disruption scenario requires dynamic replanning that handles company delays, panel dropouts, student withdrawals, and room unavailability without collapsing the existing schedule.

## Core Architecture

Configure
→ Generate
→ Operate
→ Disrupt
→ Replan
→ Explain
→ Prove
→ Measure
→ Audit

## Technology

Frontend:
- Next.js
- React
- TypeScript
- Tailwind CSS

Backend:
- FastAPI
- Python
- SQLAlchemy

Database:
- PostgreSQL

Optimization:
- Google OR-Tools CP-SAT

## Scheduling

The CP-SAT scheduling model assigns interviews to specific days, times, rooms, and panels while satisfying hard constraints such as student and room overlap prevention, strict company availability blocks, and panel capacity constraints.

## Sequential Lexicographic Replanning

The replanning engine utilizes a sequential lexicographic optimization approach with four prioritized stages:

1. Maximize exact appointment preservation
2. Maximize day/time retention
3. Minimize temporal movement
4. Maximize recovery

Note: Stage 4 can terminate as FEASIBLE due to the runtime boundary and is not guaranteed to be globally optimal.

## Disruptions

The platform handles four implemented disruption types:
- COMPANY_DELAY
- PANEL_DROPOUT
- STUDENT_WITHDRAWAL
- ROOM_UNAVAILABLE

## Validation

An independent validation layer verifies the mathematical correctness of any generated schedule, enforcing the following invariant checks:
- student overlaps
- room overlaps
- panel overlaps
- company availability
- student availability
- interview duration
- withdrawn students
- dropped panels

## Analytics

The analytics dashboard provides metrics and visualizations for evaluating long-term operational impact.

## Impact Analysis

The platform isolates and explains operational changes via Impact Analysis, categorizing changes into:
- preserved
- moved day
- moved time
- moved room
- moved panel
- cancelled
- recovered
- forced changes
- optimization changes
- churn

## Audit / History

ScheduleVersion lineage and AuditLog track the complete history of schedules, disruptions, and the transitions between them.

## Running Locally

```bash
docker compose up --build
```

## Frontend

If running independently of Docker:
```bash
cd frontend
npm install
npm run dev
```

## Backend

If running independently of Docker:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Regression Validation

To execute the automated regression suite and observe the lexicographic churn analysis:

```bash
PYTHONPATH=backend venv/bin/python backend/scripts/analyze_churn.py
```

## Demo Flow

The standard product demonstration sequence is:
Dashboard
→ Schedule
→ Disruption
→ Replan
→ Analysis
→ Validation
→ Analytics
→ History

## Mirai Labs Defense

CP-SAT and sequential lexicographic optimization were chosen because they provide strict mathematical guarantees on hard constraint satisfaction while allowing complex multi-objective tradeoffs (e.g., maximizing preservation while minimizing temporal movement) to be evaluated and solved in a deterministic priority order.
