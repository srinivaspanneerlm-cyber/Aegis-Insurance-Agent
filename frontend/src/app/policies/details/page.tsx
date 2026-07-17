"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  ArrowLeft, ShieldCheck, Heart, Car, Plane, Home as HomeIcon,
  Calculator, Search, ShieldAlert, Award, CheckCircle, Scale,
  Signature, Clock, ChevronRight, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { STORAGE_KEYS } from "@/lib/storage-keys";

// Interface representing the selected plan structure
interface PlanDetails {
  planName: string;
  coverage: string;
  premium: string;
  benefits: string[];
  claimSettlementRatio?: string;
  riskLevel?: string;
  score?: number;
  confidenceScore?: number;
  executiveApproval?: string;
  exclusions?: string[];
  waitingPeriod?: string;
  claimProcess?: string;
  hospitalNetwork?: string;
  premiumBreakdown?: string;
  executiveNotes?: string;
  alternativePlan?: PlanDetails;
  category?: string;
  idvValue?: string;
  ownDamageCover?: string;
  thirdPartyCover?: string;
  zeroDep?: string;
  roadsideAssistance?: string;
  engineProtection?: string;
  destination?: string;
  medicalCoverage?: string;
  tripCancellation?: string;
  baggageLoss?: string;
  emergencyEvacuation?: string;
  propertyCoverage?: string;
  fireProtection?: string;
  naturalDisasterCover?: string;
  theftCover?: string;
  structureCover?: string;
  contentsCover?: string;
}

/** The selectable detail tabs on the policy details page. */
type DetailTab = "benefits" | "network" | "exclusions" | "compare";

// Mock cashless hospitals/service network
const MOCK_HOSPITALS = [
  { name: "Apollo Proton Cancer Centre", city: "Chennai", rating: "4.9", category: "Super Specialty" },
  { name: "Fortis Escorts Heart Institute", city: "New Delhi", rating: "4.8", category: "Cardiology Center" },
  { name: "Manipal Hospital Whitefield", city: "Bengaluru", rating: "4.8", category: "Multispecialty" },
  { name: "Medanta The Medicity", city: "Gurugram", rating: "4.9", category: "Integrated Care" },
  { name: "Tata Memorial Hospital", city: "Mumbai", rating: "4.7", category: "Oncology Special" },
  { name: "Max Super Specialty Hospital", city: "Noida", rating: "4.6", category: "Multispecialty" },
  { name: "Lilavati Hospital & Research Centre", city: "Mumbai", rating: "4.8", category: "Research & Care" }
];

function PolicyDetailsContent() {
  const searchParams = useSearchParams();
  const isCompareDefault = searchParams.get("compare") === "true";
  
  const [activeTab, setActiveTab] = useState<DetailTab>("benefits");
  const [plan, setPlan] = useState<PlanDetails | null>(null);
  
  // Interactive Premium Calculator states
  const [basePremium, setBasePremium] = useState<number>(850);
  const [selectedRiders] = useState<{ id: string; label: string; cost: number }[]>([
    { id: "critical", label: "Critical Illness Shield Option", cost: 120 },
    { id: "accidental", label: "Accidental Recovery Supplement", cost: 80 }
  ]);
  const [activeRiderIds, setActiveRiderIds] = useState<string[]>(["critical"]);

  // Cashless network search state
  const [searchQuery, setSearchQuery] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    if (isCompareDefault) {
      setActiveTab("compare");
    }
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_PLAN);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPlan(parsed);
        // Extract numeric premium for calculator if possible
        const premStr = parsed.premium || "";
        const match = premStr.match(/\d+/);
        if (match) {
          setBasePremium(parseInt(match[0], 10));
        }
      } catch (err) {
        console.error("Failed to parse stored plan details", err);
      }
    } else {
      // Fallback default details if none saved yet
      setPlan({
        planName: "Aegis Supreme Health Shield",
        coverage: "₹1 Crore Cover",
        premium: "₹850/month",
        benefits: ["Unlimited Cashless network beds", "Day-1 Pre-Existing Illness Cover", "Zero Co-Pay Required", "No Room Rent sublimits"],
        claimSettlementRatio: "99.1%",
        riskLevel: "Low Risk",
        score: 98,
        confidenceScore: 0.98,
        executiveApproval: "Approved - All family health checks, age brackets, and budget constraints fully validated.",
        exclusions: ["Cosmetic surgery", "Self-inflicted injuries", "Experimental therapies"],
        waitingPeriod: "12 months for pre-existing diseases, 30 days initial waiting period.",
        claimProcess: "1. Intimate claim at desk. 2. Submit cashless digital health card. 3. Direct billing settlement in 15 mins.",
        hospitalNetwork: "12,000+ Empanelled Cashless Care Centers",
        premiumBreakdown: "Base Premium: ₹720, GST (18%): ₹130",
        executiveNotes: "Underwritten under premium guidelines. Optimized for growing households.",
        alternativePlan: {
          planName: "Aegis Care Silver Floater",
          coverage: "₹8 Lakh Cover",
          premium: "₹1800/month",
          benefits: ["Day Care Procedures", "Cashless Hospitalization", "Restore Benefit"],
          claimSettlementRatio: "98.4%",
          riskLevel: "Low Risk",
          score: 85,
          confidenceScore: 0.92,
          executiveApproval: "Approved - Secondary lower coverage tier.",
          exclusions: ["Global coverage benefits"],
          waitingPeriod: "24 months for pre-existing diseases.",
          claimProcess: "Cashless approval within 4 hours.",
          hospitalNetwork: "8,500+ cashless hospitals",
          premiumBreakdown: "Base Premium: ₹1600, GST: ₹200",
          executiveNotes: "Alternative choice for smaller budget limits."
        }
      });
    }
  }, [isCompareDefault]);

  if (!plan) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Calculator calculations
  const subtotal = basePremium + selectedRiders
    .filter(r => activeRiderIds.includes(r.id))
    .reduce((sum, r) => sum + r.cost, 0);
  const gst = Math.round(subtotal * 0.18);
  const totalPremium = subtotal + gst;

  // Filter cashless hospitals/networks
  const filteredHospitals = MOCK_HOSPITALS.filter(h => 
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Bot router map for CTA
  const handleProceed = () => {
    const botMap: Record<string, string> = {
      "motor": "Alex",
      "bumper": "Alex",
      "drive": "Alex",
      "travel": "Ethan",
      "nomad": "Ethan",
      "voyage": "Ethan",
      "property": "Emma",
      "fortress": "Emma",
      "home": "Emma",
      "cyber": "Emma",
      "paws": "Emma",
      "health": "Sarah"
    };
    const planName = plan.planName.toLowerCase();
    let bot = "Sarah";
    for (const [key, value] of Object.entries(botMap)) {
      if (planName.includes(key)) {
        bot = value;
        break;
      }
    }
    window.location.href = `/advisor?bot=${bot}&selectPlan=${encodeURIComponent(plan.planName)}`;
  };

  const toggleRider = (id: string) => {
    setActiveRiderIds(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  // Determine category icon
  const getCategoryIcon = () => {
    const name = plan.planName.toLowerCase();
    const cat = (plan.category || "").toLowerCase();
    if (cat === "motor" || name.includes("motor") || name.includes("drive") || name.includes("car") || name.includes("wheeler")) return <Car className="w-8 h-8 text-blue-400" />;
    if (cat === "travel" || name.includes("global") || name.includes("voyage") || name.includes("nomad") || name.includes("travel") || name.includes("trip")) return <Plane className="w-8 h-8 text-amber-400" />;
    if (cat === "property" || name.includes("home") || name.includes("fortress") || name.includes("brick") || name.includes("property")) return <HomeIcon className="w-8 h-8 text-emerald-400" />;
    return <Heart className="w-8 h-8 text-purple-400" />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white relative flex flex-col justify-between overflow-x-hidden">
      <Navbar />

      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.08),rgba(255,255,255,0))]" />
      <div className="absolute top-[25%] left-[-15%] w-[60%] h-[60%] rounded-full bg-cyan-500/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-15%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[130px] pointer-events-none" />

      {/* Main Container */}
      <main className="relative z-10 pt-28 pb-20 flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="space-y-8">
          
          {/* Back button */}
          <div className="flex items-center gap-2">
            <Link 
              href="/policies" 
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Policy Vaults</span>
            </Link>
          </div>

          {/* Underwriter Header Hero Card */}
          <div className="rounded-[36px] bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-white/5 p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-4 text-left">
              <div className="w-16 h-16 rounded-[22px] bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                {getCategoryIcon()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Aegis Premium
                  </span>
                  <span className="flex items-center gap-1 text-[9px] font-mono font-black uppercase bg-emerald-500/15 text-emerald-400 py-0.5 px-2 rounded-full border border-emerald-500/20">
                    <Award className="w-2.5 h-2.5" />
                    {plan.score || 98}% Match Score
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 leading-tight">{plan.planName}</h1>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Coverage Boundary: <span className="text-white font-extrabold">{plan.coverage}</span></p>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-stretch sm:items-center">
              <div className="text-left sm:text-right bg-slate-950/40 px-5 py-3 rounded-2xl border border-white/5">
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Calibrated Premium</span>
                <span className="text-xl font-black text-cyan-400 font-mono">{plan.premium}</span>
                <span className="text-[10px] text-slate-400 font-medium block">All-inclusive projection</span>
              </div>
              <button
                onClick={handleProceed}
                className="py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-350 hover:to-cyan-455 text-slate-950 flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:scale-[1.01] active:scale-95 touch-manipulation select-none cursor-pointer border border-cyan-300/20"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Lock & Transmit Plan</span>
              </button>
            </div>
          </div>

          {/* Premium Tab Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Sidebar navigation */}
            <div className="lg:col-span-1 space-y-2.5">
              {[
                { id: "benefits", label: "Benefits & Premium Calculator", icon: <Calculator className="w-4.5 h-4.5" /> },
                { id: "network", label: "Cashless Network Finder", icon: <Search className="w-4.5 h-4.5" /> },
                { id: "exclusions", label: "Exclusions & CRO Sign-off", icon: <ShieldAlert className="w-4.5 h-4.5" /> },
                { id: "compare", label: "Interactive Compare View", icon: <Scale className="w-4.5 h-4.5" /> }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as DetailTab)}
                  className={`w-full p-4 rounded-2xl flex items-center gap-3.5 text-xs font-black uppercase tracking-widest border transition-all text-left cursor-pointer active:scale-98 ${
                    activeTab === t.id 
                      ? "bg-cyan-500/10 border-cyan-500/35 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                      : "bg-slate-900/40 border-white/5 text-slate-400 hover:bg-white/[0.02] hover:text-white"
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Dynamic Content Panel */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-[32px] bg-slate-900/30 border border-white/5 p-6 sm:p-8 text-left space-y-8"
                >
                  
                  {/* Tab 1: Benefits & Premium Calculator */}
                  {activeTab === "benefits" && (
                    <div className="space-y-8">
                      <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                          <Calculator className="w-5 h-5 text-cyan-400 animate-pulse" />
                          <span>Interactive Coverage Configurator</span>
                        </h2>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                          Review standard coverage benefits and select optional riders to calculate your premium rate under 18% GST regulations.
                        </p>
                      </div>

                      {/* Benefits Section */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Included Underwriter Benefits</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {plan.benefits.map((b, i) => (
                            <div key={i} className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-900/60 border border-white/5 text-xs text-slate-200">
                              <CheckCircle className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                              <span className="font-semibold leading-relaxed">{b}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Category Specific Metrics in Details Tab */}
                      {plan.category && plan.category !== "health" && (
                        <div className="p-5 rounded-3xl bg-slate-950/60 border border-white/5 space-y-4 text-left">
                          <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">Domain-Specific Parameters</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-semibold text-slate-350">
                            {plan.category === "motor" && (
                              <>
                                <div>
                                  <p className="text-[9px] text-slate-500 uppercase font-black">Insured Declared Value (IDV)</p>
                                  <p className="text-white font-mono mt-0.5">{plan.idvValue || "₹8,50,000"}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-slate-500 uppercase font-black">Own Damage Cover</p>
                                  <p className="text-white mt-0.5">{plan.ownDamageCover || "₹12,500/year"}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-slate-500 uppercase font-black">Third Party Cover</p>
                                  <p className="text-white mt-0.5">{plan.thirdPartyCover || "₹3,500/year"}</p>
                                </div>
                              </>
                            )}
                            {plan.category === "travel" && (
                              <>
                                <div>
                                  <p className="text-[9px] text-slate-500 uppercase font-black">Destination</p>
                                  <p className="text-white mt-0.5">{plan.destination || "International"}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-slate-500 uppercase font-black">Medical Coverage</p>
                                  <p className="text-white font-mono mt-0.5">{plan.medicalCoverage || "$100,000"}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-slate-500 uppercase font-black">Emergency Evacuation</p>
                                  <p className="text-white font-mono mt-0.5">{plan.emergencyEvacuation || "$50,000"}</p>
                                </div>
                              </>
                            )}
                            {plan.category === "property" && (
                              <>
                                <div>
                                  <p className="text-[9px] text-slate-500 uppercase font-black">Property Coverage</p>
                                  <p className="text-white font-mono mt-0.5">{plan.propertyCoverage || "₹50,00,000"}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-slate-500 uppercase font-black">Structure Cover</p>
                                  <p className="text-white font-mono mt-0.5">{plan.structureCover || "₹80 Lakhs"}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-slate-500 uppercase font-black">Contents Cover</p>
                                  <p className="text-white font-mono mt-0.5">{plan.contentsCover || "₹20 Lakhs"}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Interactive Premium Calculator */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                        
                        {/* Rider selection */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Customize Policy Riders</h3>
                          <div className="space-y-2.5">
                            {selectedRiders.map((rider) => {
                              const isActive = activeRiderIds.includes(rider.id);
                              return (
                                <button
                                  key={rider.id}
                                  onClick={() => toggleRider(rider.id)}
                                  className={`w-full p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between text-left cursor-pointer ${
                                    isActive 
                                      ? "bg-cyan-500/10 border-cyan-500/35 text-white" 
                                      : "bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-900/60"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                                      isActive ? "bg-cyan-500 border-cyan-500 text-slate-950" : "border-slate-600"
                                    }`}>
                                      {isActive && <CheckCircle className="w-3.5 h-3.5 text-slate-950" />}
                                    </div>
                                    <span className="text-xs font-bold">{rider.label}</span>
                                  </div>
                                  <span className="text-xs font-black font-mono text-cyan-400">+₹{rider.cost}/mo</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Interactive Premium Projection Screen */}
                        <div className="p-5 rounded-3xl bg-slate-950/80 border-2 border-cyan-500/20 text-left flex flex-col justify-between shadow-2xl relative overflow-hidden">
                          {/* Inner grid glow */}
                          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-cyan-400/5 blur-xl pointer-events-none" />
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5 animate-bounce" />
                              <span>Live Pricing Engine</span>
                            </h4>
                            <div className="space-y-2.5 text-xs text-slate-400 font-semibold border-b border-white/5 pb-3">
                              <div className="flex justify-between">
                                <span>Base Plan Premium</span>
                                <span className="font-mono text-white">₹{basePremium}/mo</span>
                              </div>
                              {selectedRiders.filter(r => activeRiderIds.includes(r.id)).map((r) => (
                                <div key={r.id} className="flex justify-between text-cyan-300">
                                  <span>+ {r.label}</span>
                                  <span className="font-mono">₹{r.cost}/mo</span>
                                </div>
                              ))}
                              <div className="flex justify-between">
                                <span>GST (18% Regulation)</span>
                                <span className="font-mono text-white">₹{gst}/mo</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-baseline pt-2">
                              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total Premium</span>
                              <span className="text-2xl font-black text-cyan-400 font-mono">₹{totalPremium}/month</span>
                            </div>
                          </div>

                          <button
                            onClick={handleProceed}
                            className="w-full mt-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-cyan-400 text-slate-950 hover:bg-cyan-350 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-[0_5px_15px_rgba(6,182,212,0.2)]"
                          >
                            <span>Lock This Price</span>
                            <ChevronRight className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Hospital & Cashless Network Search */}
                  {activeTab === "network" && (
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
                  )}

                  {/* Tab 3: Exclusions & Underwriting Review */}
                  {activeTab === "exclusions" && (
                    <div className="space-y-8">
                      <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                          <ShieldAlert className="w-5 h-5 text-rose-400" />
                          <span>Exclusions & Underwriting Mandates</span>
                        </h2>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                          Complete transparency regarding non-covered risks and waiting criteria before formal validation checks.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Exclusions list */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4" />
                            <span>Standard Non-Covered Exclusions</span>
                          </h3>
                          <ul className="space-y-2.5">
                            {(plan.exclusions || ["Cosmetic procedures", "Experimental medicines"]).map((ex, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500/80 mt-2 flex-shrink-0" />
                                <span className="font-semibold leading-relaxed">{ex}</span>
                              </li>
                            ))}
                          </ul>

                          {/* Waiting period panel */}
                          {plan.waitingPeriod && (
                            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-3 mt-4 text-left">
                              <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                              <div className="space-y-1 text-xs">
                                <span className="font-black text-amber-400 uppercase tracking-wide text-[9px] block">Waiting Period Mandate</span>
                                <p className="text-slate-350 font-semibold leading-relaxed">{plan.waitingPeriod}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Visual CRO sign-off */}
                        <div className="p-5 rounded-3xl bg-slate-950/60 border border-white/5 flex flex-col justify-between text-left space-y-4">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 py-1 px-3.5 rounded-full border border-emerald-500/20 w-fit">
                              <ShieldCheck className="w-3.5 h-3.5 stroke-[2.2]" />
                              <span>Audit Cleared</span>
                            </span>
                            <h4 className="text-xs font-black text-white mt-3">Chief Risk Officer Audit Pass</h4>
                            <p className="text-[11px] text-slate-400 leading-relaxed font-semibold mt-1">
                              &quot;{plan.executiveApproval || "Underwritten under premium guidelines. All standard parameters fully validated."}&quot;
                            </p>
                          </div>
                          
                          {/* Signature box */}
                          <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                            <div className="space-y-0.5">
                              <span className="text-[8px] text-slate-500 uppercase font-black block">Sign-off Index</span>
                              <span className="text-[10px] text-slate-300 font-bold block font-mono">CRO-991-SARAH-AI</span>
                            </div>
                            <div className="flex items-center gap-2 text-cyan-400/70 select-none">
                              <Signature className="w-5 h-5" />
                              <span className="font-serif italic text-xs">Sarah AI Signature</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Claim process journey */}
                      {plan.claimProcess && (
                        <div className="space-y-3 pt-4 border-t border-white/5">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Empanelled Fast-track Claims Process</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {plan.claimProcess.split(". ").map((step, i) => (
                              <div key={i} className="p-4 rounded-2xl bg-slate-950/30 border border-white/5 text-xs relative text-left">
                                <span className="absolute right-4 top-3 text-[10px] font-black font-mono text-cyan-500/30">Step {i+1}</span>
                                <h4 className="font-bold text-white mb-1">
                                  {i === 0 ? "Claim Notification" : i === 1 ? "Assessor Clearance" : "Direct Payout Settlement"}
                                </h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed">{step}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 4: Interactive Compare View */}
                  {activeTab === "compare" && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                          <Scale className="w-5 h-5 text-cyan-400" />
                          <span>Interactive Policy Comparison Engine</span>
                        </h2>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                          Contrast the underwritten primary recommended plan side-by-side against the budget alternative choice.
                        </p>
                      </div>

                      {plan.alternativePlan ? (
                        <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/15">
                                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-500 w-1/4">Calibration Matrix</th>
                                <th className="py-3 px-4 text-cyan-400 font-black uppercase tracking-wider bg-cyan-500/5 border-x border-white/5 w-3/8 text-base">
                                  🥇 Recommended: {plan.planName}
                                </th>
                                <th className="py-3 px-4 text-slate-300 font-black uppercase tracking-wider w-3/8">
                                  🥈 Alternative: {plan.alternativePlan.planName}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="font-semibold text-slate-200 divide-y divide-white/5">
                              <tr>
                                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Monthly Premium</td>
                                <td className="py-4.5 px-4 font-mono font-black text-cyan-300 bg-cyan-500/5 border-x border-white/5 text-sm">{plan.premium}</td>
                                <td className="py-4.5 px-4 font-mono text-slate-350">{plan.alternativePlan.premium}</td>
                              </tr>
                              <tr>
                                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Coverage Limit</td>
                                <td className="py-4.5 px-4 font-black bg-cyan-500/5 border-x border-white/5 text-white">{plan.coverage}</td>
                                <td className="py-4.5 px-4 text-slate-350">{plan.alternativePlan.coverage}</td>
                              </tr>
                              <tr>
                                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Settlement Ratio</td>
                                <td className="py-4.5 px-4 text-emerald-400 font-black bg-cyan-500/5 border-x border-white/5">{plan.claimSettlementRatio || "99.1%"}</td>
                                <td className="py-4.5 px-4 text-slate-350">{plan.alternativePlan.claimSettlementRatio || "98.4%"}</td>
                              </tr>
                              <tr>
                                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Risk Profiling</td>
                                <td className="py-4.5 px-4 bg-cyan-500/5 border-x border-white/5 text-white">{plan.riskLevel || "Low Risk"}</td>
                                <td className="py-4.5 px-4 text-slate-350">{plan.alternativePlan.riskLevel || "Low Risk"}</td>
                              </tr>
                              <tr>
                                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Empanelled Network</td>
                                <td className="py-4.5 px-4 bg-cyan-500/5 border-x border-white/5 text-white">{plan.hospitalNetwork || "12,000+ centers"}</td>
                                <td className="py-4.5 px-4 text-slate-350">{plan.alternativePlan.hospitalNetwork || "8,500+ clinics"}</td>
                              </tr>
                              <tr>
                                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Exclusions Shield</td>
                                <td className="py-4.5 px-4 bg-cyan-500/5 border-x border-white/5 text-slate-300">
                                  {plan.exclusions?.slice(0, 2).join(", ") || "Cosmetic, Combat injury"}
                                </td>
                                <td className="py-4.5 px-4 text-slate-350">
                                  {plan.alternativePlan.exclusions?.slice(0, 2).join(", ") || "Cosmetic treatments"}
                                </td>
                              </tr>
                              <tr className="border-t border-white/10">
                                <td className="py-5 px-4"></td>
                                <td className="py-5 px-4 bg-cyan-500/5 border-x border-white/5">
                                  <button
                                    onClick={handleProceed}
                                    className="w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-wider bg-cyan-400 text-slate-950 hover:bg-cyan-350 transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-lg"
                                  >
                                    <span>Select Recommended</span>
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </td>
                                <td className="py-5 px-4">
                                  <button
                                    onClick={() => {
                                      const botMap: Record<string, string> = {
                                        "motor": "Alex",
                                        "bumper": "Alex",
                                        "drive": "Alex",
                                        "travel": "Ethan",
                                        "nomad": "Ethan",
                                        "voyage": "Ethan",
                                        "property": "Emma",
                                        "fortress": "Emma",
                                        "home": "Emma",
                                        "cyber": "Emma",
                                        "paws": "Emma",
                                        "health": "Sarah"
                                      };
                                      const altPlanName = plan.alternativePlan?.planName?.toLowerCase() ?? "";
                                      let bot = "Sarah";
                                      for (const [key, value] of Object.entries(botMap)) {
                                        if (altPlanName.includes(key)) {
                                          bot = value;
                                          break;
                                        }
                                      }
                                      window.location.href = `/advisor?bot=${bot}&selectPlan=${encodeURIComponent(plan.alternativePlan?.planName ?? "")}`;
                                    }}
                                    className="w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-wider border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                                  >
                                    <span>Select Alternative</span>
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-slate-500 text-xs font-semibold">
                          No alternative budget options compiled for comparison under your coordinates.
                        </div>
                      )}
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function PolicyDetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    }>
      <PolicyDetailsContent />
    </Suspense>
  );
}
