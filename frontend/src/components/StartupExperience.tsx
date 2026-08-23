"use client";

import { useEffect, useState } from "react";
import { SkipForward } from "lucide-react";

export function StartupExperience() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const [statusText, setStatusText] = useState("INITIALIZING PLACEMENTOS");

  useEffect(() => {
    // Check if we've already shown the startup this session
    const hasStarted = sessionStorage.getItem("placementos_started");
    
    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    
    if (!hasStarted && !prefersReducedMotion) {
      setShow(true);
      
      // Update status text over time to simulate boot sequence
      const t1 = setTimeout(() => setStatusText("Loading scheduling engine..."), 800);
      const t2 = setTimeout(() => setStatusText("Synchronizing workspace..."), 1800);
      const t3 = setTimeout(() => setStatusText("System ready"), 2500);

      // Trigger fade out at 3 seconds
      const fadeTimer = setTimeout(() => {
        finishStartup();
      }, 3200);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(fadeTimer);
      };
    }
  }, []);

  const finishStartup = () => {
    setFading(true);
    // Unmount completely after fade transition completes (500ms)
    setTimeout(() => {
      sessionStorage.setItem("placementos_started", "true");
      setShow(false);
    }, 500);
  };

  if (!show) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0a0a] text-white transition-opacity duration-500 ease-in-out ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <video 
        src="/startup.mp4" 
        autoPlay 
        muted 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none"
        style={{ transform: "translateZ(0)" }}
      />
      
      {/* Readability / Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-90 pointer-events-none" />

      {/* Boot Status */}
      <div className="relative z-10 flex flex-col items-center mt-auto mb-24 space-y-4">
        <h1 className="text-2xl font-bold tracking-[0.2em] uppercase text-white/90">PlacementOS</h1>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white/90 animate-spin" />
          <span className="text-sm font-medium tracking-widest text-white/60 uppercase">
            {statusText}
          </span>
        </div>
      </div>

      {/* Skip Action */}
      <button 
        onClick={finishStartup}
        className="absolute bottom-8 right-8 flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/50 hover:text-white/90 transition-colors bg-white/5 hover:bg-white/10 rounded-md backdrop-blur-sm"
      >
        Skip <SkipForward className="h-3 w-3" />
      </button>
    </div>
  );
}
