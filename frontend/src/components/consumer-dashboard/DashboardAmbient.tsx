"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

/** Floating particles + cinematic glows behind the dashboard. */
export function DashboardAmbient() {
  const { theme } = useTheme();

  return (
    <>
      {/* Interactive ambient floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-3 h-3 rounded-full ${
              i % 2 === 0 ? "bg-purple-500/20" : "bg-cyan-500/20"
            } blur-sm`}
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i * 12) % 60}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, i % 2 === 0 ? 15 : -15, 0],
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Cinematic animated tech glows */}
      {theme === "dark" ? (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(168,85,247,0.18),rgba(255,255,255,0))]" />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[15%] left-[-15%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[130px] pointer-events-none"
          />
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/8 blur-[120px] pointer-events-none"
          />
        </>
      ) : (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.06),rgba(255,255,255,0))]" />
          <div className="absolute top-[10%] left-[-5%] w-[45%] h-[45%] rounded-full bg-purple-100/40 blur-[100px] pointer-events-none" />
        </>
      )}
    </>
  );
}
