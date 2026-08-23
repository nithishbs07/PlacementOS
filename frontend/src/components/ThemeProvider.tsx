"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check localStorage first
    const stored = localStorage.getItem("placementos-theme") as Theme;
    if (stored === "dark" || stored === "light") {
      setThemeState(stored);
      if (stored === "dark") document.documentElement.classList.add("dark");
    } else {
      // Check system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        setThemeState("dark");
        document.documentElement.classList.add("dark");
      }
    }
    setMounted(true);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("placementos-theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Prevent flash by not rendering children until theme is resolved on client
  // Since we are adding `.dark` manually and not using SSR injected scripts, this is standard for client components
  // To avoid layout shifting, we just render children, but we return early from the context if we strictly needed to.
  // We'll render children anyway, the useEffect runs immediately on mount.
  // Return children directly, suppressing hydration warnings on the html/body if needed
  // In Next.js, it's generally fine if we just apply the class in useEffect for this demo
  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
