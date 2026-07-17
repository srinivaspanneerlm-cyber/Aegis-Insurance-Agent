"use client";

import { Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import type { DashboardNotification } from "./types";

interface NotificationsViewportProps {
  notifications: DashboardNotification[];
  markAllNotificationsRead: () => void;
}

/** Security bulletins list (nav: "notifications"). */
export function NotificationsViewport({
  notifications, markAllNotificationsRead,
}: NotificationsViewportProps) {
  const { theme } = useTheme();

  return (
    <motion.div
      key="notifications"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className={`border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 ${
        theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200"
      }`}
    >
      <div className="border-b border-white/5 pb-4 flex items-center justify-between">
        <div>
          <h3 className={`font-black text-base ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Security Bulletins</h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">Core system alerts compiled dynamically by Aegis model monitors.</p>
        </div>
        <button
          onClick={markAllNotificationsRead}
          className="text-[9.5px] text-purple-450 hover:text-purple-400 underline font-black uppercase tracking-widest cursor-pointer"
        >
          Clear All Read
        </button>
      </div>

      <div className="space-y-4">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`p-5 rounded-2xl border flex items-start gap-4 transition-all ${
              n.read
                ? "bg-white/[0.01] border-white/5 opacity-60"
                : "bg-purple-950/15 border-purple-500/20 shadow-lg"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              n.read ? "bg-white/5 text-slate-450" : "bg-purple-950/40 text-purple-400 border border-purple-800/30"
            }`}>
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-grow text-left space-y-1">
              <div className="flex items-center justify-between gap-4">
                <h4 className={`text-xs font-black leading-none ${theme === "dark" ? "text-white" : "text-navy-900"}`}>{n.title}</h4>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{n.time}</span>
              </div>
              <p className={`text-[11px] leading-normal font-semibold ${theme === "dark" ? "text-slate-350" : "text-slate-600"}`}>{n.message}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
