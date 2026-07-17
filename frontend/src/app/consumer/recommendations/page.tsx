"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Heart, Car, Sparkles, ArrowLeft, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";

export default function ConsumerRecommendationsPage() {
  const { loading, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-purple-650 border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  const wrapperClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />

      <section className="relative pt-36 pb-24 flex-grow flex items-center justify-center z-10 text-left">
        <div className="max-w-4xl w-full mx-auto px-6">
          <button 
            onClick={() => router.push("/consumer-dashboard")}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-purple-400 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>

          <div className="space-y-8">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 text-purple-400 bg-purple-950/30 border border-purple-800/40 py-1 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Personalized Audit Vault</span>
              </span>
              <h2 className="text-3xl font-black text-white">Dynamic AI Coverage Vault</h2>
              <p className="text-xs text-slate-400 font-semibold max-w-lg">
                These dynamic policy suggestions are coordinated automatically based on your conversation audits. Talk with Aegis to lock in premium limits.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: "Aegis Supreme Health Shield", desc: "Premium ₹1 Crore cashless coverage locked with rate guarantee up to 2027.", premium: "₹850 / month", icon: <Heart className="text-rose-450" /> },
                { title: "Aegis Smart Auto Shield", desc: "Complete zero-depreciation security with direct cashless allocations.", premium: "₹450 / month", icon: <Car className="text-cyan-450" /> }
              ].map((rec, idx) => (
                <div key={idx} className="p-6 bg-slate-900/60 border border-white/5 rounded-3xl flex flex-col justify-between gap-6 hover:border-purple-500/25 transition-all group">
                  <div className="space-y-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-950/50 text-purple-400 border border-purple-800/30 flex items-center justify-center">
                      {rec.icon}
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white group-hover:text-purple-400 transition-colors leading-tight">{rec.title}</h4>
                      <p className="text-[11.5px] text-slate-450 mt-1 font-semibold leading-relaxed">{rec.desc}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Premium</span>
                      <span className="text-sm font-black text-purple-400 block">{rec.premium}</span>
                    </div>
                    <button 
                      onClick={() => router.push("/consumer-dashboard")}
                      className="w-8 h-8 rounded-lg bg-purple-650 text-white flex items-center justify-center hover:bg-purple-650 transition-all border border-purple-500/25"
                    >
                      <ArrowRight className="w-4 h-4" />
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
