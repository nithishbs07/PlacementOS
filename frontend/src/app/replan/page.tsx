"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Activity, CheckCircle2, XCircle, AlertCircle, RefreshCw, BarChart2, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";

interface ValidationResult {
  is_valid: boolean;
  student_overlaps: number;
  room_overlaps: number;
  panel_overlaps: number;
  availability_violations: number;
  duration_violations: number;
  withdrawn_scheduled: number;
  dropped_panel_usage: number;
}

interface DiffMetrics {
  unchanged: number;
  moved_day: number;
  moved_time: number;
  moved_room: number;
  moved_panel: number;
  cancelled: number;
  newly_scheduled: number;
  forced_changes: number;
  optimization_changes: number;
  churn: number;
}

interface JobState {
  status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
  stage: string;
  start_time: number;
  runtime: number;
  result: {
    version_id: number;
    solver_status: string;
    scheduled_count: number;
    unscheduled_count: number;
    coverage: number;
    utilization: number;
    validation: ValidationResult;
    diff: DiffMetrics;
  } | null;
  error: string | null;
}

interface ActiveScheduleStats {
  version_id: number;
  timestamp: string;
  scheduled_count: number;
  unscheduled_count: number;
  companies_covered: number;
  students_scheduled: number;
  coverage?: number;
}

export default function ReplanWorkspace() {
  const [job, setJob] = useState<JobState | null>(null);
  const [activeStats, setActiveStats] = useState<ActiveScheduleStats | null>(null);
  const [disruptions, setDisruptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/operations/status");
      const data = await res.json();
      setActiveStats(data.active_schedule);

      const dRes = await fetch("http://localhost:8000/api/disruptions");
      const dData = await dRes.json();
      setDisruptions(dData.filter((d: any) => d.status === "APPLIED"));
      
      const jobRes = await fetch("http://localhost:8000/api/replan/status");
      const jobData = await jobRes.json();
      setJob(jobData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleReplan = async () => {
    if (!activeStats?.version_id) return;
    try {
      await fetch(`http://localhost:8000/api/schedule/${activeStats.version_id}/replan`, { method: "POST" });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !activeStats) {
    return (
      <div className="p-8 h-full space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isGenerating = job?.status === "RUNNING";
  const stageMap: Record<string, number> = {
    "READY": 0,
    "PRESERVING SCHEDULE": 1,
    "LEXICOGRAPHIC SOLVING": 2,
    "VALIDATING": 3,
    "COMPLETED": 4
  };

  const currentStageNum = job ? stageMap[job.stage] || 0 : 0;

  return (
    <div className="p-8 max-w-[1600px] mx-auto h-[calc(100vh-2rem)] flex gap-6 overflow-auto">
      
      {/* Left Column: Replan Control */}
      <div className="flex-[4] flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <RefreshCw className="h-8 w-8 text-blue-600" />
              Dynamic Replanning
            </h1>
            <p className="text-muted-foreground mt-1">Lexicographic optimization based on real-time disruptions</p>
          </div>
        </div>

        {/* Status Dashboard */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Active Schedule</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">Schedule #{activeStats?.version_id}</div>
            <div className="flex justify-between mt-4 border-t pt-4">
              <div className="text-center">
                <div className="text-xl font-semibold text-gray-900">{activeStats?.scheduled_count}</div>
                <div className="text-xs text-gray-500 uppercase">Scheduled</div>
              </div>
              <div className="text-center border-l pl-4">
                <div className="text-xl font-semibold text-gray-900">{activeStats?.coverage}%</div>
                <div className="text-xs text-gray-500 uppercase">Coverage</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Disruption Delta</h3>
            <div className="text-3xl font-bold text-red-600 mb-1">{disruptions.length}</div>
            <div className="text-xs text-red-500 uppercase font-semibold">Applied Disruptions Pending Replan</div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {disruptions.slice(0, 3).map(d => (
                <Badge key={d.id} variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] whitespace-nowrap">
                  {d.disruption_type.replace('_', ' ')} (ID: {d.target_id})
                </Badge>
              ))}
              {disruptions.length > 3 && <Badge variant="outline">+{disruptions.length - 3} more</Badge>}
            </div>
          </div>
        </div>

        {/* Generator */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Lexicographic Replan Engine
              </h2>
            </div>
            <button 
              onClick={handleReplan}
              disabled={isGenerating || disruptions.length === 0}
              className={`px-6 py-2.5 rounded-md font-semibold text-white transition-all flex items-center gap-2 ${(isGenerating || disruptions.length === 0) ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}
            >
              {isGenerating ? <Activity className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              {isGenerating ? 'Engine Running...' : 'REPLAN SCHEDULE'}
            </button>
          </div>
          
          {isGenerating && (
            <div className="p-8 bg-blue-50/50 flex flex-col gap-8">
              <div className="flex justify-between items-center relative">
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-blue-200 -z-10 -translate-y-1/2"></div>
                
                {[
                  "PRESERVING SCHEDULE",
                  "MINIMIZING CANCELLATIONS",
                  "MINIMIZING MOVEMENT",
                  "RECOVERING COVERAGE",
                  "VALIDATING"
                ].map((step, idx) => {
                  // Since create_schedule is frozen and synchronous, we map its run to just 'LEXICOGRAPHIC SOLVING' 
                  // but visually show the UI progressing through the lexicographic phases based on backend job stage.
                  const isActive = job?.stage === "LEXICOGRAPHIC SOLVING" ? idx >= 0 && idx <= 3 : currentStageNum >= idx;
                  const isCurrent = (job?.stage === "LEXICOGRAPHIC SOLVING" && idx === 1) || currentStageNum === idx;
                  
                  return (
                    <div key={step} className="flex flex-col items-center gap-2 bg-blue-50/50 px-2 relative z-10">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors duration-500
                        ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-blue-200 text-blue-300'}
                        ${isCurrent ? 'ring-4 ring-blue-100 shadow-lg scale-110' : ''}
                      `}>
                        {isActive && !isCurrent ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                      </div>
                      <span className={`text-[10px] font-bold text-center w-20 leading-tight ${isActive ? 'text-blue-900' : 'text-blue-400'}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-blue-700 text-center font-medium animate-pulse">
                Optimization Stage: <span className="font-bold">{job?.stage}</span>
                <span className="ml-4 tabular-nums text-blue-500">{(Date.now() / 1000 - (job?.start_time || 0)).toFixed(0)}s elapsed</span>
              </p>
            </div>
          )}

          {job?.status === "COMPLETED" && job.result && (
            <div className="p-6 bg-green-50/50 border-t border-green-100">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="h-6 w-6" />
                  <h3 className="text-xl font-bold">Replanning Completed in {job.runtime}s</h3>
                </div>
                <div className="flex gap-3">
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 font-bold px-3 py-1 text-sm mt-1">
                    Schedule #{job.result.version_id} Created
                  </Badge>
                  <Link 
                    href="/analysis" 
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm animate-pulse"
                  >
                    Next Step: Analyze Impact <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {job?.status === "FAILED" && (
            <div className="p-6 bg-red-50/50 border-t border-red-100">
              <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                <XCircle className="h-5 w-5" />
                Replanning Failed
              </div>
              <pre className="text-xs bg-red-100 p-3 rounded text-red-900 overflow-auto whitespace-pre-wrap">
                {job.error}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Replan Result Metrics */}
      <div className="flex-[3] flex flex-col gap-6">
        {job?.status === "COMPLETED" && job.result ? (
          <>
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-gray-900 text-white flex justify-between items-center">
                <h2 className="font-semibold flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 opacity-70" />
                  Lexicographic Result Metrics
                </h2>
              </div>
              
              <div className="p-5 grid grid-cols-2 gap-4">
                <div className="border rounded p-4 bg-gray-50 flex flex-col items-center justify-center text-center">
                  <div className="text-xs uppercase text-gray-500 font-bold mb-1">Preserved</div>
                  <div className="text-3xl font-bold text-gray-900">{job.result.diff.unchanged}</div>
                  <div className="text-[10px] text-gray-400 mt-1">Appointments untouched</div>
                </div>
                
                <div className="border rounded p-4 bg-gray-50 flex flex-col items-center justify-center text-center">
                  <div className="text-xs uppercase text-gray-500 font-bold mb-1">Churn Rate</div>
                  <div className="text-3xl font-bold text-orange-600">{job.result.diff.churn}%</div>
                  <div className="text-[10px] text-gray-400 mt-1">Overall schedule volatility</div>
                </div>
                
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 text-center">Movement Delta</h4>
                  <div className="grid grid-cols-4 gap-2 text-center divide-x">
                    <div>
                      <div className="text-xl font-bold text-gray-900">{job.result.diff.moved_day}</div>
                      <div className="text-[10px] text-gray-500 uppercase mt-1">Day</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-900">{job.result.diff.moved_time}</div>
                      <div className="text-[10px] text-gray-500 uppercase mt-1">Time</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-900">{job.result.diff.moved_room}</div>
                      <div className="text-[10px] text-gray-500 uppercase mt-1">Room</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-900">{job.result.diff.moved_panel}</div>
                      <div className="text-[10px] text-gray-500 uppercase mt-1">Panel</div>
                    </div>
                  </div>
                </div>
                
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 text-center">Coverage Delta</h4>
                  <div className="flex justify-around items-center text-center">
                    <div>
                      <div className="text-2xl font-bold text-red-600">{job.result.diff.cancelled}</div>
                      <div className="text-xs text-gray-500 uppercase mt-1">Cancelled</div>
                    </div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{job.result.diff.newly_scheduled}</div>
                      <div className="text-xs text-gray-500 uppercase mt-1">Recovered</div>
                    </div>
                  </div>
                  
                  <div className="mt-6 bg-gray-100 rounded-lg p-3 flex justify-between items-center">
                    <div className="text-xs font-medium text-gray-600">
                      <span className="inline-block w-3 h-3 bg-red-400 rounded-full mr-2"></span>
                      Forced: {job.result.diff.forced_changes}
                    </div>
                    <div className="text-xs font-medium text-gray-600">
                      <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mr-2"></span>
                      Optimization: {job.result.diff.optimization_changes}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation Gate */}
            <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${job.result.validation.is_valid ? 'border-green-200' : 'border-red-200'}`}>
              <div className={`p-4 border-b flex items-center justify-between ${job.result.validation.is_valid ? 'bg-green-50' : 'bg-red-50'}`}>
                <h3 className="font-semibold flex items-center gap-2">
                  {job.result.validation.is_valid ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-red-600" />}
                  Validation Gate
                </h3>
                <Badge variant="outline" className={job.result.validation.is_valid ? 'bg-green-100 text-green-800 border-green-300 font-bold' : 'bg-red-100 text-red-800 border-red-300 font-bold'}>
                  {job.result.validation.is_valid ? 'VALID REPLAN' : 'REPLAN VALIDATION FAILED'}
                </Badge>
              </div>
              
              {!job.result.validation.is_valid && (
                <div className="p-4 grid grid-cols-2 gap-y-3 text-sm">
                  <div className="flex justify-between px-2">
                    <span className="text-muted-foreground">Student Overlaps</span>
                    <span className={`font-mono font-medium ${job.result.validation.student_overlaps > 0 ? 'text-red-600' : 'text-green-600'}`}>{job.result.validation.student_overlaps}</span>
                  </div>
                  <div className="flex justify-between px-2">
                    <span className="text-muted-foreground">Room Overlaps</span>
                    <span className={`font-mono font-medium ${job.result.validation.room_overlaps > 0 ? 'text-red-600' : 'text-green-600'}`}>{job.result.validation.room_overlaps}</span>
                  </div>
                  <div className="flex justify-between px-2">
                    <span className="text-muted-foreground">Panel Overlaps</span>
                    <span className={`font-mono font-medium ${job.result.validation.panel_overlaps > 0 ? 'text-red-600' : 'text-green-600'}`}>{job.result.validation.panel_overlaps}</span>
                  </div>
                  <div className="flex justify-between px-2">
                    <span className="text-muted-foreground">Avail. Violations</span>
                    <span className={`font-mono font-medium ${job.result.validation.availability_violations > 0 ? 'text-red-600' : 'text-green-600'}`}>{job.result.validation.availability_violations}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/50">
            <BarChart2 className="h-16 w-16 mb-4 opacity-20" />
            <h3 className="text-lg font-semibold text-gray-700">Awaiting Replan Result</h3>
            <p className="text-sm mt-2 max-w-[250px]">Trigger a replan to analyze the lexicographic changes and schedule differences.</p>
          </div>
        )}
      </div>
      
    </div>
  );
}
