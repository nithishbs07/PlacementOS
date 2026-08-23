"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, ArrowRight, ArrowRightCircle, CheckCircle2, XCircle, Clock, MapPin, Users, History, AlertCircle, Calendar, RefreshCw, Search, AlertTriangle, Filter, Activity } from "lucide-react";
import Link from "next/link";

interface ScheduleVersion {
  id: number;
  version_number: number;
  status: string;
  created_at: string;
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

interface InterviewDiff {
  student_id: number;
  company_id: number;
  student_name: string;
  company_name: string;
  change_type: string;
  is_forced: boolean | null;
  previous: {
    day: number;
    start_time: number;
    end_time: number;
    room_id: number;
    room_name: string | null;
    panel_id: number | null;
    panel_name: string | null;
  } | null;
  new: {
    day: number;
    start_time: number;
    end_time: number;
    room_id: number;
    room_name: string | null;
    panel_id: number | null;
    panel_name: string | null;
  } | null;
}

interface DiffData {
  metrics: DiffMetrics;
  details: InterviewDiff[];
}

export default function ImpactAnalysis() {
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [v1, setV1] = useState<number | "">("");
  const [v2, setV2] = useState<number | "">("");
  
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDiff, setLoadingDiff] = useState(false);
  
  const [filterType, setFilterType] = useState<string>("ALL");
  const [selectedDetail, setSelectedDetail] = useState<InterviewDiff | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/api/schedule/versions")
      .then(res => res.json())
      .then(data => {
        setVersions(data);
        if (data.length >= 2) {
          setV1(data[1].id); // parent
          setV2(data[0].id); // child
        }
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (v1 && v2) {
      setLoadingDiff(true);
      fetch(`http://localhost:8000/api/schedule/${v1}/diff/${v2}`)
        .then(res => res.json())
        .then(data => {
          setDiffData(data);
          setLoadingDiff(false);
          setSelectedDetail(null);
        })
        .catch(err => {
          console.error(err);
          setLoadingDiff(false);
        });
    }
  }, [v1, v2]);

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const filteredDetails = diffData?.details.filter(d => {
    if (filterType === "ALL") return true;
    if (filterType === "CHANGED") return d.change_type !== "Unchanged";
    if (filterType === "FORCED") return d.is_forced === true;
    if (filterType === "OPTIMIZATION") return d.is_forced === false;
    return d.change_type === filterType;
  }) || [];

  if (loading) {
    return (
      <div className="p-8 h-full space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto h-[calc(100vh-2rem)] flex flex-col gap-6 overflow-hidden">
      
      {/* Header & Selectors */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Impact Analysis
          </h1>
          <p className="text-muted-foreground mt-1">Analyze operational schedule changes and lexicographic churn</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Previous Schedule (V1)</label>
            <select 
              className="border-none bg-transparent font-semibold focus:ring-0 cursor-pointer"
              value={v1}
              onChange={(e) => setV1(Number(e.target.value))}
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>Schedule #{v.version_number} ({v.status})</option>
              ))}
            </select>
          </div>
          <ArrowRight className="text-gray-400" />
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">New Schedule (V2)</label>
            <select 
              className="border-none bg-transparent font-semibold focus:ring-0 cursor-pointer text-blue-700"
              value={v2}
              onChange={(e) => setV2(Number(e.target.value))}
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>Schedule #{v.version_number} ({v.status})</option>
              ))}
            </select>
          </div>
          <Link 
            href="/validation" 
            className="ml-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm animate-pulse"
          >
            Next Step: Verify Constraints <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {loadingDiff ? (
        <div className="flex-1 flex items-center justify-center">
          <Activity className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : !diffData ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 border-2 border-dashed rounded-xl">
          Select two schedules to compare.
        </div>
      ) : (
        <div className="flex gap-6 flex-1 overflow-hidden">
          
          {/* Left Column: Aggregates */}
          <div className="w-[350px] flex flex-col gap-6 overflow-y-auto pr-2">
            
            <div className="bg-white border rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Schedule Impact</h3>
              
              <div className="flex justify-between items-end mb-6 pb-6 border-b">
                <div>
                  <div className="text-3xl font-bold text-orange-600">{diffData.metrics.churn}%</div>
                  <div className="text-xs text-gray-500 uppercase font-semibold">Churn Rate</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-600">{diffData.metrics.unchanged}</div>
                  <div className="text-xs text-gray-500 uppercase font-semibold">Preserved</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 flex items-center gap-2"><Calendar className="h-4 w-4" /> Day Changes</span>
                  <span className="font-bold">{diffData.metrics.moved_day}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 flex items-center gap-2"><Clock className="h-4 w-4" /> Time Changes</span>
                  <span className="font-bold">{diffData.metrics.moved_time}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 flex items-center gap-2"><MapPin className="h-4 w-4" /> Room Changes</span>
                  <span className="font-bold">{diffData.metrics.moved_room}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 flex items-center gap-2"><Users className="h-4 w-4" /> Panel Changes</span>
                  <span className="font-bold">{diffData.metrics.moved_panel}</span>
                </div>
                <div className="pt-2 border-t flex justify-between items-center text-sm">
                  <span className="text-red-600 font-medium">Cancelled</span>
                  <span className="font-bold text-red-600">{diffData.metrics.cancelled}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-600 font-medium">Newly Scheduled</span>
                  <span className="font-bold text-green-600">{diffData.metrics.newly_scheduled}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Change Attribution</h3>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <span className="text-gray-700">Forced Changes</span>
                </div>
                <span className="font-bold">{diffData.metrics.forced_changes}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                  <span className="text-gray-700">Optimization Changes</span>
                </div>
                <span className="font-bold">{diffData.metrics.optimization_changes}</span>
              </div>
            </div>
            
          </div>

          {/* Middle Column: Detailed List */}
          <div className="flex-1 bg-white border rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                Affected Interviews
              </h2>
              <select 
                className="border-gray-200 rounded text-sm bg-white"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="ALL">All ({diffData.details.length})</option>
                <option value="CHANGED">All Changed ({diffData.details.length - diffData.metrics.unchanged})</option>
                <option value="FORCED">Forced Changes</option>
                <option value="OPTIMIZATION">Optimization Changes</option>
                <option value="Unchanged">Unchanged</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Newly scheduled">Newly scheduled</option>
                <option value="Room changed">Room Changed</option>
                <option value="Time changed">Time Changed</option>
                <option value="Panel changed">Panel Changed</option>
              </select>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {filteredDetails.length === 0 && (
                <div className="p-8 text-center text-muted-foreground italic">No interviews match this filter.</div>
              )}
              {filteredDetails.map((d, idx) => {
                const isSelected = selectedDetail?.student_id === d.student_id && selectedDetail?.company_id === d.company_id;
                
                let bgColor = "bg-white";
                let badgeColor = "bg-gray-100 text-gray-800";
                if (d.change_type === "Unchanged") { badgeColor = "bg-green-50 text-green-700 border-green-200"; bgColor = "bg-gray-50/30"; }
                else if (d.change_type === "Cancelled") { badgeColor = "bg-red-100 text-red-800"; bgColor = "bg-red-50/20"; }
                else if (d.change_type === "Newly scheduled") { badgeColor = "bg-blue-100 text-blue-800"; bgColor = "bg-blue-50/20"; }
                else { badgeColor = "bg-orange-100 text-orange-800 border-orange-200"; bgColor = "bg-orange-50/10"; }
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedDetail(d)}
                    className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-center ${isSelected ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/30' : bgColor}`}
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{d.company_name}</div>
                      <div className="text-xs text-gray-500">{d.student_name}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.is_forced !== null && (
                        <div className={`w-2 h-2 rounded-full ${d.is_forced ? 'bg-red-400' : 'bg-blue-400'}`} title={d.is_forced ? 'Forced Change' : 'Optimization Change'}></div>
                      )}
                      <Badge variant="outline" className={badgeColor}>{d.change_type}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Before/After Diff */}
          <div className="w-[450px] bg-white border rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-gray-900 text-white">
              <h2 className="font-semibold flex items-center gap-2">
                <Search className="h-5 w-5 opacity-70" />
                Change Detail
              </h2>
            </div>
            
            {!selectedDetail ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Search className="h-12 w-12 mb-4 opacity-20" />
                <p>Select an interview from the list to view its exact before/after comparison.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
                <div className="text-center pb-4 border-b">
                  <h3 className="text-xl font-bold text-gray-900">{selectedDetail.company_name}</h3>
                  <p className="text-muted-foreground">{selectedDetail.student_name}</p>
                  <div className="mt-3 flex justify-center gap-2">
                    <Badge>{selectedDetail.change_type}</Badge>
                    {selectedDetail.is_forced !== null && (
                      <Badge variant="outline" className={selectedDetail.is_forced ? 'border-red-300 text-red-700 bg-red-50' : 'border-blue-300 text-blue-700 bg-blue-50'}>
                        {selectedDetail.is_forced ? 'Forced Disruption' : 'Optimization Ripple'}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* BEFORE */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Previous (V1)</h4>
                  {selectedDetail.previous ? (
                    <div className="bg-gray-50 border rounded-lg p-4 grid grid-cols-2 gap-y-4">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase">Day</div>
                        <div className="font-semibold">Day {selectedDetail.previous.day}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase">Time</div>
                        <div className="font-semibold">{formatTime(selectedDetail.previous.start_time)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase">Room</div>
                        <div className="font-semibold">{selectedDetail.previous.room_name || 'TBD'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase">Panel</div>
                        <div className="font-semibold">{selectedDetail.previous.panel_name || 'TBD'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border rounded-lg p-4 text-center text-sm text-gray-500 italic">
                      Did not exist in previous schedule.
                    </div>
                  )}
                </div>

                <div className="flex justify-center">
                  <ArrowRight className="text-gray-300" />
                </div>

                {/* AFTER */}
                <div>
                  <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-3">New (V2)</h4>
                  {selectedDetail.new ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 grid grid-cols-2 gap-y-4">
                      <div>
                        <div className="text-[10px] text-blue-500 uppercase">Day</div>
                        <div className={`font-semibold ${selectedDetail.previous && selectedDetail.previous.day !== selectedDetail.new.day ? 'text-blue-700 font-bold bg-blue-200/50 rounded px-1 -ml-1 inline-block' : ''}`}>
                          Day {selectedDetail.new.day}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-blue-500 uppercase">Time</div>
                        <div className={`font-semibold ${selectedDetail.previous && selectedDetail.previous.start_time !== selectedDetail.new.start_time ? 'text-blue-700 font-bold bg-blue-200/50 rounded px-1 -ml-1 inline-block' : ''}`}>
                          {formatTime(selectedDetail.new.start_time)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-blue-500 uppercase">Room</div>
                        <div className={`font-semibold ${selectedDetail.previous && selectedDetail.previous.room_id !== selectedDetail.new.room_id ? 'text-blue-700 font-bold bg-blue-200/50 rounded px-1 -ml-1 inline-block' : ''}`}>
                          {selectedDetail.new.room_name || 'TBD'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-blue-500 uppercase">Panel</div>
                        <div className={`font-semibold ${selectedDetail.previous && selectedDetail.previous.panel_id !== selectedDetail.new.panel_id ? 'text-blue-700 font-bold bg-blue-200/50 rounded px-1 -ml-1 inline-block' : ''}`}>
                          {selectedDetail.new.panel_name || 'TBD'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-center text-sm text-red-600 font-semibold flex items-center justify-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Cancelled in new schedule.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
