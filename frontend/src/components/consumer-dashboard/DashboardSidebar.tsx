"use client";

import { useState } from "react";
import { LogOut, Menu, X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmDialog } from "@/components/ui";
import { NAV_ITEMS } from "./navItems";
import type { NavId } from "./types";

interface DashboardSidebarProps {
  activeNav: NavId;
  setActiveNav: (nav: NavId) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  clientName: string;
  /** The signed-in address, shown so the customer can tell which account this is. */
  clientEmail: string;
  logout: () => void;
}

/** Desktop sidebar + mobile nav bar and dropdown for the dashboard. */
export function DashboardSidebar({
  activeNav, setActiveNav, sidebarOpen, setSidebarOpen, clientName, clientEmail, logout,
}: DashboardSidebarProps) {
  const initial = clientName.charAt(0).toUpperCase();
  const [confirmLogout, setConfirmLogout] = useState(false);

  return (
    <>
      {/* SIDEBAR NAVIGATION PANEL (Redesigned & Premium) */}
      <aside className={`hidden md:flex md:w-64 flex-col rounded-[32px] border p-6 text-left space-y-7 self-start transition-all duration-300 bg-white/80 border-slate-200 shadow-premium backdrop-blur-xl dark:bg-slate-900/40 dark:border-white/5 dark:shadow-2xl dark:backdrop-blur-xl`}>
        {/* User Profile Badge with Pulse Node Indicator */}
        <div className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group bg-slate-50 border-slate-150 dark:bg-white/[0.02] dark:border-white/5`}>
          {/* Holographic flow on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-650 to-indigo-650 text-white flex items-center justify-center font-black text-sm border border-purple-500/20 shadow-md">
              {initial}
            </div>
            {/* Pulsing AI Activity Indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-950 rounded-full shadow-glow">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </span>
          </div>

          <div className="overflow-hidden relative z-10 text-left">
            <p className={`text-xs font-black truncate leading-none text-content`}>{clientName}</p>
            {/* Which account this is. Full address on hover, since the badge is
                narrow and a truncated address identifies nothing. */}
            <p
              title={clientEmail}
              className="text-[10px] font-medium truncate leading-none mt-1 text-slate-500 dark:text-slate-400"
            >
              {clientEmail}
            </p>
            <span className="text-[9px] text-cyan-400 font-extrabold uppercase tracking-widest mt-1.5 inline-flex items-center gap-1 leading-none">
              <Zap className="w-2.5 h-2.5 fill-cyan-400 animate-pulse" />
              <span>AI MATCHED</span>
            </span>
          </div>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const IconComp = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl font-extrabold text-[10px] uppercase tracking-widest transition-all cursor-pointer group ${
                  isActive
                    ? "bg-purple-650 text-white shadow-glow border border-purple-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <IconComp className={`w-4.5 h-4.5 transition-colors ${
                  isActive ? "text-cyan-300" : "text-slate-450 group-hover:text-purple-400"
                }`} />
                <span className="mt-0.5">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="pt-6 border-t border-white/5 space-y-1">
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl font-extrabold text-[10px] uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Lock & Log Out</span>
          </button>
        </div>
      </aside>

      {/* MOBILE NAVIGATION CONTAINER */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 border border-white/5 rounded-2xl p-4 shadow-sm w-full">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8.5 h-8.5 rounded-lg bg-purple-550 text-white flex items-center justify-center font-black text-sm">
              {initial}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900 shadow-glow" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-white leading-none">{clientName}</p>
            <p className="text-[8px] text-cyan-400 font-extrabold uppercase tracking-widest mt-1 leading-none">Protection Active</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={sidebarOpen}
          className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 cursor-pointer"
        >
          {sidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
        </button>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden w-full bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-xl flex flex-col gap-4 text-left z-20"
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider ${
                  activeNav === item.id
                    ? "bg-purple-650 text-white"
                    : "text-slate-400 hover:bg-white/5"
                }`}
              >
                <item.icon className="w-4.5 h-4.5" />
                <span>{item.label}</span>
              </button>
            ))}
            <button
              onClick={() => setConfirmLogout(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-rose-500 hover:bg-rose-500/10"
            >
              <LogOut className="w-4.5 h-4.5" />
              <span>Lock & Log Out</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmLogout}
        tone="danger"
        title="Log out of Aegis?"
        description="You'll need to sign in again to reach your dashboard and policies."
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </>
  );
}
