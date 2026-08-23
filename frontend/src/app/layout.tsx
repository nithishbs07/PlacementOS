import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LayoutDashboard, CalendarDays, Building2, GraduationCap, Users, AlertTriangle, Workflow, BarChart3, ShieldCheck, History, Settings, MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { StartupExperience } from "@/components/StartupExperience";
import { BackgroundVideo } from "@/components/BackgroundVideo";
import { ThemeProvider } from "@/components/ThemeProvider";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlacementOS | Operations Platform",
  description: "Placement Scheduling & Dynamic Replanning Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex bg-background text-foreground transition-colors duration-500">
        <ThemeProvider>
          <StartupExperience />
          <BackgroundVideo />
          <aside className="fixed inset-y-0 left-0 z-10 w-64 border-r border-border bg-card/60 backdrop-blur-xl flex flex-col shadow-sm">
          <div className="flex h-14 items-center border-b px-6">
            <span className="font-bold tracking-tight">PlacementOS</span>
          </div>
          <div className="flex-1 overflow-auto py-4">
            <nav className="grid gap-1 px-4 text-sm font-medium">
              <div className="pb-2 pt-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Overview</div>
              <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              
              <div className="pb-2 pt-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Operations</div>
              <Link href="/schedule" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <CalendarDays className="h-4 w-4" />
                Schedule
              </Link>
              <Link href="/operations" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <Settings className="h-4 w-4" />
                Operations
              </Link>
              <Link href="/disruptions" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <AlertTriangle className="h-4 w-4" />
                Disruptions
              </Link>
              <Link href="/replan" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <RefreshCw className="h-4 w-4" />
                Replan
              </Link>

              <div className="pb-2 pt-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Management</div>
              <Link href="/students" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <GraduationCap className="h-4 w-4" />
                Students
              </Link>
              <Link href="/companies" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <Building2 className="h-4 w-4" />
                Companies
              </Link>
              <Link href="/rooms" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <MapPin className="h-4 w-4" />
                Rooms
              </Link>
              <Link href="/panels" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <Users className="h-4 w-4" />
                Panels
              </Link>

              <div className="pb-2 pt-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Intelligence</div>
              <Link href="/analysis" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <BarChart3 className="h-4 w-4" />
                Analysis
              </Link>
              <Link href="/validation" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <ShieldCheck className="h-4 w-4" />
                Validation
              </Link>
              <Link href="/analytics" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>

              <div className="pb-2 pt-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">System</div>
              <Link href="/history" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <History className="h-4 w-4" />
                History
              </Link>
            </nav>
          </div>
        </aside>
        
        <main className="flex-1 pl-64">
          {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
