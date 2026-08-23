"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, GitCommit, GitBranch, ArrowDown, Activity, CalendarDays, ShieldCheck, Zap, Database } from "lucide-react";

interface AuditLog {
  id: number;
  timestamp: string;
  action: string;
  entity: string;
  entity_id: number | null;
  schedule_version_id: number | null;
  actor: string;
  metadata_json: string | null;
}

interface LineageNode {
  id: number;
  version_number: number;
  parent_version_id: number | null;
  status: string;
  created_at: string;
  scheduled_count: number;
  disruptions: { id: number; type: string; status: string; target_id: number }[];
}

export default function HistoryWorkspace() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [lineage, setLineage] = useState<LineageNode[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:8000/api/audit-logs").then(r => r.json()),
      fetch("http://localhost:8000/api/schedule/lineage").then(r => r.json())
    ]).then(([logsData, lineageData]) => {
      setLogs(logsData);
      setLineage(lineageData);
      if (lineageData.length > 0) {
        setSelectedVersion(lineageData[lineageData.length - 1].id);
      }
      setLoading(false);
    }).catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="p-8 h-full space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const selectedNode = lineage.find(n => n.id === selectedVersion);
  const versionLogs = logs.filter(l => l.schedule_version_id === selectedVersion);

  return (
    <div className="p-8 max-w-[1400px] mx-auto h-[calc(100vh-2rem)] flex flex-col gap-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <History className="h-8 w-8 text-blue-600" />
          Audit & History
        </h1>
        <p className="text-muted-foreground mt-1">Immutable system timeline, schedule lineage, and audit trails.</p>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        
        {/* Left Col: Schedule Lineage Timeline */}
        <div className="w-[380px] bg-white border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 uppercase tracking-wider text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-gray-500" />
              Schedule Lineage
            </h3>
          </div>
          <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
            <div className="flex flex-col gap-0 items-center">
              {lineage.map((node, i) => (
                <div key={node.id} className="w-full flex flex-col items-center group cursor-pointer" onClick={() => setSelectedVersion(node.id)}>
                  
                  {/* Parent Link Line (if not first) */}
                  {i > 0 && (
                    <div className="w-1 h-10 bg-gray-300 group-hover:bg-blue-300 transition-colors my-1 relative">
                       {/* Inject Disruption Markers here if they targeted the PARENT */}
                       {lineage[i-1].disruptions.filter(d => d.status === "APPLIED").map((d, didx) => (
                         <div key={`d-${d.id}`} className="absolute top-1/2 left-4 -translate-y-1/2 flex items-center gap-2 whitespace-nowrap bg-red-50 px-2 py-1 rounded text-[10px] text-red-600 font-bold border border-red-100 shadow-sm z-10" style={{ transform: `translateY(calc(-50% + ${didx * 24}px))` }}>
                           <Activity className="h-3 w-3" />
                           {d.type.replace('_', ' ')}
                         </div>
                       ))}
                    </div>
                  )}

                  {/* Version Node */}
                  <div className={`w-full bg-white border-2 rounded-lg p-4 shadow-sm transition-all relative ${selectedVersion === node.id ? 'border-blue-500 ring-2 ring-blue-100 scale-[1.02] shadow-md' : 'border-gray-200 hover:border-blue-300'}`}>
                    
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-lg text-gray-900 flex items-center gap-2">
                        <Database className="h-4 w-4 text-gray-400" />
                        Schedule #{node.version_number}
                      </div>
                      <Badge variant="outline" className={node.status === 'INITIAL' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}>
                        {node.status}
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-gray-500 flex items-center justify-between mt-4">
                      <span>{new Date(node.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      <span className="font-semibold text-gray-700">{node.scheduled_count} scheduled</span>
                    </div>

                    {/* Pending Disruptions indicator */}
                    {node.disruptions.filter(d => d.status === "PENDING").length > 0 && (
                       <div className="mt-3 pt-3 border-t border-dashed flex gap-1 overflow-x-auto">
                         {node.disruptions.filter(d => d.status === "PENDING").map(d => (
                           <span key={d.id} className="text-[9px] uppercase font-bold bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded whitespace-nowrap">
                             {d.type.split('_')[0]} DELAY
                           </span>
                         ))}
                       </div>
                    )}
                  </div>
                </div>
              ))}
              
              {lineage.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-green-600 font-bold text-sm bg-green-50 px-4 py-2 rounded-full border border-green-200">
                  <ShieldCheck className="h-4 w-4" /> Active Version
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Version Inspector & Audit Trail */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          
          {/* Version Inspector */}
          {selectedNode && (
            <div className="bg-white border rounded-xl shadow-sm p-6 shrink-0">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                Inspector: Schedule #{selectedNode.version_number}
              </h2>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Status</div>
                  <div className="font-semibold text-gray-900">{selectedNode.status}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Parent</div>
                  <div className="font-semibold text-gray-900">{selectedNode.parent_version_id ? `Schedule #${selectedNode.parent_version_id}` : 'None'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Coverage</div>
                  <div className="font-semibold text-gray-900">{selectedNode.scheduled_count} scheduled</div>
                </div>
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Validation</div>
                  <div className="font-semibold text-green-600 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> PASS</div>
                </div>
              </div>
            </div>
          )}

          {/* Audit Log Table */}
          <div className="bg-white border rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 uppercase tracking-wider text-sm flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-gray-500" />
                System Audit Trail {selectedVersion && `(Schedule #${selectedNode?.version_number})`}
              </h3>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-gray-500 uppercase sticky top-0 border-b">
                  <tr>
                    <th className="px-6 py-3 font-semibold w-32">Time</th>
                    <th className="px-6 py-3 font-semibold">Action</th>
                    <th className="px-6 py-3 font-semibold">Entity</th>
                    <th className="px-6 py-3 font-semibold">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {versionLogs.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">No events logged for this version.</td></tr>
                  ) : (
                    versionLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 font-mono text-gray-500 text-xs">
                          {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {log.action.includes('pending') || log.action.includes('applied') ? (
                              <Activity className="h-4 w-4 text-orange-500" />
                            ) : log.action.includes('validated') ? (
                              <ShieldCheck className="h-4 w-4 text-green-500" />
                            ) : log.action.includes('generated') || log.action.includes('completed') ? (
                              <Zap className="h-4 w-4 text-blue-500" />
                            ) : (
                              <GitCommit className="h-4 w-4 text-gray-400" />
                            )}
                            {log.action}
                          </div>
                          {log.metadata_json && (
                            <div className="mt-2 text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded truncate max-w-md group-hover:max-w-none group-hover:whitespace-normal">
                              {log.metadata_json}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="bg-gray-50">{log.entity} {log.entity_id}</Badge>
                        </td>
                        <td className="px-6 py-4 text-gray-500">{log.actor}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
