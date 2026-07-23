"use client";

import { Sparkles, MapPin } from "lucide-react";

/** Founder quote card paired with the company location card. */
export function FounderLocationSection() {
  return (
    <section className="relative px-6 py-16 z-10">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

        {/* LEFT: FOUNDER CARD (Cols 1-7) */}
        <div className="lg:col-span-7 flex flex-col justify-between p-8 rounded-[32px] border relative overflow-hidden bg-gradient-to-tr from-slate-950 via-slate-900 to-purple-950/20 text-white shadow-[0_0_30px_rgba(168,85,247,0.08)] border-white/5">
          <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {/* Simulated Startup Founder futuristic photo avatar frame */}
              <div className="w-16 h-16 rounded-2xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-650 via-slate-900 to-cyan-500 p-0.5 shadow-lg flex items-center justify-center overflow-hidden relative group">
                <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center font-black text-[8px] tracking-wider text-purple-300">
                  SIVAMARAN J
                </div>
                {/* Glowing micro visual */}
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400/20 to-purple-500/20 group-hover:opacity-0 transition-opacity" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-white">Sivamaran J</h3>
                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">Founder & Chief Architect</span>
              </div>
            </div>

            <blockquote className="text-sm font-semibold italic text-slate-300 leading-relaxed border-l-2 border-purple-500/50 pl-4 py-1">
              &quot;Founded by Sivamaran J, Aegis AI was created to redefine insurance consultation through conversational artificial intelligence and intelligent automation systems. We believe protection should be intuitive, highly secure, and emotionally intelligent.&quot;
            </blockquote>
          </div>

          <div className="pt-8 border-t border-white/5 flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Our Founding Vision</span>
          </div>
        </div>

        {/* RIGHT: LOCATION CARD (Cols 8-12) */}
        <div className="lg:col-span-5 flex flex-col justify-between p-8 rounded-[32px] border relative overflow-hidden bg-gradient-to-tr from-slate-950 via-slate-900 to-cyan-950/20 text-white shadow-[0_0_30px_rgba(6,182,212,0.08)] border-white/5">
          <div className="absolute -right-12 -top-12 w-28 h-28 rounded-full bg-cyan-500/10 blur-xl pointer-events-none" />

          <div className="space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
              <MapPin className="w-6 h-6 animate-bounce" />
            </div>
            <div className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Where We Are</span>
              <h3 className="text-xl font-black text-white">Salem, Tamil Nadu</h3>
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest block">India</span>
            </div>
          </div>

          {/* Glowing Map SVG Visual Representation */}
          <div className="h-24 w-full border border-white/5 rounded-2xl bg-white/[0.02] relative overflow-hidden flex items-center justify-center p-2">
            {/* Spinning grid map mesh */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:10px_10px]" />
            <div className="absolute w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-ping" />
            <div className="absolute w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />

            <span className="absolute bottom-2 right-3 text-[8.5px] font-mono text-slate-600 font-black uppercase tracking-wider">
              Salem, India
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
