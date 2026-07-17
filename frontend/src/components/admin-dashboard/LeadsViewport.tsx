"use client";

import { motion } from "framer-motion";
import type { Lead } from "@/types/domain";

interface LeadsViewportProps {
  leads: Lead[];
  handleApproveLead: (leadId: string) => void;
}

/** Underwriting Leads Matrix table with approval action (nav: "leads"). */
export function LeadsViewport({ leads, handleApproveLead }: LeadsViewportProps) {
  return (
    <motion.div
      key="leads"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="bg-slate-900/60 border border-cyan-500/20 rounded-[32px] p-6 sm:p-8 space-y-6"
    >
      <div className="border-b border-white/5 pb-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="font-extrabold text-white text-base">Underwriting Leads Matrix</h3>
          <p className="text-xs text-slate-400 mt-1 font-semibold">Active consumer-consulted package pipelines waiting approval lockers.</p>
        </div>
        <span className="text-[10px] bg-cyan-950/50 text-cyan-300 border border-cyan-800/40 py-1 px-3 rounded-full font-black uppercase tracking-widest">
          Record count: {leads.length}
        </span>
      </div>

      {/* Leads Ledger Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/80">
        <table className="w-full border-collapse text-left text-xs text-slate-300">
          <thead className="bg-slate-900 border-b border-white/5 text-[9px] text-slate-500 font-black uppercase tracking-widest">
            <tr>
              <th className="p-4.5">Customer Name</th>
              <th className="p-4.5">Contact Point</th>
              <th className="p-4.5">Target Coverage Plan</th>
              <th className="p-4.5">Budget Cap</th>
              <th className="p-4.5">Vault Status</th>
              <th className="p-4.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-semibold">
            {leads.map((l, idx) => (
              <tr key={l.id || idx} className="hover:bg-white/[0.01] transition-all">
                <td className="p-4.5 text-white font-black">{l.customerName}</td>
                <td className="p-4.5">
                  <p className="leading-none text-white">{l.email}</p>
                  <p className="text-[9.5px] text-slate-550 mt-1">{l.phone}</p>
                </td>
                <td className="p-4.5 text-cyan-300">{l.insuranceType}</td>
                <td className="p-4.5">{l.budget}</td>
                <td className="p-4.5">
                  <span className={`inline-block py-0.5 px-2 rounded-full text-[8.5px] font-black uppercase tracking-wider border ${
                    l.status === "Approved"
                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
                      : "bg-cyan-955/40 text-cyan-400 border-cyan-800/40 animate-pulse"
                  }`}>
                    {l.status}
                  </span>
                </td>
                <td className="p-4.5 text-right">
                  {l.status !== "Approved" && (
                    <button
                      onClick={() => handleApproveLead(l.id)}
                      className="py-1 px-3 bg-cyan-500 text-slate-950 rounded-lg hover:bg-cyan-400 transition-all font-black text-[9px] uppercase tracking-widest cursor-pointer"
                    >
                      Approve Lock
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
