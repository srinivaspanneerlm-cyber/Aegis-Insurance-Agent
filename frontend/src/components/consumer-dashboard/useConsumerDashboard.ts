"use client";

import { useState, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { useAuth } from "@/context/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { chatService, intelligenceService, policyService } from "@/services/api";
import type { HeldPolicy, TimelineEntry } from "@/services/api";
import type { IntelligenceReport } from "@aegis/intelligence";
import type { PageInfo } from "@/types/domain";
import type {
  NavId, DashboardMessage, DashboardPolicy, DashboardDoc, DashboardNotification,
} from "./types";

/** Cards per page for the server-paginated active-portfolio list. */
const POLICIES_PAGE_SIZE = 6;

const now = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Delay before the offline fallback advisor reply appears (ms). */
const FALLBACK_REPLY_DELAY = 1200;
/** Delay simulating secure document encryption/upload (ms). */
const UPLOAD_SIMULATE_DELAY = 2000;

const INITIAL_MESSAGES: DashboardMessage[] = [
  {
    id: "1",
    sender: "ai",
    text: "Welcome back! I've audited your active coverage portfolios. Your Family Protection Index stands at an excellent 82%, but adding a Smart Auto Shield would lock in complete 360-degree security. What shall we explore today?",
    timestamp: "Just Now",
  },
];

const INITIAL_NOTIFICATIONS: DashboardNotification[] = [
  { id: 1, title: "AI Audit Cleared", message: "Family health protection coverage has passed the quarterly regulatory evaluation.", time: "2 hours ago", type: "audit", read: false },
  { id: 2, title: "Premium Lock Safe", message: "Your Aegis Supreme Health Shield premium rate is locked in until 2027.", time: "1 day ago", type: "premium", read: true },
  { id: 3, title: "KYC Verified", message: "Your ID documents have been updated and securely stored.", time: "3 days ago", type: "kyc", read: true },
];


const DEFAULT_POLICIES: DashboardPolicy[] = [
  { policyName: "Aegis Supreme Health Shield", premium: 850, coverage: "₹1 Crore Cover", status: "active", claimRatio: "99.2%" },
];

function archetypeExplanation(archetype: string): string {
  if (archetype === "Balanced Risk Manager") {
    return "You maintain a highly optimized asset coverage ratio, balancing premium cost-efficiency with solid coverage networks across motor and health sectors.";
  }
  return "You prioritize absolute family protection, comprehensive financial security matrices, and high-touch cashless healthcare preparedness.";
}

/**
 * Owns all state, data-loading, and handlers for the consumer dashboard so the
 * page and its viewport components stay presentational. Behaviour (route guard,
 * chat with API + offline fallback, simulated upload, notifications) is
 * unchanged from the original monolithic page.
 */
export function useConsumerDashboard() {
  // The shared guard owns the redirect; this hook only needs to know whether
  // there is a customer to render for.
  const { user, isReady } = useRequireAuth();
  const { logout } = useAuth();

  const [activeNav, setActiveNav] = useState<NavId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [dbPolicies, setDbPolicies] = useState<DashboardPolicy[]>([]);

  // The protection analysis. Kept beside the policies rather than inside the
  // card that shows it, so a second consumer of the report does not fetch it
  // twice.
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);

  // Cover held elsewhere, from the same profile the analysis is built on.
  const [heldPolicies, setHeldPolicies] = useState<HeldPolicy[]>([]);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [policiesPagination, setPoliciesPagination] = useState<PageInfo | null>(null);
  // `isPoliciesLoading` gates the boot screen (initial load only); a separate
  // `isPoliciesPaging` flag covers subsequent page fetches so paging never
  // re-triggers the full-screen boot state.
  const [isPoliciesLoading, setIsPoliciesLoading] = useState(true);
  const [isPoliciesPaging, setIsPoliciesPaging] = useState(false);

  // Deliberately not blocking `isBooting`: a customer's policies and advisor are
  // useful while the analysis is still being worked out, and holding the whole
  // dashboard for it would make a slow report look like a slow login.
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    // The customer's real documents. The list was previously seeded with three
    // invented files — a policy certificate, an Aadhaar KYC and a premium
    // receipt — presented as though the customer had uploaded them.
    intelligenceService
      .getTimeline()
      .then(({ entries }) => {
        if (!cancelled) setClaims(entries.filter((entry) => entry.source === "work"));
      })
      .catch(() => {
        // An empty list is honest; an invented claim is not.
      })
      .finally(() => {
        if (!cancelled) setIsClaimsLoading(false);
      });

    intelligenceService
      .getDocuments()
      .then(({ documents }) => {
        if (cancelled) return;
        setUploadedFiles(
          documents.map((doc) => ({
            id: doc.id,
            name: doc.filename,
            size: doc.sizeBytes ? `${(doc.sizeBytes / 1024 / 1024).toFixed(1)} MB` : "—",
            type: doc.documentKey ?? doc.category ?? "document",
            date: new Date(doc.uploadedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            status: doc.status,
            rejectionReason: doc.rejectionReason,
          }))
        );
      })
      .catch(() => {
        // An empty list is the honest fallback; invented files are not.
      })
      .finally(() => {
        if (!cancelled) setIsDocsLoading(false);
      });

    intelligenceService
      .getProfile()
      .then((data) => {
        if (!cancelled) setHeldPolicies(data.heldPolicies);
      })
      .catch(() => {
        // The held list is additive context; failing to load it must not take
        // the report with it.
      })
      .finally(() => {
        if (!cancelled) setIsProfileLoading(false);
      });

    intelligenceService
      .getReport()
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setReportError(null);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        logger.warn("dashboard: protection report unavailable", error);
        setReportError("We could not load your protection profile.");
      })
      .finally(() => {
        if (!cancelled) setIsReportLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isReady]);

  const [chatMessages, setChatMessages] = useState<DashboardMessage[]>(INITIAL_MESSAGES);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<DashboardNotification[]>(INITIAL_NOTIFICATIONS);

  const [uploadedFiles, setUploadedFiles] = useState<DashboardDoc[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(true);

  // The customer's own cases, from the Sprint 11 timeline. There is no
  // customer-facing claims endpoint; cases are work items, and that timeline is
  // the surface that serves them to the person they concern.
  const [claims, setClaims] = useState<TimelineEntry[]>([]);
  const [isClaimsLoading, setIsClaimsLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Load policies (one page at a time). The premium-default fallback is kept:
  // an empty first page leaves `dbPolicies` empty so `activePoliciesList` uses
  // DEFAULT_POLICIES, exactly as before.
  const loadPolicies = async (page: number, initial = false) => {
    if (!initial) setIsPoliciesPaging(true);
    try {
      const { policies, pagination } = await policyService.getPolicies({
        page,
        limit: POLICIES_PAGE_SIZE,
      });
      if (policies && policies.length > 0) {
        setDbPolicies(policies);
        setPoliciesPagination(pagination);
      } else {
        setDbPolicies([]);
        setPoliciesPagination(page <= 1 ? null : pagination);
      }
    } catch {
      logger.warn("Failed to load user policies. Proceeding with premium defaults.");
      if (page <= 1) setPoliciesPagination(null);
    } finally {
      if (initial) setIsPoliciesLoading(false);
      else setIsPoliciesPaging(false);
    }
  };

  useEffect(() => {
    loadPolicies(1, true);
  }, []);

  const goToPoliciesPage = (page: number) => {
    if (isPoliciesPaging || page < 1) return;
    void loadPolicies(page);
  };

  // Chat autoscroll
  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [chatMessages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    const userMsg: DashboardMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
      timestamp: now(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    try {
      const data = await chatService.sendMessage(userText);
      setIsTyping(false);
      if (data && data.advisorMessage) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: data.advisorMessage.id,
            sender: "ai",
            text: data.advisorMessage.message,
            timestamp: new Date(data.advisorMessage.createdAt ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch {
      setTimeout(() => {
        setIsTyping(false);
        let fallback = "I've analyzed your protection profile. Your health shield is secured, but I suggest scheduling a short audit to review accidental recovery riders.";
        if (userText.toLowerCase().includes("auto") || userText.toLowerCase().includes("car")) {
          fallback = "For your vehicle protection, the Aegis Smart Auto Shield locks in zero-depreciation coverage, instant cashless garages, and 24/7 recovery for ₹450 / month.";
        } else if (userText.toLowerCase().includes("life") || userText.toLowerCase().includes("term")) {
          fallback = "Your family's dynamic future is best secured with our Elite Life Shield, offering a ₹1.5 Crore death cover with an immediate distress payout desk.";
        }
        setChatMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), sender: "ai", text: fallback, timestamp: now() },
        ]);
      }, FALLBACK_REPLY_DELAY);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingDoc(true);
      setUploadSuccess("");

      setTimeout(() => {
        setUploadingDoc(false);
        setUploadSuccess(`Securely encrypted: "${file.name}" added to KYC vault!`);
        setUploadedFiles((prev) => [
          {
            id: `doc-${Date.now()}`,
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            type: "kyc",
            date: "Today",
          },
          ...prev,
        ]);
      }, UPLOAD_SIMULATE_DELAY);
    }
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Identity is read from the session and nowhere else. This used to fall back
  // to a "Premium Client" placeholder, which meant a dashboard rendered before
  // (or without) a session greeted the visitor by a name that was not theirs and
  // looked signed in when it was not. There is no stand-in now: `isBooting`
  // below holds the screen until the session resolves, and the guard above
  // redirects anyone who turns out not to have one.
  const clientName = user?.name ?? "";
  const clientEmail = user?.email ?? "";
  const clientArchetype =
    clientName.toLowerCase().includes("test") || clientName.toLowerCase().includes("demo")
      ? "Balanced Risk Manager"
      : "Family-Focused Planner";

  const activePoliciesList = dbPolicies.length > 0 ? dbPolicies : DEFAULT_POLICIES;

  return {
    // navigation
    activeNav, setActiveNav, sidebarOpen, setSidebarOpen,
    // status
    // `!isReady` covers both "the session is still resolving" and "there is no
    // customer": without the second, the dashboard renders a frame with nobody
    // in it — an empty name and a blank avatar — during the tick between the
    // session resolving and the guard redirecting.
    isBooting: !isReady || isPoliciesLoading,
    logout,
    // identity
    clientName, clientEmail, clientArchetype,
    report, isReportLoading, reportError,
    heldPolicies, isProfileLoading,
    isDocsLoading,
    claims, isClaimsLoading,
    archetypeExplanation: archetypeExplanation(clientArchetype),
    // chat
    chatMessages, chatInput, setChatInput, isTyping, chatEndRef, handleSendMessage,
    // policies
    activePoliciesList, policiesPagination, isPoliciesPaging, goToPoliciesPage,
    // documents
    uploadedFiles, uploadingDoc, uploadSuccess, handleFileUpload,
    // notifications
    notifications, markAllNotificationsRead,
  };
}
