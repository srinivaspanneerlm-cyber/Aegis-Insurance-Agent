"use client";

import { createContext, useContext, useState, useEffect } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read theme from localStorage on initial load
    const savedTheme = localStorage.getItem("aegis_theme") as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
      updateDocumentTheme(savedTheme);
    } else {
      updateDocumentTheme("dark");
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("aegis_theme", nextTheme);
    updateDocumentTheme(nextTheme);
  };

  const updateDocumentTheme = (newTheme: Theme) => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      if (newTheme === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.add("light");
        root.classList.remove("dark");
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div style={mounted ? {} : { visibility: "hidden" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
