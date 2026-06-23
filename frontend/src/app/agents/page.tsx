"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Search, User, Star, Shield, Users, ShieldCheck, 
  ArrowRight, Phone, MessageSquare, Briefcase, Award, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";

interface Agent {
  id: string;
  name: string;
  role: string;
  specialization: "Health" | "Motor" | "Travel" | "Property";
  rating: number;
  familiesGuided: string;
  experience: number;
  avatar: string;
  badge: string;
  skills: string[];
}

export default function AgentsPage() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"All" | "Health" | "Motor" | "Travel" | "Property">("All");

  const agents: Agent[] = [
    {
      id: "sarah",
      name: "Sarah Johnson",
      role: "Senior Health Insurance Advisor",
      specialization: "Health",
      rating: 4.9,
      familiesGuided: "10,000+ Families Guided",
      experience: 12,
      avatar: "👩‍💼",
      badge: "AI-Assisted Protection Expert",
      skills: ["Critical Illness Shield", "Family Floater Optimization", "Maternity Cover Expert"]
    },
    {
      id: "alex",
      name: "Alex Mercer",
      role: "Elite Motor Coverage Specialist",
      specialization: "Motor",
      rating: 4.8,
      familiesGuided: "8,500+ Vehicles Guided",
      experience: 8,
      avatar: "👨‍💼",
      badge: "AI Premium Audit Specialist",
      skills: ["Commercial Fleet Matrix", "Zero-Depreciation Cover", "EV Battery Risk Audit"]
    },
    {
      id: "ethan",
      name: "Ethan Miller",
      role: "Global Travel Risk Assessor",
      specialization: "Travel",
      rating: 4.9,
      familiesGuided: "6,200+ Travelers Shielded",
      experience: 10,
      avatar: "👨‍✈️",
      badge: "AI Route Risk Specialist",
      skills: ["Global Emergency Evacuation", "Expat Health Portfolios", "Multi-Trip Coverages"]
    },
    {
      id: "emma",
      name: "Emma Watson",
      role: "Premier Property Asset Guard",
      specialization: "Property",
      rating: 4.7,
      familiesGuided: "4,500+ Properties Insured",
      experience: 7,
      avatar: "👩‍🔬",
      badge: "AI Asset Protection Master",
      skills: ["Home Structure Auditing", "Tenant Liability Cover", "Natural Disaster Shields"]
    }
  ];

  // Filtering logic
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          agent.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          agent.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = activeFilter === "All" || agent.specialization === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const wrapperClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";
  const headerBgClass = theme === "dark" ? "bg-slate-900/60 border-white/5" : "bg-white border-slate-200 shadow-sm";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />

      {/* Futuristic animated glowing backgrounds */}
      {theme === "dark" && (
        <>
          <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-650/10 blur-[130px] pointer-events-none" />
          <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
        </>
      )}

      {/* MAIN CONTAINER */}
      <section className="relative pt-44 pb-24 z-10 flex-grow">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Page Heading */}
          <div className="text-center mb-16 space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full py-1.5 px-4 inline-block">
              Aegis Global Officer Directory
            </span>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">
              Consult Our Professional <br/>
              <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                AI-Assisted Human Agents
              </span>
            </h1>
            <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
              Combine human strategic thinking with lightning-fast AI risk calculations. Get expert audits on health, motor, and property coverages in real-time.
            </p>
          </div>

          {/* Interactive Search & Filter Controls (LinkedIn + SaaS design) */}
          <div className={`p-5 rounded-[24px] border mb-10 flex flex-col md:flex-row items-center justify-between gap-5 transition-all ${headerBgClass}`}>
            
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agent, role or skill..."
                className={`w-full py-2.5 pl-10 pr-4 rounded-xl text-xs font-semibold outline-none border transition-all ${
                  theme === "dark" 
                    ? "bg-white/[0.04] border-white/10 text-white placeholder-slate-400 focus:bg-slate-900 focus:border-purple-400" 
                    : "bg-slate-100 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-purple-650"
                }`}
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {(["All", "Health", "Motor", "Travel", "Property"] as const).map((spec) => (
                <button
                  key={spec}
                  onClick={() => setActiveFilter(spec)}
                  className={`py-2 px-4 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeFilter === spec
                      ? "bg-gradient-to-r from-purple-600 to-indigo-650 text-white shadow-md border border-purple-500/20"
                      : theme === "dark"
                      ? "bg-white/[0.03] border-white/5 text-slate-400 hover:text-white"
                      : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {spec} Experts
                </button>
              ))}
            </div>

          </div>

          {/* AGENTS LISTING GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredAgents.map((agent) => (
                <motion.div
                  key={agent.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.4 }}
                  className={`p-6 rounded-[28px] border flex flex-col justify-between text-left transition-all relative overflow-hidden group ${
                    theme === "dark"
                      ? "bg-slate-900/40 border-white/5 shadow-2xl hover:border-purple-500/30"
                      : "bg-white border-slate-200 shadow-premium hover:shadow-premium-hover hover:border-purple-400"
                  }`}
                >
                  
                  {/* Glowing light bars on card corners */}
                  <div className="absolute top-0 left-0 w-8 h-[2px] bg-gradient-to-r from-purple-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-0 left-0 w-[2px] h-8 bg-gradient-to-b from-purple-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div>
                    {/* Top row: Agent avatar & Rating */}
                    <div className="flex items-center justify-between mb-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border ${
                        theme === "dark" ? "bg-white/5 border-white/10" : "bg-purple-50 border-purple-100"
                      }`}>
                        {agent.avatar}
                      </div>

                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className={`text-xs font-black ${theme === "dark" ? "text-white" : "text-navy-900"}`}>{agent.rating}</span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">{agent.experience} yrs exp</span>
                      </div>
                    </div>

                    {/* Badge and Name */}
                    <div className="space-y-1 mb-4">
                      <div className="flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full w-max">
                        <Shield className="w-3 h-3 text-purple-400" />
                        <span>{agent.badge}</span>
                      </div>

                      <h3 className={`text-base font-black tracking-tight ${theme === "dark" ? "text-white" : "text-navy-900"}`}>
                        {agent.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-bold uppercase">
                        {agent.role}
                      </p>
                    </div>

                    {/* Families guided */}
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mb-5">
                      <Users className="w-4 h-4 text-cyan-400" />
                      <span>{agent.familiesGuided}</span>
                    </div>

                    {/* Skill Tags */}
                    <div className="space-y-2 mb-6">
                      <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Underwriting Specializations</span>
                      <div className="flex flex-wrap gap-1.5">
                        {agent.skills.map((skill, index) => (
                          <span 
                            key={index}
                            className={`text-[8.5px] font-semibold px-2 py-1 rounded-md border ${
                              theme === "dark" 
                                ? "bg-white/[0.02] border-white/5 text-slate-300" 
                                : "bg-slate-50 border-slate-200 text-slate-700"
                            }`}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Consultation Trigger Footer */}
                  <div className="pt-4 border-t border-white/5 flex items-center justify-between mt-auto">
                    {/* Live status badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider">Available</span>
                    </div>

                    <Link
                      href={`/apply?advisor=${encodeURIComponent(agent.name)}`}
                      className={`flex items-center gap-1 text-[10.5px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                        theme === "dark" ? "text-cyan-400 hover:text-cyan-300" : "text-purple-600 hover:text-purple-700"
                      }`}
                    >
                      <span>Consult</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                </motion.div>
              ))}
            </AnimatePresence>

            {filteredAgents.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-500 font-semibold">
                No matching Aegis officers found. Expand search constraints.
              </div>
            )}
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
