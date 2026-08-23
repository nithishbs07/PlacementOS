"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Activity, CheckCircle2, XCircle, AlertCircle, Clock, Calendar, CheckSquare, Settings } from "lucide-react";

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
}

interface ScheduleVersion {
  id: number;
  version_number: number;
  parent_version_id: number | null;
  status: string;
  created_at: string;
  scheduled_count: number;
}

export default function OperationsCenter() {
  const [job, setJob] = useState<JobState | null>(null);
  const [activeStats, setActiveStats] = useState<ActiveScheduleStats | null>(null);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/operations/status");
      const data = await res.json();
      setJob(data.job);
      setActiveStats(data.active_schedule);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVersions = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/schedule/versions");
      setVersions(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus().then(() => setLoading(false));
    fetchVersions();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerate = async () => {
    try {
      await fetch("http://localhost:8000/api/schedule/generate", { method: "POST" });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-8 h-full space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isGenerating = job?.status === "RUNNING";

  return (
    <div className="p-8 max-w-[1600px] mx-auto h-[calc(100vh-2rem)] flex gap-6">
      
      {/* Left Column: Generator & Active Stats */}
      <div className="flex-1 flex flex-col gap-6 overflow-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Scheduling Operations</h1>
            <p className="text-muted-foreground mt-1">Manage schedule generation and track engine health</p>
          </div>
        </div>

        {/* Generate Card */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                Schedule Generation
              </h2>
              <p className="text-sm text-muted-foreground">Run the CP-SAT engine to generate or replan</p>
            </div>
            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`px-6 py-2.5 rounded-md font-semibold text-white transition-all flex items-center gap-2 ${isGenerating ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}
            >
              {isGenerating ? <Activity className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              {isGenerating ? 'Engine Running...' : 'Generate Schedule'}
            </button>
          </div>
          
          {isGenerating && (
            <div className="p-6 bg-blue-50/50">
              <div className="flex justify-between text-sm font-medium text-blue-900 mb-2">
                <span>Phase: {job?.stage}</span>
                <span className="tabular-nums">{(Date.now() / 1000 - (job?.start_time || 0)).toFixed(0)}s</span>
              </div>
              <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full animate-pulse w-full"></div>
              </div>
              <p className="text-xs text-blue-700 mt-3 text-center">
                {job?.stage === "SOLVING" ? "CP-SAT engine is exploring bounds..." : "Validating constraints..."}
              </p>
            </div>
          )}

          {job?.status === "COMPLETED" && job.result && (
            <div className="p-6 bg-green-50/50 border-t border-green-100">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <h3 className="font-semibold">Generation Completed in {job.runtime}s</h3>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  {job.result.solver_status}
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-4 mt-6">
                <div className="bg-white p-3 rounded border border-green-100">
                  <div className="text-xs text-green-700 uppercase">Coverage</div>
                  <div className="text-xl font-bold">{job.result.coverage}%</div>
                </div>
                <div className="bg-white p-3 rounded border border-green-100">
                  <div className="text-xs text-green-700 uppercase">Scheduled</div>
                  <div className="text-xl font-bold">{job.result.scheduled_count}</div>
                </div>
                <div className="bg-white p-3 rounded border border-green-100">
                  <div className="text-xs text-green-700 uppercase">Unscheduled</div>
                  <div className="text-xl font-bold text-red-600">{job.result.unscheduled_count}</div>
                </div>
                <div className="bg-white p-3 rounded border border-green-100">
                  <div className="text-xs text-green-700 uppercase">Utilization</div>
                  <div className="text-xl font-bold">{job.result.utilization}%</div>
                </div>
              </div>
            </div>
          )}

          {job?.status === "FAILED" && (
            <div className="p-6 bg-red-50/50 border-t border-red-100">
              <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                <XCircle className="h-5 w-5" />
                Generation Failed
              </div>
              <pre className="text-xs bg-red-100 p-3 rounded text-red-900 overflow-auto whitespace-pre-wrap">
                {job.error}
              </pre>
            </div>
          )}
        </div>

        {/* Validation Gate */}
        {job?.result?.validation && (
          <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${job.result.validation.is_valid ? 'border-green-200' : 'border-red-200'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${job.result.validation.is_valid ? 'bg-green-50' : 'bg-red-50'}`}>
              <h3 className="font-semibold flex items-center gap-2">
                {job.result.validation.is_valid ? <CheckSquare className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-red-600" />}
                Validation Gate
              </h3>
              <Badge variant="outline" className={job.result.validation.is_valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                {job.result.validation.is_valid ? 'VALID' : 'INVALID'}
              </Badge>
            </div>
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
                <span className="text-muted-foreground">Availability Violations</span>
                <span className={`font-mono font-medium ${job.result.validation.availability_violations > 0 ? 'text-red-600' : 'text-green-600'}`}>{job.result.validation.availability_violations}</span>
              </div>
              <div className="flex justify-between px-2">
                <span className="text-muted-foreground">Duration Violations</span>
                <span className={`font-mono font-medium ${job.result.validation.duration_violations > 0 ? 'text-red-600' : 'text-green-600'}`}>{job.result.validation.duration_violations}</span>
              </div>
              <div className="flex justify-between px-2">
                <span className="text-muted-foreground">Withdrawn Scheduled</span>
                <span className={`font-mono font-medium ${job.result.validation.withdrawn_scheduled > 0 ? 'text-red-600' : 'text-green-600'}`}>{job.result.validation.withdrawn_scheduled}</span>
              </div>
            </div>
          </div>
        )}

        {/* Current Active Stats */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex-1">
          <div className="border-b p-4 bg-gray-50/50">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              Active Schedule Stats
            </h2>
          </div>
          {activeStats ? (
            <div className="p-6 grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Active Version</p>
                <p className="text-2xl font-bold text-gray-900">Schedule #{activeStats.version_id}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(activeStats.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Interviews Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">{activeStats.scheduled_count}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Unscheduled Backlog</p>
                <p className="text-2xl font-bold text-red-600">{activeStats.unscheduled_count}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Companies Covered</p>
                <p className="text-2xl font-bold text-gray-900">{activeStats.companies_covered}</p>
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">No active schedule found.</div>
          )}
        </div>
      </div>

      {/* Right Column: History */}
      <div className="w-[400px] flex flex-col bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="border-b p-4 bg-gray-50/50 flex justify-between items-center">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            Schedule History
          </h2>
          <Badge variant="secondary">{versions.length}</Badge>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {versions.map((v, i) => (
            <div key={v.id} className={`p-4 border rounded-lg hover:border-blue-300 transition-colors cursor-pointer ${i === 0 ? 'bg-blue-50/30 border-blue-200' : 'bg-white'}`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-sm">Schedule #{v.version_number}</h3>
                {i === 0 && <Badge className="bg-blue-600">Active</Badge>}
                {i !== 0 && <Badge variant="outline" className="text-gray-500">Archived</Badge>}
              </div>
              <div className="text-xs text-muted-foreground mb-3">{new Date(v.created_at).toLocaleString()}</div>
              
              <div className="flex items-center gap-4 text-sm mt-2 pt-2 border-t">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground">Scheduled</span>
                  <span className="font-medium">{v.scheduled_count}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground">Type</span>
                  <span className="font-medium">{v.status === "INITIAL" ? "Generated" : "Replanned"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
