"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Building2, Users, AlertTriangle, Workflow, Box } from "lucide-react";

interface AnalyticsData {
  kpis: {
    coverage: number;
    utilization: number;
    avg_churn: number;
    interviews: number;
  };
  rooms: { name: string; utilization: number; scheduled: number }[];
  panels: { name: string; company_id: number; utilization: number; scheduled: number }[];
  replanning: {
    avg_churn: number;
    avg_preserved: number;
    avg_forced: number;
    avg_optimization: number;
    history: number[];
  };
  disruptions: {
    type: string;
    count: number;
    avg_forced: number;
    avg_churn: number;
  }[];
  companies: {
    id: number;
    name: string;
    shortlists: number;
    scheduled: number;
    coverage: number;
  }[];
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/api/analytics")
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading || !data) {
    return (
      <div className="p-8 h-full space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-[calc(100vh-2rem)] flex flex-col gap-8">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          Analytics & Insights
        </h1>
        <p className="text-muted-foreground mt-1">Operational performance metrics from the live CP-SAT engine.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white border rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900">{data.kpis.coverage}%</div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Placement Coverage</div>
          </div>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="h-12 w-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
            <Box className="h-6 w-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900">{data.kpis.utilization}%</div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Avg Resource Utilization</div>
          </div>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="h-12 w-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
            <Workflow className="h-6 w-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900">{data.kpis.avg_churn}%</div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Avg Replan Churn</div>
          </div>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900">{data.kpis.interviews}</div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Interviews</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        
        {/* Replanning Performance */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 uppercase tracking-wider text-sm flex items-center gap-2">
              <Workflow className="h-4 w-4" />
              Replanning Performance
            </h3>
          </div>
          <div className="p-6 grid grid-cols-2 gap-y-8 gap-x-4">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Avg Preserved</div>
              <div className="text-2xl font-bold text-green-600">{data.replanning.avg_preserved} <span className="text-sm font-normal text-gray-500">appts</span></div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Avg Churn</div>
              <div className="text-2xl font-bold text-orange-600">{data.replanning.avg_churn}%</div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Avg Forced</div>
              <div className="text-2xl font-bold text-red-600">{data.replanning.avg_forced} <span className="text-sm font-normal text-gray-500">changes</span></div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Avg Optimization</div>
              <div className="text-2xl font-bold text-blue-600">{data.replanning.avg_optimization} <span className="text-sm font-normal text-gray-500">changes</span></div>
            </div>
            <div className="col-span-2 border-t pt-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Churn Trend</div>
              <div className="flex items-end gap-2 h-16">
                {data.replanning.history.map((h, i) => (
                  <div key={i} className="flex-1 bg-orange-100 rounded-t relative group" style={{ height: `${Math.max(5, h)}%` }}>
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100">{h}%</div>
                  </div>
                ))}
                {data.replanning.history.length === 0 && <div className="text-sm text-gray-400 italic">No replan history available</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Disruption Impact */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 uppercase tracking-wider text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Disruption Impact
            </h3>
          </div>
          <div className="p-0 overflow-auto max-h-[350px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-semibold">Disruption Type</th>
                  <th className="px-4 py-3 font-semibold text-right">Occurrences</th>
                  <th className="px-4 py-3 font-semibold text-right">Avg Forced</th>
                  <th className="px-4 py-3 font-semibold text-right">Avg Churn</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.disruptions.length === 0 && (
                  <tr><td colSpan={4} className="text-center p-6 text-gray-400 italic">No disruptions recorded</td></tr>
                )}
                {data.disruptions.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{d.type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right">{d.count}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{d.avg_forced}</td>
                    <td className="px-4 py-3 text-right text-orange-600 font-medium">{d.avg_churn}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        
        {/* Resource Utilization */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 uppercase tracking-wider text-sm flex items-center gap-2">
              <Box className="h-4 w-4" />
              Top Resource Utilization
            </h3>
          </div>
          <div className="p-5 flex flex-col gap-4 overflow-auto max-h-[350px]">
            {data.rooms.slice(0, 5).map((r, i) => (
              <div key={`r-${i}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{r.name}</span>
                  <span className="font-bold text-gray-900">{r.utilization}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${r.utilization > 80 ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${r.utilization}%` }}></div>
                </div>
              </div>
            ))}
            
            <div className="mt-4 pt-4 border-t text-xs font-bold text-gray-500 uppercase tracking-wider">Top Panels</div>
            {data.panels.slice(0, 5).map((p, i) => (
              <div key={`p-${i}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{p.name}</span>
                  <span className="font-bold text-gray-900">{p.utilization}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${p.utilization > 80 ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${p.utilization}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Company Performance */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 uppercase tracking-wider text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Coverage Performance
            </h3>
          </div>
          <div className="p-0 overflow-auto max-h-[350px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-semibold">Company</th>
                  <th className="px-4 py-3 font-semibold text-right">Shortlisted</th>
                  <th className="px-4 py-3 font-semibold text-right">Scheduled</th>
                  <th className="px-4 py-3 font-semibold text-right">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.companies.slice(0, 50).map((c, i) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-right">{c.shortlists}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{c.scheduled}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">{c.coverage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
