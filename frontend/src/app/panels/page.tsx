"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, Calendar, Trash2, Users } from "lucide-react";

interface Panel {
  id: number;
  name: string;
  company_id: number;
  company_name: string;
  is_active: boolean;
  interviews_count: number;
  utilization: number;
}

interface PanelDetail extends Panel {
  schedule: {
    id: number;
    day: number | null;
    start_time: number | null;
    end_time: number | null;
    company: string | null;
    student: string | null;
    student_code: string | null;
  }[];
}

export default function PanelManagement() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [search, setSearch] = useState("");
  const [selectedPanel, setSelectedPanel] = useState<PanelDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchPanels = async () => {
    setStatus("loading");
    try {
      const res = await fetch("http://localhost:8000/api/panels");
      if (!res.ok) throw new Error("Failed to fetch panels");
      setPanels(await res.json());
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const fetchPanelDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`http://localhost:8000/api/panels/${id}`);
      if (res.ok) {
        setSelectedPanel(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingDetail(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete or deactivate this panel?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/panels/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchPanels();
        if (selectedPanel?.id === id) fetchPanelDetail(id);
      } else {
        const err = await res.json();
        alert(err.detail || "Delete failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`http://localhost:8000/api/panels/${id}`, { 
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (res.ok) {
        fetchPanels();
        if (selectedPanel?.id === id) {
          setSelectedPanel({ ...selectedPanel, is_active: !currentStatus });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPanels();
  }, []);

  const formatTime = (minutes: number | null) => {
    if (minutes === null) return "TBD";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const filtered = panels.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.company_name?.toLowerCase().includes(q);
  });

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
      {/* Main Table */}
      <div className="flex-1 flex flex-col bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="border-b p-4 flex justify-between items-center bg-gray-50/50">
          <h1 className="font-semibold text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Panel Management
          </h1>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search panels..."
                className="pl-9 pr-4 py-2 border rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10 border-b">
              <tr>
                <th className="px-6 py-3">Panel</th>
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">Interviews</th>
                <th className="px-6 py-3 text-center">Utilization</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 cursor-pointer ${selectedPanel?.id === p.id ? 'bg-blue-50/50' : ''}`} onClick={() => fetchPanelDetail(p.id)}>
                  <td className="px-6 py-4 font-medium">{p.name}</td>
                  <td className="px-6 py-4">{p.company_name}</td>
                  <td className="px-6 py-4 text-center">
                    <select 
                      value={p.is_active ? "Active" : "Inactive"}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleStatus(p.id, p.is_active);
                      }}
                      className={`text-xs font-semibold py-1 px-2 rounded-md border-none focus:ring-0 ${p.is_active ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}
                    >
                      <option value="Active">Active ▼</option>
                      <option value="Inactive">Inactive ▼</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-center">{p.interviews_count}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${p.utilization > 80 ? 'bg-red-500' : p.utilization > 50 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, p.utilization)}%` }}></div>
                      </div>
                      <span className="text-xs text-muted-foreground w-8">{p.utilization}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="text-destructive hover:text-red-700 p-2">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Sidebar */}
      {selectedPanel && (
        <div className="w-[450px] flex flex-col bg-white border rounded-xl shadow-sm overflow-hidden h-full">
          <div className="border-b p-4 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-semibold">Panel Profile</h3>
            <button onClick={() => setSelectedPanel(null)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {loadingDetail ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full mt-6" />
            </div>
          ) : (
            <div className="p-0 overflow-auto flex-1">
              <div className="p-6 border-b">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-xl font-bold">{selectedPanel.name}</h2>
                  <Badge variant="outline" className={selectedPanel.is_active ? "text-green-700 bg-green-50 border-green-200" : "text-gray-500 bg-gray-100"}>
                    {selectedPanel.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mb-4">{selectedPanel.company_name}</div>
                <div className="text-sm flex justify-between items-center mt-4">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="font-medium">{selectedPanel.utilization}%</span>
                </div>
              </div>

              <div className="p-6">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Active Schedule
                </h4>
                {selectedPanel.schedule.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No interviews scheduled for this panel.</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">{selectedPanel.schedule.length} scheduled interviews</p>
                    <div className="space-y-3">
                      {selectedPanel.schedule.map(iv => (
                        <div key={iv.id} className="border rounded-md p-3 text-sm flex gap-4">
                          <div className="w-12 text-center text-muted-foreground font-medium flex flex-col items-center justify-center border-r pr-3">
                            <span className="text-[10px] uppercase">Day {iv.day}</span>
                            <span>{formatTime(iv.start_time)}</span>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="font-semibold truncate">{iv.company}</div>
                            <div className="text-xs text-muted-foreground truncate">{iv.student} ({iv.student_code})</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
