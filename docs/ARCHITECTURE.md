# Mirai Labs Placement Week Scheduler - Architecture Document

## System Overview
The Placement Week Scheduler is a production-quality full-stack application built to replace the manual whiteboard scheduling process. It is designed to handle 35 companies, 800 students, and dynamically replan around real-world disruptions.

## Architecture & Technology Stack
- **Backend:** Python + FastAPI + SQLAlchemy
- **Database:** SQLite (in-memory for simulations, easily swappable to PostgreSQL)
- **Solver Engine:** Google OR-Tools (CP-SAT solver)
- **Frontend:** Next.js + React + Vanilla CSS

## Core Components

### 1. CP-SAT Scheduling Engine
The core of the system relies on a mathematical Constraint Programming solver.
- Every potential interview is modeled as an `OptionalIntervalVar`.
- Rooms and Panels are modeled using global `Cumulative` capacity constraints, which dramatically compresses the combinatorial space (from ~150,000 boolean indicator variables down to ~10,000 variables for the 35/800 scale dataset).
- Post-solve interval coloring assigns specific rooms and panels to the scheduled intervals.

### 2. Disruption & Replanning Engine
Replanning is treated as a secondary optimization pass with a "baseline schedule" constraint.
- Change indicators (`time_changed`, `cancelled`) penalize the objective function.
- The system naturally localizes disruptions (e.g. Company Delays, Panel Dropouts, Student Withdrawals) by finding the mathematically cheapest way to restore feasibility with minimal churn.

### 3. Infeasibility Explainer
When the solver cannot place an interview, the `analyze_unscheduled_interview` service scans the student's existing scheduled interviews and the company's remaining capacity to generate a human-readable explanation of the bottleneck.

## Data Model (Domain)
- **Company:** Defines availability, duration, priority tier, and panel count.
- **Student & Shortlist:** Defines the target constraints.
- **Room & Panel:** Physical resources.
- **ScheduleVersion:** Supports immutable versioning so coordinators can compare V1 (baseline) to V2 (replanned) and view exact churn metrics.
- **Disruption:** Logs disaster injections (e.g. Delays) tied to a specific schedule version.
