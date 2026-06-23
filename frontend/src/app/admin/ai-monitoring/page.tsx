"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ShieldCheck, Cpu, ArrowLeft, Terminal, Radio } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AdminAiMonitoringPage() {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/admin-login");
        return;
      }
      if (!isAdmin) {
        router.push("/admin-dashboard");
        return;
      }
    }
  }, [loading, isAuthenticated, isAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white relative flex flex-col justify-between overflow-hidden">
      <Navbar />

      <section className="relative pt-36 pb-24 flex-grow flex items-center justify-center z-10 text-left">
        <div className="max-w-4xl w-full mx-auto px-6">
          <button 
            onClick={() => router.push("/admin-dashboard")}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-cyan-400 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>

          <div className="space-y-8">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 py-1 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5" />
                <span>Gemini API Pipeline</span>
              </span>
              <h2 className="text-3xl font-black text-white">AI Engine Pipeline</h2>
              <p className="text-xs text-slate-400 font-semibold max-w-lg">
                Autonomous logs monitoring prompt performance coefficient and emotional AI advisory indexes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-900 border border-white/5 rounded-3xl space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Active Prompt Directives</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                  Underwriter guidelines seed strict instructions: Empathetic posture, zero price tables on initialization, and dynamic fallback security lockers.
                </p>
              </div>

              <div className="p-6 bg-slate-900 border border-white/5 rounded-3xl space-y-4 text-left">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Token telemetries</h4>
                <div className="space-y-2 font-mono text-[10.5px]">
                  <div className="flex items-center justify-between text-slate-450">
                    <span>Baseline Ping:</span>
                    <span className="text-cyan-400 font-bold">48ms</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-450">
                    <span>Evaluation Accuracy:</span>
                    <span className="text-emerald-450 font-bold">99.8%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
