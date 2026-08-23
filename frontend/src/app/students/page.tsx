"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, GraduationCap, X, Building, Calendar, Edit, Trash2 } from "lucide-react";

interface Student {
  id: number;
  student_code: string;
  name: string;
  branch: string;
  cgpa: number;
  status: string;
}

interface StudentDetail extends Student {
  shortlists: { company_id: number; company_name: string }[];
  schedule: {
    id: number;
    day: number | null;
    start_time: number | null;
    end_time: number | null;
    company: string | null;
    room: string | null;
    panel: string | null;
    status: string;
  }[];
}

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchStudents = async () => {
    setStatus("loading");
    try {
      const res = await fetch("http://localhost:8000/api/students");
      if (!res.ok) throw new Error("Failed to fetch students");
      setStudents(await res.json());
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const fetchStudentDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`http://localhost:8000/api/students/${id}`);
      if (res.ok) {
        setSelectedStudent(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingDetail(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove or withdraw this student?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/students/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchStudents();
        if (selectedStudent?.id === id) setSelectedStudent(null);
      } else {
        const err = await res.json();
        alert(err.detail || "Delete failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const formatTime = (minutes: number | null) => {
    if (minutes === null) return "TBD";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const filtered = students.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.student_code.toLowerCase().includes(q) || s.branch.toLowerCase().includes(q);
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
            <GraduationCap className="h-5 w-5 text-primary" />
            Students Management
          </h1>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search students..."
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
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Branch</th>
                <th className="px-6 py-3">CGPA</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 cursor-pointer ${selectedStudent?.id === s.id ? 'bg-blue-50/50' : ''}`} onClick={() => fetchStudentDetail(s.id)}>
                  <td className="px-6 py-4 font-mono text-muted-foreground">{s.student_code}</td>
                  <td className="px-6 py-4 font-medium">{s.name}</td>
                  <td className="px-6 py-4">{s.branch}</td>
                  <td className="px-6 py-4">{s.cgpa.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <Badge variant={s.status === 'ACTIVE' ? 'success' : 'destructive'}>{s.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="text-destructive hover:text-red-700">
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
      {selectedStudent && (
        <div className="w-96 flex flex-col bg-white border rounded-xl shadow-sm overflow-hidden h-full">
          <div className="border-b p-4 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-semibold">Student Profile</h3>
            <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600">
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
                  <h2 className="text-xl font-bold">{selectedStudent.name}</h2>
                  <Badge variant={selectedStudent.status === 'ACTIVE' ? 'success' : 'destructive'}>{selectedStudent.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground font-mono mb-1">{selectedStudent.student_code}</div>
                <div className="text-sm text-muted-foreground">{selectedStudent.branch} • CGPA {selectedStudent.cgpa.toFixed(2)}</div>
              </div>

              <div className="p-6 border-b">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Building className="h-4 w-4" /> Shortlist
                </h4>
                {selectedStudent.shortlists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No companies shortlisted.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedStudent.shortlists.map(sl => (
                      <div key={sl.company_id} className="flex justify-between items-center text-sm">
                        <span>{sl.company_name}</span>
                        <span className="text-green-600">✓</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Active Schedule
                </h4>
                {selectedStudent.schedule.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Not scheduled in the active version.</p>
                ) : (
                  <div className="space-y-4">
                    {selectedStudent.schedule.map(iv => (
                      <div key={iv.id} className="border rounded-md p-3 text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="font-semibold">{iv.company}</span>
                          <Badge variant={iv.status === "SCHEDULED" ? "success" : "secondary"} className="text-[10px]">{iv.status}</Badge>
                        </div>
                        {iv.status === "SCHEDULED" && (
                          <>
                            <div className="text-muted-foreground text-xs mb-1">
                              Day {iv.day} • {formatTime(iv.start_time)} - {formatTime(iv.end_time)}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className="text-xs text-gray-500 bg-gray-50">{iv.room || 'TBD'}</Badge>
                              <Badge variant="outline" className="text-xs text-gray-500 bg-gray-50">{iv.panel || 'TBD'}</Badge>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
