"use client";

import { Search } from "lucide-react";

interface Hospital {
  name: string;
  city: string;
  rating: string;
  category: string;
}

interface NetworkTabProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredHospitals: Hospital[];
}

/** Tab 2 — cashless network search and hospital cards. */
export function NetworkTab({ searchQuery, setSearchQuery, filteredHospitals }: NetworkTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-cyan-400 animate-pulse" />
          <span>Cashless Network Care Centers</span>
        </h2>
        <p className="text-xs text-slate-400 font-semibold mt-1">
          Verify local empanelled hospitals, nursing clinics, and cashless recovery centers closest to you.
        </p>
      </div>

      {/* Search panel */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search hospital name, city coordinates, or category specialty..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-950/60 border border-white/5 focus:border-cyan-500/40 rounded-2xl py-3.5 pl-11 pr-5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500/25 placeholder-slate-500 transition-all text-white"
        />
      </div>

      {/* Hospital cards */}
      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2" style={{ scrollbarWidth: "none" }}>
        {filteredHospitals.length > 0 ? (
          filteredHospitals.map((h, i) => (
            <div key={i} className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/25 flex justify-between items-center transition-colors">
              <div className="text-left space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider bg-slate-950 text-cyan-400 px-2 py-0.5 rounded border border-white/5">{h.category}</span>
                <h4 className="text-xs font-black text-white">{h.name}</h4>
                <p className="text-[10px] text-slate-450 font-bold">{h.city} coordinates</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-amber-400">★ {h.rating}</span>
                <span className="block text-[9px] text-emerald-400 font-black uppercase tracking-widest mt-1">100% Cashless</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-slate-500 text-xs font-semibold">
            No empanelled network centers match your query parameters.
          </div>
        )}
      </div>
    </div>
  );
}
