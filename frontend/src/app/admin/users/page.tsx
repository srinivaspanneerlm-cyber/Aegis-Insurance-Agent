"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Users, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AdminUsersPage() {
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
        <div className="max-w-3xl w-full mx-auto px-6">
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
                <Users className="w-3.5 h-3.5" />
                <span>Security Operators Ledger</span>
              </span>
              <h2 className="text-3xl font-black text-white">Identity Registry Ledger</h2>
              <p className="text-xs text-slate-400 font-semibold max-w-lg">
                Directory of active risk controllers and underwriting managers authorized with master keyring signatures.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/60 backdrop-blur-xl">
              <div className="p-6 bg-slate-950/80 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Active Keys</span>
                <span className="text-[9px] text-cyan-400 font-black uppercase bg-cyan-950/50 border border-cyan-800/30 px-2 py-0.5 rounded">Secure Node</span>
              </div>
              <div className="divide-y divide-white/5 p-6 space-y-4">
                {[
                  { name: "Sivamaran J", email: "sivamaran@aegis.com", role: "Superadmin / Chief Operations Officer" },
                  { name: "Aegis AI Auditor", email: "auditor-01@aegis.com", role: "Autonomous Underwriting Intelligence" },
                  { name: user?.name || "Premium Officer", email: user?.email || "officer@aegis.com", role: "Active Security Controller" }
                ].map((op, idx) => (
                  <div key={idx} className="pt-4 first:pt-0 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-white">{op.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-semibold">{op.email}</p>
                    </div>
                    <span className="text-[9.5px] bg-cyan-950/40 text-cyan-300 border border-cyan-800/30 font-black uppercase tracking-wider py-1 px-3 rounded-full">
                      {op.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
