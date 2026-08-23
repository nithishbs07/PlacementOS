"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";

export function BackgroundVideo() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return null;

  // Determine opacity based on current route
  let opacity = 0.08;
  
  if (pathname === "/") {
    opacity = 0.14; // Dashboard
  } else if (pathname?.startsWith("/schedule") || pathname?.startsWith("/operations") || pathname?.startsWith("/replan")) {
    opacity = 0.10; 
  } else if (pathname?.startsWith("/disruptions")) {
    opacity = 0.08; 
  } else if (pathname?.startsWith("/students") || pathname?.startsWith("/companies") || pathname?.startsWith("/rooms") || pathname?.startsWith("/panels")) {
    opacity = 0.05; 
  } else if (pathname?.startsWith("/validation") || pathname?.startsWith("/analytics") || pathname?.startsWith("/analysis") || pathname?.startsWith("/history")) {
    opacity = 0.03; // Very subtle for dense data pages
  }

  // We construct the composition based on the theme.
  // The user wants:
  // LIGHT: Cool blue-gray surface + subtle blue/cyan/violet network
  // DARK: Deep navy/slate surface + electric blue/cyan/violet network
  
  // If the source video is mostly white:
  // LIGHT MODE: mix-blend-multiply removes white. We screen a blue color over the dark network lines to tint them.
  // DARK MODE: invert(1) makes it mostly black. mix-blend-screen removes black. We multiply a cyan color over the white lines to tint them.

  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden transition-opacity duration-1000">
      
      {/* Base layer provided by body bg-background, but we add an ambient gradient */}
      <div 
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background: isDark 
            ? "radial-gradient(circle at 30% 20%, rgba(56, 189, 248, 0.05), transparent 50%)" 
            : "radial-gradient(circle at 30% 20%, rgba(37, 99, 235, 0.03), transparent 50%)"
        }}
      />

      {/* Network Video Composition Layer */}
      <div 
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: opacity,
          mixBlendMode: isDark ? "screen" : "multiply",
          transform: "translate3d(0,0,0)"
        }}
      >
        <video
          src="/network-bg.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: isDark 
              ? "invert(1) contrast(1.2) brightness(0.8)" 
              : "contrast(1.1) brightness(0.9)",
            transition: "filter 0.5s ease"
          }}
        />
        
        {/* Color Tint Layer over the video (inside the composition group) */}
        <div 
          className="absolute inset-0 transition-colors duration-1000"
          style={{
            backgroundColor: isDark ? "#22d3ee" : "#2563eb", // Cyan for dark, Blue for light
            mixBlendMode: isDark ? "multiply" : "screen"
          }}
        />
      </div>

      {/* Radial Vignette to soften the edges so it feels embedded */}
      <div 
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at center, transparent 30%, var(--background) 100%)",
          opacity: 0.8
        }}
      />
    </div>
  );
}
