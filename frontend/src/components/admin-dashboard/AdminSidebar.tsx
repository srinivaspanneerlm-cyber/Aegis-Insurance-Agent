"use client";

import { useState } from "react";
import { Cpu, Radio } from "lucide-react";
import { ConfirmDialog } from "@/components/ui";
import { ADMIN_NAV_ITEMS } from "./navItems";
import type { AdminNav } from "./types";

interface AdminSidebarProps {
  activeNav: AdminNav;
  setActiveNav: (nav: AdminNav) => void;
  userName?: string;
  logout: () => void;
}

/** Cyber command-center sidebar: officer node, section nav, and shutdown. */
export function AdminSidebar({ activeNav, setActiveNav, userName, logout }: AdminSidebarProps) {
  const [confirmLogout, setConfirmLogout] = useState(false);

  return (
    <aside className="w-full lg:w-64 flex flex-col bg-slate-900 border border-cyan-500/20 rounded-3xl p-6 space-y-6 self-start">
      <div className="flex items-center gap-3 bg-slate-950 p-4 rounded-2xl border border-cyan-500/20 shadow-md">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
          <Cpu className="w-5 h-5 animate-pulse" />
        </div>
        <div className="overflow-hidden">
          <p className="text-xs font-black truncate text-cyan-300 leading-none">{userName || "Officer Node"}</p>
          <p className="text-[8.5px] text-cyan-400 font-extrabold uppercase tracking-widest mt-1.5 leading-none">Security Officer</p>
        </div>
      </div>

      <nav className="space-y-1">
        {ADMIN_NAV_ITEMS.map((item) => {
          const IconComp = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer border ${
                isActive
                  ? "bg-cyan-950/40 text-cyan-400 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                  : "text-slate-500 border-transparent hover:text-cyan-300 hover:bg-white/[0.02]"
              }`}
            >
              <IconComp className={`w-4 h-4 ${isActive ? "text-cyan-400 animate-pulse" : ""}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="pt-6 border-t border-white/5 space-y-1">
        <button
          onClick={() => setConfirmLogout(true)}
          className="w-full flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-rose-500 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/30 transition-all cursor-pointer"
        >
          <Radio className="w-4 h-4 animate-ping" />
          <span>Shutdown Node</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        tone="danger"
        title="Shut down this node?"
        description="This ends your admin session. You'll need to re-authenticate to return to the command center."
        confirmLabel="Shut down"
        cancelLabel="Stay active"
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </aside>
  );
}
