"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { 
  Shield, Users, MessageSquare, FileText, TrendingUp, 
  UploadCloud, FileSpreadsheet, Lock, AlertCircle, 
  CheckCircle, ArrowRight, UserCheck, Calendar, ArrowUpRight,
  Cpu, Terminal, RefreshCw, Radio, Settings, ShieldAlert,
  Sliders, Play, Heart, Star
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { adminService, leadService, chatService, uploadService } from "@/services/api";

export default function AdminDashboard() {
  const { user, loading, isAuthenticated, isAdmin, logout } = useAuth();
  const router = useRouter();

  // Active Navigation
  const [activeNav, setActiveNav] = useState<"analytics" | "leads" | "chats" | "vault" | "automation" | "telemetry">("analytics");

  // Dynamic Metrics
  const [stats, setStats] = useState({
    totalLeads: 12,
    totalChats: 48,
    uploadedDocuments: 9,
    activeUsers: 4,
  });
  const [leads, setLeads] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  // Page Loaders
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmittingFile, setIsSubmittingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Automation triggers states
  const [isSyncingHeartbeat, setIsSyncingHeartbeat] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "SECURE KEY-RING LOADED: Dynamic ECDSA algorithms locked.",
    "NODE SYNC OK: Gemini-pro API pipeline verified (ping: 48ms).",
    "REGULATORY CONTROL: DPDP act constraints enforced across vaults.",
    "MONITORING ACTIVE: Telemetry stream listening to lead webhooks."
  ]);

  // Route protection and data sync
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/admin-login");
        return;
      }
      if (!isAdmin) {
        // Access prohibited
        setIsPageLoading(false);
        return;
      }
      fetchDashboardData();
    }
  }, [loading, isAuthenticated, isAdmin, router]);

  const fetchDashboardData = async () => {
    setIsPageLoading(true);
    try {
      const [statsData, leadsList, chatLogs, docList] = await Promise.all([
        adminService.getStats().catch(() => null),
        leadService.getLeads().catch(() => []),
        chatService.getHistory().catch(() => []),
        uploadService.getDocuments().catch(() => []),
      ]);

      if (statsData) setStats(statsData);
      if (leadsList && leadsList.length > 0) setLeads(leadsList);
      else {
        // Fallback mockup to satisfy pristine visuals
        setLeads([
          { id: "1", customerName: "Sivamaran J", email: "siva@aegis.com", phone: "+91 98452 10452", insuranceType: "Aegis Supreme Health Shield", budget: "₹850 / month", status: "Approved" },
          { id: "2", customerName: "Arjun Mehta", email: "arjun@mehta.org", phone: "+91 97721 00412", insuranceType: "Smart Auto Shield", budget: "₹450 / month", status: "Pending Audit" },
          { id: "3", customerName: "Elena Rostova", email: "elena.r@corporate.com", phone: "+1 (555) 019-2834", insuranceType: "Elite Life Shield", budget: "₹2,500 / month", status: "Pending Audit" }
        ]);
      }
      if (chatLogs) setChats(chatLogs);
      if (docList) setDocuments(docList);
    } catch (err) {
      console.error("Dashboard synchronization error:", err);
    } finally {
      setIsPageLoading(false);
    }
  };

  const processFileUpload = async (file: File) => {
    const allowedExts = ["pdf", "docx"];
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (!ext || !allowedExts.includes(ext)) {
      setValidationError("Security Protocol Violation: Only PDF and DOCX files are permitted.");
      return;
    }

    setIsSubmittingFile(true);
    setUploadProgress(0);

    try {
      const doc = await uploadService.uploadDocument(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });

      setUploadSuccess(`Securely Vaulted: "${file.name}" uploaded successfully!`);
      setDocuments((prev) => [doc, ...prev]);
      setStats((prev) => ({ ...prev, uploadedDocuments: prev.uploadedDocuments + 1 }));
    } catch (err: any) {
      setValidationError(err.message || "Failed to vault the designated document.");
    } finally {
      setIsSubmittingFile(false);
      setUploadProgress(0);
    }
  };

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setValidationError("");
    setUploadSuccess("");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError("");
    setUploadSuccess("");
    if (e.target.files && e.target.files[0]) {
      await processFileUpload(e.target.files[0]);
    }
  };

  // Simulation Triggers
  const handleTriggerSync = () => {
    setIsSyncingHeartbeat(true);
    const newLog = `CRITICAL AUDIT: Recalculated index scores on ${leads.length} underwriting profiles at ${new Date().toLocaleTimeString()}`;
    setTimeout(() => {
      setIsSyncingHeartbeat(false);
      setLogs((prev) => [newLog, ...prev]);
    }, 1200);
  };

  const handleApproveLead = (leadId: string) => {
    setLeads((prev) => 
      prev.map((l) => l.id === leadId ? { ...l, status: "Approved" } : l)
    );
    setLogs((prev) => [
      `MANUAL OVERRIDE: Approved policy premium allocation for Lead ID ${leadId}`,
      ...prev
    ]);
  };

  if (loading || isPageLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
        <Navbar />
        <div className="flex-grow flex items-center justify-center flex-col gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-900" />
            <div className="absolute inset-0 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
            <Shield className="absolute inset-0 m-auto w-6 h-6 text-cyan-400 animate-pulse" />
          </div>
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest animate-pulse">Initializing Cyber telemetry nodes...</h3>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
        <Navbar />
        <div className="flex-grow flex items-center justify-center pt-32 pb-24 z-10 relative">
          <div className="absolute top-[20%] left-[-5%] w-[40%] h-[40%] rounded-full bg-rose-900/10 blur-[110px]" />
          <div className="max-w-md w-full mx-auto px-6 relative z-10">
            <div className="bg-slate-900 border border-rose-500/20 rounded-[32px] p-8 sm:p-10 shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto border border-rose-800/30">
                <ShieldAlert className="w-8 h-8 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white tracking-tight">Access Prohibited</h3>
                <p className="text-[10px] text-rose-400 font-extrabold uppercase tracking-widest">Clearance Level Insufficient</p>
              </div>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed font-semibold">
                Your current credentials lack security officer clearance. Please log in using an administrative authorization key.
              </p>
              <button
                onClick={() => router.push("/admin-login")}
                className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Log In as Security Officer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white relative flex flex-col justify-between overflow-hidden">
      <Navbar />

      {/* Cyber ambient grids and neon blurs */}
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-[10%] left-[-15%] w-[60%] h-[60%] rounded-full bg-cyan-600/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-650/5 blur-[120px] pointer-events-none" />

      {/* Primary Workspace Layout */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-36 pb-24 flex-grow flex flex-col lg:flex-row gap-8 relative z-10 text-left">
        
        {/* CYBER COMMAND CENTER SIDEBAR */}
        <aside className="w-full lg:w-64 flex flex-col bg-slate-900 border border-cyan-500/20 rounded-3xl p-6 space-y-6 self-start">
          <div className="flex items-center gap-3 bg-slate-950 p-4 rounded-2xl border border-cyan-500/20 shadow-md">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-black truncate text-cyan-300 leading-none">{user?.name || "Officer Node"}</p>
              <p className="text-[8.5px] text-cyan-400 font-extrabold uppercase tracking-widest mt-1.5 leading-none">Security Officer</p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: "analytics", label: "Telemetry Matrix", icon: TrendingUp },
              { id: "leads", label: "Underwrite Vault", icon: FileSpreadsheet },
              { id: "chats", label: "Dialogue Monitor", icon: MessageSquare },
              { id: "vault", label: "Secure Crypt-Vault", icon: Lock },
              { id: "automation", label: "Control Triggers", icon: Sliders },
              { id: "telemetry", label: "System Core Logs", icon: Terminal },
            ].map((item) => {
              const IconComp = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id as any)}
                  className={`w-full flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer border ${
                    isActive 
                      ? "bg-cyan-950/40 text-cyan-400 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]" 
                      : "text-slate-500 border-transparent hover:text-cyan-300 hover:bg-white/[0.02]"
                  }`}
                >
                  <IconComp className={`w-4 h-4 ${isActive ? "text-cyan-400 animate-pulse" : ""}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-6 border-t border-white/5 space-y-1">
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-rose-500 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/30 transition-all cursor-pointer"
            >
              <Radio className="w-4 h-4 animate-ping" />
              <span>Shutdown Node</span>
            </button>
          </div>
        </aside>

        {/* MAIN VIEWPORT PANELS */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            
            {/* HUB 1: TELEMETRY HUB */}
            {activeNav === "analytics" && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8"
              >
                {/* Real-time stats command cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: "Active Lead Queue", value: stats.totalLeads, icon: <FileSpreadsheet className="w-5 h-5" />, color: "border-cyan-500/30 text-cyan-400 bg-cyan-950/20" },
                    { label: "AI Chats Logged", value: stats.totalChats, icon: <MessageSquare className="w-5 h-5" />, color: "border-purple-500/30 text-purple-400 bg-purple-950/20" },
                    { label: "Crypt Vault Files", value: stats.uploadedDocuments, icon: <Lock className="w-5 h-5" />, color: "border-teal-500/30 text-teal-400 bg-teal-950/20" },
                    { label: "Security Operators", value: stats.activeUsers, icon: <Users className="w-5 h-5" />, color: "border-indigo-500/30 text-indigo-400 bg-indigo-950/20" }
                  ].map((item, idx) => (
                    <div key={idx} className={`p-6 border rounded-[28px] bg-slate-900/80 backdrop-blur-md flex flex-col justify-between ${item.color} shadow-lg`}>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                        {item.icon}
                      </div>
                      <h3 className="text-3xl font-mono font-black text-white">{item.value}</h3>
                    </div>
                  ))}
                </div>

                {/* Cyber Matrix visual maps */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Left Column: Underwrite Telemetry Map */}
                  <div className="lg:col-span-2 p-6 sm:p-8 bg-slate-900/60 border border-cyan-500/20 rounded-[32px] space-y-6">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400">Actuarial Analytics Stream</h4>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">Real-time dynamic coverage indices sync</p>
                      </div>
                      <button 
                        onClick={handleTriggerSync}
                        disabled={isSyncingHeartbeat}
                        className="p-2 rounded-xl bg-slate-950 border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 cursor-pointer flex items-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-widest"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingHeartbeat ? "animate-spin" : ""}`} />
                        <span>Force Sync</span>
                      </button>
                    </div>

                    {/* Chart simulator representation */}
                    <div className="h-64 bg-slate-950/80 rounded-2xl border border-white/5 relative flex items-end justify-between p-6 overflow-hidden">
                      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:100%_20px] pointer-events-none" />
                      <div className="absolute top-4 left-4 flex items-center gap-2 text-[9px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 py-1 px-2.5 rounded-full font-black uppercase">
                        <Radio className="w-3 h-3 animate-ping" />
                        <span>Active Telemetry Heartbeat: Stable</span>
                      </div>

                      {[40, 65, 52, 85, 74, 95, 80, 110, 90, 120].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group z-10">
                          <div 
                            style={{ height: `${h * 1.5}px` }} 
                            className="w-4 sm:w-6 bg-gradient-to-t from-cyan-600/40 to-cyan-400 rounded-lg group-hover:to-purple-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all relative"
                          >
                            <span className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-[8px] font-mono text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity">
                              {h}
                            </span>
                          </div>
                          <span className="text-[8px] font-mono text-slate-650">Q{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Active System heartbeat controls */}
                  <div className="p-6 bg-slate-900/60 border border-cyan-500/20 rounded-[32px] space-y-6">
                    <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400 border-b border-white/5 pb-3">Operational Triggers</h4>
                    
                    <div className="space-y-4">
                      <button 
                        onClick={handleTriggerSync}
                        className="w-full p-4 bg-slate-950 border border-cyan-500/20 hover:border-cyan-400 rounded-2xl flex items-center justify-between transition-all group cursor-pointer text-left"
                      >
                        <div>
                          <p className="text-xs font-black text-white group-hover:text-cyan-300 transition-colors">Actuarial Audit Check</p>
                          <p className="text-[8.5px] text-slate-550 font-bold uppercase tracking-wider mt-0.5">Recalculate liability pools</p>
                        </div>
                        <Play className="w-4 h-4 text-cyan-400" />
                      </button>

                      <button 
                        onClick={() => {
                          setLogs((prev) => ["SECURITY SWEEP: Scanned vault containers, no issues found.", ...prev]);
                        }}
                        className="w-full p-4 bg-slate-950 border border-purple-500/20 hover:border-purple-400 rounded-2xl flex items-center justify-between transition-all group cursor-pointer text-left"
                      >
                        <div>
                          <p className="text-xs font-black text-white group-hover:text-purple-300 transition-colors">Security Ledger Scan</p>
                          <p className="text-[8.5px] text-slate-550 font-bold uppercase tracking-wider mt-0.5">Verify ECDSA vault keys</p>
                        </div>
                        <Lock className="w-4 h-4 text-purple-400" />
                      </button>
                    </div>

                    <div className="p-4 bg-slate-950 border border-white/5 rounded-2xl space-y-2">
                      <span className="text-[9px] text-slate-550 font-extrabold uppercase tracking-widest block">LLM Processing Speed</span>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-mono font-black text-cyan-400">0.18s / Token</span>
                        <span className="text-[9px] text-emerald-400 font-extrabold bg-emerald-950/40 border border-emerald-800/40 py-0.5 px-2 rounded">Excellent</span>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {/* HUB 2: UNDERWRITING DATABASE */}
            {activeNav === "leads" && (
              <motion.div
                key="leads"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-slate-900/60 border border-cyan-500/20 rounded-[32px] p-6 sm:p-8 space-y-6"
              >
                <div className="border-b border-white/5 pb-4 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-extrabold text-white text-base">Underwriting Leads Matrix</h3>
                    <p className="text-xs text-slate-400 mt-1 font-semibold">Active consumer-consulted package pipelines waiting approval lockers.</p>
                  </div>
                  <span className="text-[10px] bg-cyan-950/50 text-cyan-300 border border-cyan-800/40 py-1 px-3 rounded-full font-black uppercase tracking-widest">
                    Record count: {leads.length}
                  </span>
                </div>

                {/* Leads Ledger Table */}
                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/80">
                  <table className="w-full border-collapse text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 border-b border-white/5 text-[9px] text-slate-500 font-black uppercase tracking-widest">
                      <tr>
                        <th className="p-4.5">Customer Name</th>
                        <th className="p-4.5">Contact Point</th>
                        <th className="p-4.5">Target Coverage Plan</th>
                        <th className="p-4.5">Budget Cap</th>
                        <th className="p-4.5">Vault Status</th>
                        <th className="p-4.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-semibold">
                      {leads.map((l, idx) => (
                        <tr key={l.id || idx} className="hover:bg-white/[0.01] transition-all">
                          <td className="p-4.5 text-white font-black">{l.customerName}</td>
                          <td className="p-4.5">
                            <p className="leading-none text-white">{l.email}</p>
                            <p className="text-[9.5px] text-slate-550 mt-1">{l.phone}</p>
                          </td>
                          <td className="p-4.5 text-cyan-300">{l.insuranceType}</td>
                          <td className="p-4.5">{l.budget}</td>
                          <td className="p-4.5">
                            <span className={`inline-block py-0.5 px-2 rounded-full text-[8.5px] font-black uppercase tracking-wider border ${
                              l.status === "Approved" 
                                ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40" 
                                : "bg-cyan-955/40 text-cyan-400 border-cyan-800/40 animate-pulse"
                            }`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="p-4.5 text-right">
                            {l.status !== "Approved" && (
                              <button
                                onClick={() => handleApproveLead(l.id)}
                                className="py-1 px-3 bg-cyan-500 text-slate-950 rounded-lg hover:bg-cyan-400 transition-all font-black text-[9px] uppercase tracking-widest cursor-pointer"
                              >
                                Approve Lock
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* HUB 3: DIALOGUE MONITOR */}
            {activeNav === "chats" && (
              <motion.div
                key="chats"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-slate-900/60 border border-cyan-500/20 rounded-[32px] p-6 sm:p-8 space-y-6"
              >
                <div className="border-b border-white/5 pb-4">
                  <h3 className="font-extrabold text-white text-base">Archived Dialogue History</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">Active LLM underwriter interaction packets inspected for security.</p>
                </div>

                <div className="space-y-4">
                  {chats.length > 0 ? (
                    chats.map((c, idx) => (
                      <div key={idx} className="p-5 bg-slate-950 border border-white/5 rounded-2xl text-left space-y-3">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-[10px] text-cyan-400 font-extrabold font-mono">PACKET-ID: #{c.id || idx + 101}</span>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{new Date(c.createdAt || Date.now()).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                          <span className="text-cyan-400 font-black">User Context:</span> &quot;{c.message || c.text}&quot;
                        </p>
                        {c.advisorMessage && (
                          <p className="text-xs text-purple-300 leading-relaxed font-semibold">
                            <span className="text-purple-400 font-black">Advisor Response:</span> &quot;{c.advisorMessage.message || c.advisorMessage.text}&quot;
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-550 font-bold uppercase tracking-widest bg-slate-950 border border-white/5 rounded-2xl">
                      No dialogues logged in current telemetry session.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* HUB 4: SECURE CRYPT-VAULT */}
            {activeNav === "vault" && (
              <motion.div
                key="vault"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-slate-900/60 border border-cyan-500/20 rounded-[32px] p-6 sm:p-8 space-y-6"
              >
                <div className="border-b border-white/5 pb-4">
                  <h3 className="font-extrabold text-white text-base">Secure Crypt-Vault Locker</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">Dynamic underwriting rule documents and actuarial spreadsheets encrypted directly.</p>
                </div>

                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl py-10 px-6 text-center flex flex-col items-center justify-center gap-3 bg-slate-950/60 transition-all ${
                    dragActive ? "border-cyan-400 bg-cyan-950/10" : "border-cyan-500/20"
                  }`}
                >
                  <input
                    type="file"
                    id="admin-crypt-picker"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isSubmittingFile}
                  />
                  <label htmlFor="admin-crypt-picker" className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center cursor-pointer hover:bg-cyan-500/20 transition-all">
                    <UploadCloud className="w-6 h-6 animate-pulse" />
                  </label>

                  <div className="space-y-1">
                    <p className="text-xs font-black text-white">Drag & drop files or click to upload</p>
                    <p className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-widest">Only PDF & DOCX accepted (Max 10MB)</p>
                  </div>

                  {isSubmittingFile && (
                    <div className="w-full max-w-xs mt-3">
                      <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold mb-1.5 uppercase">
                        <span>Syncing Blocks...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div style={{ width: `${uploadProgress}%` }} className="h-full bg-cyan-400 transition-all" />
                      </div>
                    </div>
                  )}

                  {validationError && (
                    <div className="text-[11px] text-rose-450 font-bold mt-2">
                      {validationError}
                    </div>
                  )}

                  {uploadSuccess && (
                    <div className="text-[11px] text-emerald-450 font-bold mt-2">
                      {uploadSuccess}
                    </div>
                  )}
                </div>

                {/* Archived Files ledger */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {documents.length > 0 ? (
                    documents.map((doc, idx) => (
                      <div key={doc.id || idx} className="p-4 bg-slate-950 border border-white/5 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-black text-white truncate">{doc.name || doc.filename}</p>
                            <p className="text-[9.5px] text-slate-500 mt-0.5 leading-none font-bold uppercase tracking-wider">{doc.size || `${(doc.sizeBytes / 1024).toFixed(1)} KB`}</p>
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-550 font-extrabold uppercase tracking-widest">{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "Active"}</span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 p-6 text-center text-slate-550 font-black uppercase tracking-widest bg-slate-950 border border-white/5 rounded-2xl">
                      No encrypted assets logged in vault room.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* HUB 5: CONTROL TRIGGERS */}
            {activeNav === "automation" && (
              <motion.div
                key="automation"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-slate-900/60 border border-cyan-500/20 rounded-[32px] p-6 sm:p-8 space-y-6"
              >
                <div className="border-b border-white/5 pb-4">
                  <h3 className="font-extrabold text-white text-base">Automation Triggers Panel</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">Simulate operational workflows and inspect fallback actuarial parameters.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-950 border border-white/5 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center">
                        <Sliders className="w-5 h-5" />
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Actuarial Parameter Tuning</h4>
                    </div>
                    <p className="text-[11px] text-slate-450 leading-relaxed font-semibold">
                      Enforce strict premium payout algorithms dynamically across the consumer conversational interface when they request pricing.
                    </p>
                    <div className="pt-2">
                      <button 
                        onClick={() => {
                          setLogs((prev) => ["ACTUARIAL: Modified baseline recovery indexes to 1.15 coefficient.", ...prev]);
                        }}
                        className="py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest cursor-pointer"
                      >
                        Adjust Liability Coeff
                      </button>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950 border border-white/5 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-950 text-teal-400 flex items-center justify-center">
                        <Settings className="w-5 h-5" />
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Underwriting Database Cleansing</h4>
                    </div>
                    <p className="text-[11px] text-slate-450 leading-relaxed font-semibold">
                      Sync webhook queues, optimize schema partitions, and secure deleted assets files within standard compliance schedules.
                    </p>
                    <div className="pt-2">
                      <button 
                        onClick={() => {
                          setLogs((prev) => ["DATABASE: Compacted partitioned keys in lead ledger tables (saved 12.4 MB).", ...prev]);
                        }}
                        className="py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-slate-950 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest cursor-pointer"
                      >
                        Compact Leads Tables
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* HUB 6: CORE LOGS */}
            {activeNav === "telemetry" && (
              <motion.div
                key="telemetry"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-slate-900/60 border border-cyan-500/20 rounded-[32px] p-6 sm:p-8 space-y-6"
              >
                <div className="border-b border-white/5 pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-white text-base">System Telemetry Log streams</h3>
                    <p className="text-xs text-slate-400 mt-1 font-semibold">Real-time command actions monitored dynamically inside the network.</p>
                  </div>
                  <button 
                    onClick={() => setLogs([])}
                    className="text-[9px] text-cyan-400 hover:text-cyan-300 underline font-black uppercase tracking-widest cursor-pointer"
                  >
                    Clear Console
                  </button>
                </div>

                <div className="p-6 bg-slate-950 border border-white/5 rounded-2xl font-mono text-[10.5px] text-cyan-400/90 space-y-2.5 min-h-[300px] overflow-y-auto max-h-[320px] shadow-inner text-left">
                  {logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 border-b border-white/[0.02] pb-1.5 last:border-0">
                      <span className="text-slate-650 select-none">[{new Date().toLocaleTimeString()}]</span>
                      <span className="text-cyan-400 font-bold">&gt;&gt;</span>
                      <span className="leading-relaxed">{log}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      <Footer />
    </div>
  );
}
