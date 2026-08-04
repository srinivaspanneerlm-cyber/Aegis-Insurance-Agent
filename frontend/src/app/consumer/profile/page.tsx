"use client";

import { useRouter } from "next/navigation";
import { User, Mail, Database, ArrowLeft, Key } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function ConsumerProfilePage() {
  const { user, isReady } = useRequireAuth();

  const router = useRouter();

  if (!isReady || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <Navbar />
        <main id="main-content">
        <div className="flex-grow flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-purple-650 border-t-transparent rounded-full animate-spin" />
        </div>
        </main>
        <Footer />
      </div>
    );
  }

  const wrapperClass = "bg-surface text-content";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />
      <main id="main-content">

      <section className="relative pt-36 pb-24 flex-grow flex items-center justify-center z-10">
        <div className="max-w-xl w-full mx-auto px-6">
          <button 
            onClick={() => router.push("/consumer-dashboard")}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-purple-400 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>

          <div className="p-8 sm:p-10 rounded-[32px] border bg-slate-900/60 border-white/5 backdrop-blur-xl shadow-2xl relative text-left">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500" />

            <div className="flex items-center gap-4 border-b border-white/5 pb-6 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-purple-950 text-purple-400 border border-purple-800/30 flex items-center justify-center">
                <User className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">{user.name}</h2>
                <p className="text-[9.5px] text-cyan-400 font-extrabold uppercase tracking-widest mt-1">Verified Account</p>
              </div>
            </div>

            <div className="space-y-6 text-slate-300">
              <div className="space-y-2">
                <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Email</label>
                <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex items-center gap-3">
                  <Mail className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">{user.email}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] text-slate-550 font-black uppercase tracking-widest block">ECDSA Vault Key Hash</label>
                <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex items-center gap-3 font-mono text-[10px] text-cyan-300">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <span>0x7f9a...bc42 (DPDP verified)</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] text-slate-555 font-black uppercase tracking-widest block">Ecosystem Status</label>
                <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex items-center gap-3">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">Direct Client Layer Seeded</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}
