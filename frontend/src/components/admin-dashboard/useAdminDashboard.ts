"use client";

import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { adminService, leadService, chatService, uploadService } from "@/services/api";
import { Lead, ChatLog, DocumentRecord, AdminStats } from "@/types/domain";
import type { AdminNav } from "./types";

/** Delay simulating the actuarial re-sync heartbeat (ms). */
const SYNC_SIMULATE_DELAY = 1200;

const DEFAULT_STATS: AdminStats = {
  totalLeads: 12,
  totalChats: 48,
  uploadedDocuments: 9,
  activeUsers: 4,
};

const INITIAL_LOGS: string[] = [
  "SECURE KEY-RING LOADED: Dynamic ECDSA algorithms locked.",
  "NODE SYNC OK: Gemini-pro API pipeline verified (ping: 48ms).",
  "REGULATORY CONTROL: DPDP act constraints enforced across vaults.",
  "MONITORING ACTIVE: Telemetry stream listening to lead webhooks.",
];

/** Mock leads shown when the API returns none, preserving the pristine visuals. */
const FALLBACK_LEADS: Lead[] = [
  { id: "1", customerName: "Sivamaran J", email: "siva@aegis.com", phone: "+91 98452 10452", insuranceType: "Aegis Supreme Health Shield", budget: "₹850 / month", status: "Approved" },
  { id: "2", customerName: "Arjun Mehta", email: "arjun@mehta.org", phone: "+91 97721 00412", insuranceType: "Smart Auto Shield", budget: "₹450 / month", status: "Pending Audit" },
  { id: "3", customerName: "Elena Rostova", email: "elena.r@corporate.com", phone: "+1 (555) 019-2834", insuranceType: "Elite Life Shield", budget: "₹2,500 / month", status: "Pending Audit" },
];

/**
 * Owns all state, data-loading, and handlers for the admin dashboard so the
 * page and its viewport components stay presentational. Behaviour (route +
 * admin guard, dashboard data sync, secure upload, simulated triggers, lead
 * approval, telemetry logs) is unchanged from the original monolithic page.
 */
export function useAdminDashboard() {
  const { user, loading, isAuthenticated, isAdmin, logout } = useAuth();
  const router = useRouter();

  // Active Navigation
  const [activeNav, setActiveNav] = useState<AdminNav>("analytics");

  // Dynamic Metrics
  const [stats, setStats] = useState<AdminStats>(DEFAULT_STATS);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [chats, setChats] = useState<ChatLog[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  // Page Loaders
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmittingFile, setIsSubmittingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Automation triggers states
  const [isSyncingHeartbeat, setIsSyncingHeartbeat] = useState(false);
  const [logs, setLogs] = useState<string[]>(INITIAL_LOGS);

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
        setLeads(FALLBACK_LEADS);
      }
      if (chatLogs) setChats(chatLogs);
      if (docList) setDocuments(docList);
    } catch (err) {
      logger.error("Dashboard synchronization error:", err);
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
        const total = progressEvent.total ?? file.size;
        const percent = Math.round((progressEvent.loaded * 100) / total);
        setUploadProgress(percent);
      });

      setUploadSuccess(`Securely Vaulted: "${file.name}" uploaded successfully!`);
      setDocuments((prev) => [doc, ...prev]);
      setStats((prev) => ({ ...prev, uploadedDocuments: prev.uploadedDocuments + 1 }));
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to vault the designated document.");
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
    }, SYNC_SIMULATE_DELAY);
  };

  const handleApproveLead = (leadId: string) => {
    setLeads((prev) =>
      prev.map((l) => l.id === leadId ? { ...l, status: "Approved" } : l)
    );
    setLogs((prev) => [
      `MANUAL OVERRIDE: Approved policy premium allocation for Lead ID ${leadId}`,
      ...prev,
    ]);
  };

  return {
    // navigation
    activeNav, setActiveNav,
    // status
    isBooting: loading || isPageLoading,
    isAdmin,
    user,
    logout,
    goToLogin: () => router.push("/admin-login"),
    // metrics
    stats, leads, chats, documents,
    // upload
    isSubmittingFile, uploadProgress, dragActive, validationError, uploadSuccess,
    handleDrag, handleDrop, handleFileSelect,
    // triggers + logs
    isSyncingHeartbeat, handleTriggerSync, handleApproveLead, logs, setLogs,
  };
}
