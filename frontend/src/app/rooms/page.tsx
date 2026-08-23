"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, X, Calendar, Trash2 } from "lucide-react";

interface Room {
  id: number;
  name: string;
  status: string;
  interviews_count: number;
  utilization: number;
}

interface RoomDetail extends Room {
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

export default function RoomManagement() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [search, setSearch] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<RoomDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchRooms = async () => {
    setStatus("loading");
    try {
      const res = await fetch("http://localhost:8000/api/rooms");
      if (!res.ok) throw new Error("Failed to fetch rooms");
      setRooms(await res.json());
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const fetchRoomDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`http://localhost:8000/api/rooms/${id}`);
      if (res.ok) {
        setSelectedRoom(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingDetail(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this room? It will be blocked if there are existing schedules.")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/rooms/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchRooms();
        if (selectedRoom?.id === id) setSelectedRoom(null);
      } else {
        const err = await res.json();
        alert(err.detail || "Delete failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const formatTime = (minutes: number | null) => {
    if (minutes === null) return "TBD";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const filtered = rooms.filter(r => {
    if (!search) return true;
    return r.name.toLowerCase().includes(search.toLowerCase());
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
            <MapPin className="h-5 w-5 text-primary" />
            Room Management
          </h1>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search rooms..."
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
                <th className="px-6 py-3">Room</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-center">Interviews</th>
                <th className="px-6 py-3 text-center">Utilization</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 cursor-pointer ${selectedRoom?.id === r.id ? 'bg-blue-50/50' : ''}`} onClick={() => fetchRoomDetail(r.id)}>
                  <td className="px-6 py-4 font-medium">{r.name}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">{r.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-center">{r.interviews_count}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${r.utilization > 80 ? 'bg-red-500' : r.utilization > 50 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, r.utilization)}%` }}></div>
                      </div>
                      <span className="text-xs text-muted-foreground w-8">{r.utilization}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="text-destructive hover:text-red-700 p-2">
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
      {selectedRoom && (
        <div className="w-[450px] flex flex-col bg-white border rounded-xl shadow-sm overflow-hidden h-full">
          <div className="border-b p-4 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-semibold">Room Profile</h3>
            <button onClick={() => setSelectedRoom(null)} className="text-gray-400 hover:text-gray-600">
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
                  <h2 className="text-xl font-bold">{selectedRoom.name}</h2>
                  <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">{selectedRoom.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground flex justify-between items-center mt-4">
                  <span>Utilization</span>
                  <span className="font-medium">{selectedRoom.utilization}%</span>
                </div>
              </div>

              <div className="p-6">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Active Schedule
                </h4>
                {selectedRoom.schedule.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No interviews scheduled in this room.</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">{selectedRoom.schedule.length} scheduled interviews</p>
                    <div className="space-y-3">
                      {selectedRoom.schedule.map(iv => (
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
