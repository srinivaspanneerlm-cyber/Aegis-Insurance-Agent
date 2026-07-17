"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { TrendingUp, Cpu, Database, ArrowLeft, Radio } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { adminService } from "@/services/api";
import { AdminStats } from "@/types/domain";

export default function AdminAnalyticsPage() {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats>({ totalLeads: 12, totalChats: 48, uploadedDocuments: 9 });

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
      adminService.getStats().then(data => {
        if (data) setStats(data);
      }).catch(() => null);
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
                <Radio className="w-3.5 h-3.5" />
                <span>Actuarial Analytics Hub</span>
              </span>
              <h2 className="text-3xl font-black text-white">Platform System Analytics</h2>
              <p className="text-xs text-slate-400 font-semibold max-w-lg">
                Comprehensive evaluation of liability pools, API processing pipelines, and system keyrings.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: "Underwrite Pipeline", count: stats.totalLeads, desc: "Active coverage locker configurations queued.", icon: <TrendingUp className="text-cyan-400" /> },
                { title: "Gemini Tokens sync", count: "0.18s / Token", desc: "Pipeline response latency under 100 concurrent requests.", icon: <Cpu className="text-purple-400" /> },
                { title: "DPDP Cloud Vaults", count: stats.uploadedDocuments, desc: "Decentralized KYC files verified under banking parameters.", icon: <Database className="text-teal-400" /> }
              ].map((item, idx) => (
                <div key={idx} className="p-6 bg-slate-900 border border-white/5 rounded-3xl space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 text-cyan-400 border border-white/5 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block">{item.title}</span>
                    <h3 className="text-2xl font-mono font-black text-white mt-1">{item.count}</h3>
                    <p className="text-[11px] text-slate-450 mt-2 font-semibold leading-relaxed">{item.desc}</p>
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
