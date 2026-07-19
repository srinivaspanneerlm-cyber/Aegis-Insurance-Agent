"use client";

import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { adminService, leadService, chatService, uploadService } from "@/services/api";
import { Lead, ChatLog, DocumentRecord, AdminStats, PageInfo } from "@/types/domain";
import type { AdminNav } from "./types";

/** Delay simulating the actuarial re-sync heartbeat (ms). */
const SYNC_SIMULATE_DELAY = 1200;

/** Rows per page for the server-paginated Underwriting Leads Matrix. */
const LEADS_PAGE_SIZE = 10;

/** Cards per page for the server-paginated Crypt-Vault document ledger. */
const DOCS_PAGE_SIZE = 8;

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
  const [leadsPagination, setLeadsPagination] = useState<PageInfo | null>(null);
  const [isLeadsLoading, setIsLeadsLoading] = useState(false);
  const [chats, setChats] = useState<ChatLog[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentsPagination, setDocumentsPagination] = useState<PageInfo | null>(null);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);

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

  /**
   * Fetch one page of leads from the server and mirror the pagination envelope.
   * When the API has no leads (fresh/dev DB) the first page still shows the
   * mock roster so the dashboard keeps its pristine visuals, as before.
   */
  const loadLeads = async (page: number) => {
    setIsLeadsLoading(true);
    try {
      const { leads: list, pagination } = await leadService.getLeads({
        page,
        limit: LEADS_PAGE_SIZE,
      });
      if (list && list.length > 0) {
        setLeads(list);
        setLeadsPagination(pagination);
      } else if (page <= 1) {
        setLeads(FALLBACK_LEADS);
        setLeadsPagination(null);
      } else {
        setLeads([]);
        setLeadsPagination(pagination);
      }
    } catch {
      // Keep the current page on failure; seed the mock roster on first load.
      if (page <= 1 && leads.length === 0) {
        setLeads(FALLBACK_LEADS);
        setLeadsPagination(null);
      }
    } finally {
      setIsLeadsLoading(false);
    }
  };

  /** Fetch one page of vaulted documents and mirror the pagination envelope. */
  const loadDocuments = async (page: number) => {
    setIsDocumentsLoading(true);
    try {
      const { documents: list, pagination } = await uploadService.getDocuments({
        page,
        limit: DOCS_PAGE_SIZE,
      });
      setDocuments(list ?? []);
      setDocumentsPagination(pagination);
    } catch {
      // Keep the current page on failure (matches the prior silent-empty load).
    } finally {
      setIsDocumentsLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    setIsPageLoading(true);
    try {
      const [statsData, chatLogs] = await Promise.all([
        adminService.getStats().catch(() => null),
        chatService.getHistory().catch(() => []),
        loadLeads(1),
        loadDocuments(1),
      ]);

      if (statsData) setStats(statsData);
      if (chatLogs) setChats(chatLogs);
    } catch (err) {
      logger.error("Dashboard synchronization error:", err);
    } finally {
      setIsPageLoading(false);
    }
  };

  const goToLeadsPage = (page: number) => {
    if (isLeadsLoading || page < 1) return;
    void loadLeads(page);
  };

  const goToDocumentsPage = (page: number) => {
    if (isDocumentsLoading || page < 1) return;
    void loadDocuments(page);
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
      setDocumentsPagination((prev) => (prev ? { ...prev, total: prev.total + 1 } : prev));
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
    stats, leads, leadsPagination, isLeadsLoading, goToLeadsPage, chats,
    documents, documentsPagination, isDocumentsLoading, goToDocumentsPage,
    // upload
    isSubmittingFile, uploadProgress, dragActive, validationError, uploadSuccess,
    handleDrag, handleDrop, handleFileSelect,
    // triggers + logs
    isSyncingHeartbeat, handleTriggerSync, handleApproveLead, logs, setLogs,
  };
}
