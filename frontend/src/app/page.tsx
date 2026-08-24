"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Building, Users, AlertCircle, CheckCircle2, ServerCrash, Loader2, Info, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { API_BASE_URL } from "@/lib/api";


export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/dashboard/stats`)
      .then(res => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then(data => {
        setStats(data);
        setStatus("success");
      })
      .catch(err => {
        console.error("Dashboard fetch error:", err);
        setStatus("error");
      });
  }, []);

  if (status === "loading") {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Placement Operations</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <ServerCrash className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">System Offline</h2>
          <p className="text-muted-foreground mb-6">Could not connect to the backend services. Please ensure the API is running.</p>
          <Badge variant="destructive">API Connection Failed</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Placement Operations</h1>
          <p className="text-muted-foreground">System Overview & Live Metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={stats.schedule_health === 100 ? "success" : "warning"} className="px-3 py-1 text-sm">
            Health: {stats.schedule_health}%
          </Badge>
          <Badge variant={stats.active_version ? "default" : "secondary"} className="px-3 py-1 text-sm">
            {stats.active_version ? `Active: Schedule #${stats.active_version}` : "No Active Schedule"}
          </Badge>
          <ThemeToggle />
          <Link 
            href="/schedule" 
            className="ml-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm"
          >
            Next Step: View Schedule <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Demand</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total_demand}</div>
            <p className="text-xs text-muted-foreground mt-1">
              total student shortlist requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled / Coverage</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.today_interviews}</div>
            <div className="text-xs font-medium mt-1">
              Coverage: {stats.total_demand > 0 ? (stats.today_interviews / stats.total_demand * 100).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unscheduled</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{stats.unscheduled_interviews}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.unscheduled_reasons && Object.keys(stats.unscheduled_reasons).length > 0 ? (
                <div className="space-y-1">
                  {Object.entries(stats.unscheduled_reasons).map(([reason, count]) => (
                    <div key={reason} className="flex justify-between">
                      <span className="truncate pr-2">{reason}:</span>
                      <span className="font-medium">{count as React.ReactNode}</span>
                    </div>
                  ))}
                </div>
              ) : (
                "No unscheduled reasons"
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Resources</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-2 mt-1">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Companies:</span>
                <span className="text-lg font-bold">{stats.total_companies}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Rooms:</span>
                <span className="text-lg font-bold">{stats.total_rooms}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Solver Engine</span>
              <Badge variant="success">READY</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Database</span>
              <Badge variant="success">HEALTHY</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Validation Agent</span>
              <Badge variant={stats.conflicts === 0 ? "success" : "destructive"}>
                {stats.conflicts === 0 ? "PASS" : `${stats.conflicts} CONFLICTS`}
              </Badge>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium">Pending Disruptions</span>
              <Badge variant={stats.pending_disruptions > 0 ? "warning" : "secondary"}>
                {stats.pending_disruptions}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Next Interviews (Preview)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.today_interviews === 0 || !stats.next_interviews || stats.next_interviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center border border-dashed rounded-lg">
                <Info className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No upcoming interviews</p>
                <p className="text-xs text-muted-foreground">Run schedule generation in the Schedule workspace.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.next_interviews.map((iv: any) => (
                  <div key={iv.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0 pb-2">
                    <span className="w-16 font-mono text-muted-foreground">{iv.time}</span>
                    <span className="flex-1 font-medium">{iv.company}</span>
                    <span className="flex-1 text-muted-foreground">{iv.student}</span>
                    <span className="w-20 text-right font-medium">{iv.room}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
