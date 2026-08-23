"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Filter, Search, Zap, Play, X, Clock, MapPin, Users, History as HistoryIcon, UserCircle, Building, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Interview {
  id: number;
  status: string;
  day: number | null;
  start_time: number | null;
  end_time: number | null;
  company: string | null;
  student: string | null;
  student_code: string | null;
  room: string | null;
  panel: string | null;
  version_id: number;
}

export default function ScheduleWorkspace() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [generating, setGenerating] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [search, setSearch] = useState("");
  
  const fetchActiveSchedule = async () => {
    setStatus("loading");
    try {
      const res = await fetch("http://localhost:8000/api/schedule/active");
      if (res.status === 404) {
        setInterviews([]);
        setActiveVersionId(null);
        setStatus("success");
        fetchVersions();
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch active schedule");
      const data = await res.json();
      setInterviews(data.interviews);
      setActiveVersionId(data.version_id);
      setStatus("success");
      fetchVersions();
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const fetchVersions = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/schedule/versions");
      if (res.ok) {
        setVersions(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchActiveSchedule();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("http://localhost:8000/api/schedule/generate", { method: "POST" });
      if (res.ok) {
        await fetchActiveSchedule();
      }
    } catch (err) {
      console.error(err);
    }
    setGenerating(false);
  };

  const formatTime = (minutes: number | null) => {
    if (minutes === null) return "Unscheduled";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const filteredInterviews = interviews.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.company?.toLowerCase().includes(q) || 
            i.student?.toLowerCase().includes(q) || 
            i.room?.toLowerCase().includes(q));
  });

  const scheduled = filteredInterviews.filter(i => i.status === "SCHEDULED" && i.day && i.start_time !== null);
  
  // Group by Day then Time
  const grouped: Record<number, Record<number, Interview[]>> = {};
  scheduled.forEach(i => {
    const day = i.day as number;
    const t = i.start_time as number;
    if (!grouped[day]) grouped[day] = {};
    if (!grouped[day][t]) grouped[day][t] = [];
    grouped[day][t].push(i);
  });

  const days = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  if (status === "loading") {
    return (
      <div className="p-8 h-full">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto flex gap-6 h-[calc(100vh-2rem)]">
      {/* Main Workspace */}
      <div className="flex-1 flex flex-col bg-white border rounded-xl shadow-sm overflow-hidden relative">
        {generating && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <Zap className="h-12 w-12 text-blue-600 animate-pulse mb-4" />
            <h2 className="text-xl font-bold mb-2">Generating Schedule...</h2>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground w-64">
              <div className="flex justify-between"><span>Loading constraints</span> <span className="text-green-600">✓</span></div>
              <div className="flex justify-between"><span>CP-SAT optimization</span> <span className="animate-pulse">...</span></div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="border-b p-4 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-4">
            <h1 className="font-semibold text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Schedule Workspace
            </h1>
            {activeVersionId ? (
              <Badge variant="success">Current: V{activeVersionId}</Badge>
            ) : (
              <Badge variant="secondary">No Active Schedule</Badge>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <Link 
              href="/disruptions" 
              className="mr-2 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm"
            >
              Introduce Disruption <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search schedule..."
                className="pl-9 pr-4 py-2 border rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-gray-50 transition-colors">
              <Filter className="h-4 w-4" /> Filters
            </button>
            <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50">
              <Play className="h-4 w-4" /> Generate
            </button>
          </div>
        </div>

        {/* Grid Area */}
        <div className="flex-1 overflow-auto bg-gray-50 p-6">
          {days.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4 opacity-20" />
              <p>No interviews scheduled yet.</p>
              <button onClick={handleGenerate} className="mt-4 text-primary hover:underline text-sm font-medium">Generate initial schedule</button>
            </div>
          ) : (
            <div className="space-y-10">
              {days.map(day => (
                <div key={day} className="bg-white border rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-100/50 px-4 py-3 border-b font-semibold text-gray-700 flex items-center justify-between">
                    <span>Day {day}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {Object.values(grouped[day]).flat().length} interviews
                    </span>
                  </div>
                  <div className="divide-y">
                    {Object.keys(grouped[day]).map(Number).sort((a,b)=>a-b).map(time => (
                      <div key={time} className="flex flex-col sm:flex-row">
                        <div className="w-24 shrink-0 px-4 py-4 border-r bg-gray-50 text-sm font-medium text-gray-500">
                          {formatTime(time)}
                        </div>
                        <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {grouped[day][time].map(iv => (
                            <div 
                              key={iv.id} 
                              onClick={() => setSelectedInterview(iv)}
                              className="border rounded-md p-3 text-sm cursor-pointer hover:border-primary hover:shadow-sm transition-all group bg-white"
                            >
                              <div className="font-semibold text-gray-900 group-hover:text-primary mb-1 truncate">{iv.company}</div>
                              <div className="flex justify-between items-center text-muted-foreground text-xs">
                                <span className="truncate">{iv.student}</span>
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{iv.room}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Details & History */}
      <div className="w-80 flex flex-col gap-6">
        {selectedInterview ? (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
            <div className="border-b p-4 bg-gray-50/50 flex justify-between items-center">
              <h3 className="font-semibold">Interview Details</h3>
              <button onClick={() => setSelectedInterview(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 flex-1 overflow-auto">
              <div className="mb-6">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status</div>
                <Badge variant={selectedInterview.status === "SCHEDULED" ? "success" : "destructive"}>
                  {selectedInterview.status}
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <Building className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">{selectedInterview.company}</div>
                    <div className="text-xs text-muted-foreground">Panel: {selectedInterview.panel || "Not Assigned"}</div>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <UserCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">{selectedInterview.student}</div>
                    <div className="text-xs text-muted-foreground">Code: {selectedInterview.student_code}</div>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Day {selectedInterview.day}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(selectedInterview.start_time)} - {formatTime(selectedInterview.end_time)}</div>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">{selectedInterview.room || "Unassigned"}</div>
                    <div className="text-xs text-muted-foreground">Resource preserved</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t">
                <div className="text-xs text-muted-foreground">Schedule Version ID: {selectedInterview.version_id}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="border-b p-4 bg-gray-50/50 flex items-center gap-2">
              <HistoryIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Schedule History</h3>
            </div>
            <div className="p-0 overflow-auto flex-1">
              <div className="divide-y">
                {versions.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No history available</div>
                ) : (
                  versions.map(v => (
                    <div key={v.id} className={`p-4 transition-colors ${activeVersionId === v.id ? 'bg-blue-50/50 border-l-2 border-l-blue-600' : 'hover:bg-gray-50'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm">Schedule #{v.version_number}</span>
                        {activeVersionId === v.id && <Badge variant="default" className="text-[10px] px-1.5 py-0">Current</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                        <span>{v.status === "INITIAL" ? "Generated" : "Replanned"}</span>
                        <span>•</span>
                        <span>{new Date(v.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
