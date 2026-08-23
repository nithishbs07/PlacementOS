"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Plus, Search, Eye, CheckCircle2, AlertCircle, Play, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Disruption {
  id: number;
  schedule_version_id: number;
  disruption_type: string;
  target_id: number;
  delay_minutes: number;
  status: "PENDING" | "APPLIED";
}

interface ImpactPreview {
  affected_count: number;
  affected_interviews: {
    interview_id: number;
    student_name: string;
    company_name: string;
    day: number;
    start_time: number;
  }[];
}

export default function DisruptionCenter() {
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [formType, setFormType] = useState<string>("COMPANY_DELAY");
  const [formTarget, setFormTarget] = useState<string>("");
  const [formDelay, setFormDelay] = useState<string>("60");
  
  const [selectedDisruption, setSelectedDisruption] = useState<Disruption | null>(null);
  const [preview, setPreview] = useState<ImpactPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchDisruptions = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/disruptions");
      setDisruptions(await res.json());
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDisruptions();
  }, []);

  const handleCreate = async () => {
    if (!formTarget) return alert("Target ID is required");
    try {
      const res = await fetch("http://localhost:8000/api/disruptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disruption_type: formType,
          target_id: parseInt(formTarget),
          delay_minutes: parseInt(formDelay) || 0
        })
      });
      if (res.ok) {
        setFormTarget("");
        fetchDisruptions();
      } else {
        const err = await res.json();
        alert(err.detail);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreview = async (d: Disruption) => {
    setSelectedDisruption(d);
    setPreviewLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/disruptions/${d.id}/preview`, { method: "POST" });
      if (res.ok) {
        setPreview(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
    setPreviewLoading(false);
  };

  const handleApply = async (id: number) => {
    if (!confirm("Are you sure you want to apply this disruption to the active schedule?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/disruptions/${id}/apply`, { method: "POST" });
      if (res.ok) {
        fetchDisruptions();
        if (selectedDisruption?.id === id) {
          setSelectedDisruption({ ...selectedDisruption, status: "APPLIED" });
        }
      } else {
        const err = await res.json();
        alert(err.detail);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="p-8 h-full">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-48 w-full mb-6" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto h-[calc(100vh-2rem)] flex gap-6 flex-col lg:flex-row">
      
      {/* Left Column: Create & List */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Disruption Center</h1>
            <p className="text-muted-foreground mt-1">Manage real-world delays, dropouts, and withdrawals</p>
          </div>
          {disruptions.length > 0 && (
            <Link 
              href="/replan" 
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm animate-pulse"
            >
              Next Step: Run Replanning Engine <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Create Disruption */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-red-50/50 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="font-semibold text-red-900">Report Disruption</h2>
          </div>
          <div className="p-6 grid grid-cols-4 gap-4 items-end">
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Type</label>
              <select 
                className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-red-500"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
              >
                <option value="COMPANY_DELAY">Company Delay</option>
                <option value="PANEL_DROPOUT">Panel Dropout</option>
                <option value="STUDENT_WITHDRAWAL">Student Withdrawal</option>
                <option value="ROOM_UNAVAILABLE">Room Unavailable</option>
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Target ID</label>
              <input 
                type="number" 
                placeholder="e.g. 1"
                className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-red-500"
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
              />
            </div>
            {formType === "COMPANY_DELAY" && (
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Delay (Minutes)</label>
                <input 
                  type="number" 
                  placeholder="60"
                  className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-red-500"
                  value={formDelay}
                  onChange={(e) => setFormDelay(e.target.value)}
                />
              </div>
            )}
            <div className="col-span-1">
              <button 
                onClick={handleCreate}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md py-2 px-4 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Register
              </button>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="flex-1 bg-white border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Disruption Log</h2>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10 border-b">
                <tr>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Target</th>
                  <th className="px-6 py-3">Delay</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {disruptions.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No disruptions reported for this schedule version.</td></tr>
                )}
                {disruptions.map(d => (
                  <tr key={d.id} className={`hover:bg-gray-50 cursor-pointer ${selectedDisruption?.id === d.id ? 'bg-red-50/30' : ''}`} onClick={() => handlePreview(d)}>
                    <td className="px-6 py-4 font-medium text-gray-500">#{d.id}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{d.disruption_type.replace('_', ' ')}</td>
                    <td className="px-6 py-4 font-mono">{d.target_id}</td>
                    <td className="px-6 py-4 text-gray-500">{d.delay_minutes > 0 ? `+${d.delay_minutes}m` : '-'}</td>
                    <td className="px-6 py-4">
                      {d.status === "PENDING" ? (
                        <Badge variant="outline" className="text-orange-700 bg-orange-50 border-orange-200">Pending</Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">Applied</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-gray-500 hover:text-gray-900 flex items-center justify-end w-full gap-1">
                        <Eye className="h-4 w-4" /> Preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Impact Preview */}
      <div className="w-[450px] flex flex-col bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="border-b p-4 bg-gray-900 text-white flex justify-between items-center">
          <h2 className="font-semibold flex items-center gap-2">
            <Search className="h-5 w-5 opacity-70" />
            Impact Preview
          </h2>
        </div>
        
        {!selectedDisruption ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Eye className="h-12 w-12 mb-4 opacity-20" />
            <p>Select a disruption from the log to preview its impact on the schedule.</p>
          </div>
        ) : previewLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-24 w-full mt-6" />
          </div>
        ) : preview ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 border-b bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-gray-900">{selectedDisruption.disruption_type.replace('_', ' ')}</h3>
                {selectedDisruption.status === "PENDING" ? (
                  <Badge variant="outline" className="text-orange-700 bg-orange-50 border-orange-200">Pending</Badge>
                ) : (
                  <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">Applied</Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-4">Targeting ID: <span className="font-mono font-medium text-gray-900">{selectedDisruption.target_id}</span></p>
              
              <div className="bg-white border rounded p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{preview.affected_count}</p>
                <p className="text-xs uppercase font-semibold text-muted-foreground mt-1">Affected Interviews</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Expected Impact</h4>
              {preview.affected_count === 0 ? (
                <p className="text-sm text-muted-foreground italic">No interviews are currently affected by this disruption.</p>
              ) : (
                preview.affected_interviews.map(iv => (
                  <div key={iv.interview_id} className="border border-red-100 rounded-md p-3 text-sm flex gap-4 bg-red-50/30">
                    <div className="w-12 text-center text-red-900 font-medium flex flex-col items-center justify-center border-r border-red-100 pr-3">
                      <span className="text-[10px] uppercase">Day {iv.day}</span>
                      <span>{formatTime(iv.start_time)}</span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-semibold text-red-900 truncate">{iv.company_name}</div>
                      <div className="text-xs text-red-700 truncate">{iv.student_name}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedDisruption.status === "PENDING" && (
              <div className="p-4 border-t bg-gray-50">
                <button 
                  onClick={() => handleApply(selectedDisruption.id)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md py-3 px-4 shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <AlertCircle className="h-5 w-5" />
                  Apply Disruption
                </button>
                <p className="text-xs text-center text-muted-foreground mt-3">
                  This will cancel the affected interviews and prepare the schedule for replanning.
                </p>
              </div>
            )}
            
            {selectedDisruption.status === "APPLIED" && (
              <div className="p-4 border-t bg-blue-50 text-blue-800 flex items-center justify-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                Disruption Applied. Ready for Replan.
              </div>
            )}
          </div>
        ) : null}
      </div>
      
    </div>
  );
}
