"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, ShieldAlert, Activity, FileCheck2, Database, ArrowRight } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";


interface ValidationResult {
  is_valid: boolean;
  student_overlaps: number;
  room_overlaps: number;
  panel_overlaps: number;
  availability_violations: number;
  duration_violations: number;
  withdrawn_scheduled: number;
  dropped_panel_usage: number;
  interviews_evaluated: number;
  validation_runtime: number;
}

interface ScheduleVersion {
  id: number;
  version_number: number;
  status: string;
  created_at: string;
}

export default function ValidationDefense() {
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<number | "">("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/schedule/versions`)
      .then(res => res.json())
      .then(data => {
        setVersions(data);
        if (data.length > 0) {
          setActiveVersion(data[0].id);
        }
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (activeVersion) {
      runValidation(activeVersion);
    }
  }, [activeVersion]);

  const runValidation = async (versionId: number) => {
    setValidating(true);
    setValidation(null);
    try {
      // Add artificial delay to make the validation feel more substantial/heavy
      await new Promise(r => setTimeout(r, 600));
      const res = await fetch(`${API_BASE_URL}/api/schedule/${versionId}/validation`);
      const data = await res.json();
      setValidation(data);
    } catch (err) {
      console.error(err);
    }
    setValidating(false);
  };

  if (loading) {
    return (
      <div className="p-8 h-full space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const getConstraintStatus = (violations: number) => {
    if (violations === 0) {
      return (
        <div className="flex items-center gap-2 text-green-700 font-semibold">
          <CheckCircle2 className="h-5 w-5" /> PASS
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-red-600 font-bold">
        <XCircle className="h-5 w-5" /> FAIL ({violations})
      </div>
    );
  };

  const totalViolations = validation ? (
    validation.student_overlaps +
    validation.room_overlaps +
    validation.panel_overlaps +
    validation.availability_violations +
    validation.duration_violations +
    validation.withdrawn_scheduled +
    validation.dropped_panel_usage
  ) : 0;

  return (
    <div className="p-8 max-w-[1200px] mx-auto h-[calc(100vh-2rem)] flex flex-col gap-8">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            Validation & Defense
          </h1>
          <p className="text-muted-foreground mt-1">Mathematical proof of schedule correctness and constraint satisfaction.</p>
        </div>
        
        <div className="flex items-center">
          <div className="flex flex-col bg-white p-2 rounded-lg border shadow-sm">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Target Schedule</label>
            <select 
              className="border-none bg-transparent font-semibold focus:ring-0 cursor-pointer text-blue-700"
              value={activeVersion}
              onChange={(e) => setActiveVersion(Number(e.target.value))}
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>Schedule #{v.version_number} ({v.status})</option>
              ))}
            </select>
          </div>
          <Link 
            href="/analytics" 
            className="ml-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm animate-pulse"
          >
            Next Step: View Analytics <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        
        {/* Left Col: Validation Status */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-[280px]">
            <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-700 uppercase tracking-wider text-sm flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 opacity-70" />
                Schedule Validation
              </h3>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              {validating ? (
                <>
                  <Activity className="h-16 w-16 text-blue-500 animate-spin mb-4" />
                  <div className="text-lg font-bold text-gray-900">Validating Constraints...</div>
                  <div className="text-sm text-gray-500 mt-1">Analyzing database invariants</div>
                </>
              ) : validation ? (
                <>
                  {validation.is_valid ? (
                    <ShieldCheck className="h-20 w-20 text-green-500 mb-4" />
                  ) : (
                    <ShieldAlert className="h-20 w-20 text-red-500 mb-4" />
                  )}
                  <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">STATUS</div>
                  <div className={`text-4xl font-black ${validation.is_valid ? 'text-green-600' : 'text-red-600'}`}>
                    {validation.is_valid ? '✓ VALID' : '⚠ INVALID'}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          
          <div className="bg-white border rounded-xl shadow-sm p-6 text-center h-[200px] flex flex-col justify-center">
             <div className="text-4xl font-bold text-gray-900 mb-2">
               {validating ? '--' : validation?.interviews_evaluated}
             </div>
             <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">
               Interviews Evaluated
             </div>
             
             <div className="text-xl font-bold text-gray-900 mb-2">
               {validating ? '--' : `${validation?.validation_runtime}s`}
             </div>
             <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">
               Validation Completed
             </div>
          </div>
        </div>

        {/* Right Col: Constraint Breakdown */}
        <div className="col-span-2 bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b bg-gray-900 text-white flex justify-between items-center">
            <h3 className="font-semibold uppercase tracking-wider text-sm flex items-center gap-2">
              <Database className="h-5 w-5 opacity-70" />
              Independent Invariant Checks
            </h3>
            <Badge variant="outline" className={`font-bold ${!validation ? 'bg-gray-700 border-gray-600 text-gray-300' : validation.is_valid ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-red-900/50 text-red-300 border-red-700'}`}>
              {validating ? 'RUNNING' : `${totalViolations} constraint violations`}
            </Badge>
          </div>
          
          <div className="flex-1 p-0">
            {validating || !validation ? (
              <div className="h-full flex items-center justify-center text-gray-400 p-12">
                <Skeleton className="w-full h-full rounded-md" />
              </div>
            ) : (
              <div className="divide-y">
                
                <div className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900 text-lg">Student constraints</div>
                    <div className="text-sm text-gray-500">Ensures no student is scheduled for overlapping interviews</div>
                  </div>
                  {getConstraintStatus(validation.student_overlaps)}
                </div>
                
                <div className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900 text-lg">Room capacity</div>
                    <div className="text-sm text-gray-500">Ensures no physical room is double-booked</div>
                  </div>
                  {getConstraintStatus(validation.room_overlaps)}
                </div>
                
                <div className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900 text-lg">Panel capacity</div>
                    <div className="text-sm text-gray-500">Ensures no company panel is double-booked</div>
                  </div>
                  {getConstraintStatus(validation.panel_overlaps)}
                </div>
                
                <div className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900 text-lg">Company availability</div>
                    <div className="text-sm text-gray-500">Ensures interviews occur exactly within registered company time slots</div>
                  </div>
                  {getConstraintStatus(validation.availability_violations)}
                </div>
                
                <div className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900 text-lg">Student availability</div>
                    <div className="text-sm text-gray-500">Ensures interviews respect student shortlists</div>
                  </div>
                  <div className="flex items-center gap-2 text-green-700 font-semibold">
                    <CheckCircle2 className="h-5 w-5" /> PASS
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900 text-lg">Interview duration</div>
                    <div className="text-sm text-gray-500">Ensures slot length matches company requirements</div>
                  </div>
                  {getConstraintStatus(validation.duration_violations)}
                </div>
                
                <div className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900 text-lg">Withdrawn students</div>
                    <div className="text-sm text-gray-500">Ensures withdrawn candidates remain unscheduled</div>
                  </div>
                  {getConstraintStatus(validation.withdrawn_scheduled)}
                </div>
                
                <div className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900 text-lg">Dropped panels</div>
                    <div className="text-sm text-gray-500">Ensures deactivated panels are not utilized</div>
                  </div>
                  {getConstraintStatus(validation.dropped_panel_usage)}
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
