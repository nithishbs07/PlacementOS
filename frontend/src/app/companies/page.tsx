"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Building2, X, Clock, Calendar, Users, Trash2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";


interface Company {
  id: number;
  name: string;
  industry: string;
  priority_tier: number;
  shortlist_count: number;
  scheduled_count: number;
}

interface CompanyDetail extends Company {
  interview_duration: number;
  availabilities: { day: number; start_time: number; end_time: number }[];
  shortlists: { student_id: number; student_name: string; branch: string }[];
  schedule: {
    id: number;
    day: number | null;
    start_time: number | null;
    end_time: number | null;
    student: string | null;
    room: string | null;
    panel: string | null;
    status: string;
  }[];
}

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanyDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchCompanies = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE_URL}/api/companies`);
      if (!res.ok) throw new Error("Failed to fetch companies");
      setCompanies(await res.json());
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const fetchCompanyDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/companies/${id}`);
      if (res.ok) {
        setSelectedCompany(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingDetail(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this company? This action cannot be undone unless it is protected by existing schedules.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/companies/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCompanies();
        if (selectedCompany?.id === id) setSelectedCompany(null);
      } else {
        const err = await res.json();
        alert(err.detail || "Delete failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const filtered = companies.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q);
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
            <Building2 className="h-5 w-5 text-primary" />
            Company Management
          </h1>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search companies..."
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
                <th className="px-6 py-3">Company Name</th>
                <th className="px-6 py-3">Industry</th>
                <th className="px-6 py-3">Priority</th>
                <th className="px-6 py-3">Shortlisted</th>
                <th className="px-6 py-3">Scheduled</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 cursor-pointer ${selectedCompany?.id === c.id ? 'bg-blue-50/50' : ''}`} onClick={() => fetchCompanyDetail(c.id)}>
                  <td className="px-6 py-4 font-medium">{c.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.industry || "—"}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline">Tier {c.priority_tier}</Badge>
                  </td>
                  <td className="px-6 py-4">{c.shortlist_count} students</td>
                  <td className="px-6 py-4">{c.scheduled_count} interviews</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="text-destructive hover:text-red-700">
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
      {selectedCompany && (
        <div className="w-[450px] flex flex-col bg-white border rounded-xl shadow-sm overflow-hidden h-full">
          <div className="border-b p-4 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-semibold">Company Profile</h3>
            <button onClick={() => setSelectedCompany(null)} className="text-gray-400 hover:text-gray-600">
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
                  <h2 className="text-xl font-bold">{selectedCompany.name}</h2>
                  <Badge variant="outline">Tier {selectedCompany.priority_tier}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mb-4">{selectedCompany.industry || "No industry specified"}</div>
                
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" /> {selectedCompany.interview_duration} min duration
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" /> {selectedCompany.shortlists.length} shortlisted
                  </div>
                </div>
              </div>

              <div className="p-6 border-b">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Availability Windows
                </h4>
                {selectedCompany.availabilities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No availability provided.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedCompany.availabilities.map((av, idx) => (
                      <div key={idx} className="flex justify-between items-center border p-2 rounded-md bg-gray-50 text-sm">
                        <span className="font-medium text-gray-700">Day {av.day}</span>
                        <span className="text-muted-foreground">{formatTime(av.start_time)} - {formatTime(av.end_time)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Active Schedule
                </h4>
                {selectedCompany.schedule.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No interviews scheduled in the active version.</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">{selectedCompany.schedule.length} active interviews</p>
                    <div className="space-y-3">
                      {selectedCompany.schedule.slice(0, 50).map(iv => (
                        <div key={iv.id} className="border rounded-md p-3 text-sm flex justify-between items-center">
                          <div>
                            <div className="font-semibold">{iv.student}</div>
                            <div className="text-xs text-muted-foreground">Day {iv.day} • {formatTime(iv.start_time!)}</div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="text-xs mb-1 block">{iv.room || 'TBD'}</Badge>
                            <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-200">{iv.panel || 'TBD'}</Badge>
                          </div>
                        </div>
                      ))}
                      {selectedCompany.schedule.length > 50 && (
                        <div className="text-center text-xs text-muted-foreground pt-2">
                          ... and {selectedCompany.schedule.length - 50} more
                        </div>
                      )}
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
