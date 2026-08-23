# Mirai Labs Placement Week Scheduler - Technical Defense

## Why CP-SAT? Why not greedy scheduling?
Greedy scheduling assigns resources sequentially, often getting trapped in local optima which leaves fragmented gaps. It forces us to write custom backtracking logic if a later interview cannot be placed due to earlier arbitrary choices. Google OR-Tools CP-SAT evaluates the global state. By utilizing `OptionalIntervalVar`, we guarantee the solver will always find a feasible state (even if it drops some interviews) while maximizing the overall schedule density.

## What are your hard constraints?
1. **Student Overlap**: A student cannot attend two interviews simultaneously.
2. **Room Overlap**: A room cannot host two interviews simultaneously.
3. **Panel Overlap**: A panel cannot conduct two interviews simultaneously.
4. **Availability**: Interviews must fall strictly within the company's designated available time windows (integer minutes).
5. **Eligibility**: Handled pre-optimization; only valid shortlists are passed to the solver.

## What are your soft constraints?
1. **Maximize Scheduled Interviews**: The primary objective.
2. **Company Priority**: Higher tier companies (e.g., Tier 1) yield a higher objective score.
3. **Replanning Churn**: Penalizing changes to time, room, or panel assignments during replanning to prevent cascading schedule changes.

## How did you choose objective weights?
The weights are configurable (e.g., via `.env`). Through sensitivity testing, we found:
- `+10,000` for scheduled interviews ensures this dominates all other concerns.
- `+1,000` for priority ensures a Tier 1 company is placed over a Tier 3 if they compete for a slot, without dropping 10 Tier 3s for 1 Tier 1.
- `Change Penalties (-500 to -5000)` are scaled so that moving an interview is painful, but dropping an interview entirely (-5000) is a last resort.

## What happens when the problem is infeasible?
By modeling every interview as an `OptionalIntervalVar`, the CP-SAT formulation itself is never technically "INFEASIBLE" (it could just drop everything to score 0). The `Infeasibility Engine` kicks in *after* the solver finishes. It iterates over every dropped `(Student, Company)` pair and programmatically identifies the bottleneck (e.g., "Student's schedule was full during company's availability window", or "Company capacity exhausted").

## Why don't you simply regenerate the entire schedule?
Regenerating from scratch would cause massive churn, forcing hundreds of students and panels to adjust their schedules just because one company arrived late. This causes operational chaos. The replanner uses the existing schedule as a baseline and heavily penalizes changes to it, forcing the solver to localize the disruption.

## How do you minimize replanning churn?
When replanning, we introduce boolean change indicators for `time_changed`, `room_changed`, `panel_changed`, and `cancelled`. These are multiplied by their respective penalties in the objective function. The solver natively explores the tradeoff between keeping an interview where it is vs moving it to accommodate a disruption.

## How do you prove the system is better than the baseline?
We implemented a Greedy Baseline Scheduler. We run both engines on the exact same seeded dataset and output comparative metrics for:
- Percentage of interviews scheduled
- Total student waiting time
- High-priority coverage
CP-SAT packs the schedule significantly better because it can retroactively shift appointments to close gaps, whereas the greedy scheduler cannot.

## Final Validation Metrics (Production Scale: 35 Companies, 800 Students)
The system was validated against a full-scale dataset representing a heavy placement week. By transforming the constraints into a mathematically compact `Cumulative` formulation, the CP-SAT engine effectively models 1,774 shortlists into ~10,000 variables and solves large-scale configurations in seconds.

### Baseline vs CP-SAT Performance
- **Greedy Baseline Scheduler:** 942 / 1,774 scheduled (Runtime: ~0.9s)
- **CP-SAT Optimization:** 969 / 1,774 scheduled (Runtime: ~30.0s)
*Conclusion: The CP-SAT solver successfully scheduled 27 more interviews than the baseline while strictly enforcing all overlapping invariants.*

### Infeasibility Explanations
For the ~805 unscheduled interviews, the engine successfully generates exact rationales for the placement coordinator:
```text
UNSCHEDULED INTERVIEW
---------------------
Student: Student 172
Company: Company-01
Reason: NO_FEASIBLE_SLOT (Resource Contention)
Explanation: No interval exists satisfying company availability, student availability, room capacity, and panel capacity simultaneously.
Student occupied:
04:30-05:00 (Day 2) - Company 14
03:00-04:00 (Day 1) - Company 35
Capacity utilization: 0 feasible rooms, 0 feasible panels
```

### Dynamic Replanning & Disruption Handling
**Scenario Inject:** The largest Day-1 recruiter was delayed by 3 hours, 1 panel abruptly dropped, and 15 students withdrew simultaneously.

Instead of a single objective weighting function, the system performed **Lexicographic Dynamic Replanning**, strictly bounding preservation and temporal movement constraints across 4 sequential stages.

| Stage | Objective | Status | Optimal Value |
|---|---|---|---|
| Stage 1 | Maximize preserved appointments | OPTIMAL | P* = 943 |
| Stage 2 | Maximize retained appointments | OPTIMAL | E* = 943 |
| Stage 3 | Minimize temporal movement | OPTIMAL | M* = 0 |
| Stage 4 | Coverage recovery | FEASIBLE | S* = 975 |

**Lexicographic replanning reduced original-appointment churn from 97.8% (naive objective) to 7.7% while increasing scheduled interviews from 969 to 975.**

- **Preserved unchanged:** 894
- **Room/Panel changes (Deterministic Fallback):** 49
- **Time/Day movement:** 0 (M* = 0 proven optimally)
- **Cancelled:** 26 (Identified as FORCED due to withdrawals/delay overlaps)
- **Newly scheduled:** 32 

*Conclusion: The replanner mathematically optimized preservation, retention, and temporal stability before performing coverage recovery. Deterministic post-processing successfully preferred existing Room/Panel allocations, proving minimal disruption.*

All final hard-constraint validation checks passed with zero student, room, or panel overlaps, zero availability violations, and zero withdrawn students scheduled.
