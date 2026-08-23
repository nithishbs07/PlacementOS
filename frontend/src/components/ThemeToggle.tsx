"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-full bg-white/10 dark:bg-slate-900/10 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm shadow-sm" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/60 hover:bg-white/90 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 backdrop-blur-md shadow-sm transition-all duration-300 overflow-hidden"
    >
      <div className={`absolute transition-all duration-500 transform ${theme === 'dark' ? '-translate-y-10 opacity-0 rotate-90' : 'translate-y-0 opacity-100 rotate-0'}`}>
        <Sun className="h-4 w-4 text-slate-700" />
      </div>
      <div className={`absolute transition-all duration-500 transform ${theme === 'light' ? 'translate-y-10 opacity-0 -rotate-90' : 'translate-y-0 opacity-100 rotate-0'}`}>
        <Moon className="h-4 w-4 text-blue-400" />
      </div>
    </button>
  );
}
