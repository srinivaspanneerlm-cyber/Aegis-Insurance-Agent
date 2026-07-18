"use client";

import { useState, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { chatService, policyService } from "@/services/api";
import type {
  NavId, DashboardMessage, DashboardPolicy, DashboardDoc, DashboardNotification,
} from "./types";

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
  { id: 3, title: "KYC Clearance Verified", message: "Your sovereign ID credentials have been successfully updated in our decentralized cloud vault.", time: "3 days ago", type: "kyc", read: true },
];

const INITIAL_DOCS: DashboardDoc[] = [
  { id: "doc-1", name: "Supreme_Health_Shield_Certificate.pdf", size: "2.4 MB", type: "policy", date: "May 10, 2026" },
  { id: "doc-2", name: "Sovereign_Aadhaar_KYC_Encrypted.pdf", size: "1.1 MB", type: "kyc", date: "May 14, 2026" },
  { id: "doc-3", name: "Premium_Receipt_Q1_2026.pdf", size: "850 KB", type: "receipt", date: "April 02, 2026" },
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
  const { user, loading, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const [activeNav, setActiveNav] = useState<NavId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [dbPolicies, setDbPolicies] = useState<DashboardPolicy[]>([]);
  const [isPoliciesLoading, setIsPoliciesLoading] = useState(true);

  const [chatMessages, setChatMessages] = useState<DashboardMessage[]>(INITIAL_MESSAGES);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<DashboardNotification[]>(INITIAL_NOTIFICATIONS);

  const [uploadedFiles, setUploadedFiles] = useState<DashboardDoc[]>(INITIAL_DOCS);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Route protection
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, router]);

  // Load policies
  useEffect(() => {
    async function fetchUserPolicies() {
      try {
        const data = await policyService.getPolicies();
        if (data && data.length > 0) {
          setDbPolicies(data);
        }
      } catch {
        logger.warn("Failed to load user policies. Proceeding with premium defaults.");
      } finally {
        setIsPoliciesLoading(false);
      }
    }
    fetchUserPolicies();
  }, []);

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

  const clientName = user?.name || "Premium Client";
  const clientArchetype =
    clientName.toLowerCase().includes("admin") || clientName.toLowerCase().includes("test")
      ? "Balanced Risk Manager"
      : "Family-Focused Planner";

  const activePoliciesList = dbPolicies.length > 0 ? dbPolicies : DEFAULT_POLICIES;

  return {
    // navigation
    activeNav, setActiveNav, sidebarOpen, setSidebarOpen,
    // status
    isBooting: loading || isPoliciesLoading,
    logout,
    // identity
    clientName, clientArchetype,
    archetypeExplanation: archetypeExplanation(clientArchetype),
    // chat
    chatMessages, chatInput, setChatInput, isTyping, chatEndRef, handleSendMessage,
    // policies
    activePoliciesList,
    // documents
    uploadedFiles, uploadingDoc, uploadSuccess, handleFileUpload,
    // notifications
    notifications, markAllNotificationsRead,
  };
}
