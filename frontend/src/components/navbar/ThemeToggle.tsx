"use client";

import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

/** Dark/light theme switch. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={theme === "dark"}
      className={`w-14 h-7 rounded-full p-0.5 transition-all duration-300 relative border flex items-center cursor-pointer shadow-inner bg-slate-100 border-slate-200 dark:bg-slate-900 dark:border-white/10`}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`w-6 h-6 rounded-full flex items-center justify-center text-white border shadow-md bg-gradient-to-tr from-amber-400 to-yellow-500 border-amber-300/20 translate-x-0 dark:bg-gradient-to-tr dark:from-cyan-600 dark:to-blue-500 dark:border-cyan-400/20 dark:translate-x-7`}
      >
        {theme === "dark" ? (
          <Moon className="w-3.5 h-3.5 text-cyan-200" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-950" />
        )}
      </motion.div>
    </button>
  );
}
