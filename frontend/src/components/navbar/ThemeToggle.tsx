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
      className={`w-14 h-7 rounded-full p-0.5 transition-all duration-300 relative border flex items-center cursor-pointer shadow-inner ${
        theme === "dark"
          ? "bg-slate-900 border-white/10"
          : "bg-slate-100 border-slate-200"
      }`}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`w-6 h-6 rounded-full flex items-center justify-center text-white border shadow-md ${
          theme === "dark"
            ? "bg-gradient-to-tr from-cyan-600 to-blue-500 border-cyan-400/20 translate-x-7"
            : "bg-gradient-to-tr from-amber-400 to-yellow-500 border-amber-300/20 translate-x-0"
        }`}
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
