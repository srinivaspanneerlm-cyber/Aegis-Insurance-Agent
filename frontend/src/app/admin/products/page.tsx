"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ShieldCheck, Database, ArrowLeft, Sliders, Play, Plus } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AdminProductsPage() {
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 py-1 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <Database className="w-3.5 h-3.5" />
                  <span>Coverage Catalog Control</span>
                </span>
                <h2 className="text-3xl font-black text-white">Underwriting Products</h2>
                <p className="text-xs text-slate-400 font-semibold max-w-lg">
                  Deploy or update insurance baseline limits conversationally coordinated by AI advisors.
                </p>
              </div>

              <button className="py-3 px-5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl transition-all font-black text-xs uppercase tracking-widest flex items-center gap-1.5 cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.15)] self-start sm:self-center">
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Deploy New Package</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { name: "Aegis Supreme Health Shield", code: "AEG-HLT-01", type: "Health Underwriting", premium: "₹850 / month" },
                { name: "Aegis Smart Auto Shield", code: "AEG-AUT-02", type: "Vehicle Recovery", premium: "₹450 / month" }
              ].map((p, idx) => (
                <div key={idx} className="p-6 bg-slate-900 border border-white/5 rounded-3xl flex flex-col justify-between gap-6 hover:border-cyan-500/25 transition-all group">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-cyan-400 font-extrabold font-mono">{p.code}</span>
                      <span className="bg-cyan-950/40 text-cyan-300 border border-cyan-800/30 font-bold py-1 px-3 rounded-full text-[9px] uppercase tracking-wider">
                        {p.type}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-white group-hover:text-cyan-400 transition-colors leading-tight">{p.name}</h4>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Baseline Rate</span>
                      <span className="text-xs font-black text-white block">{p.premium}</span>
                    </div>
                    <button className="py-2 px-4 bg-slate-950 border border-white/5 hover:border-cyan-500/30 rounded-xl text-slate-400 hover:text-cyan-400 font-black text-[9px] uppercase tracking-widest cursor-pointer transition-all">
                      Configure Limits
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
