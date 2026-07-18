"use client";

import { Shield } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import {
  useConsumerDashboard,
  DashboardAmbient,
  DashboardSidebar,
  OverviewViewport,
  PoliciesViewport,
  AdvisorViewport,
  ClaimsViewport,
  DocumentsViewport,
  NotificationsViewport,
} from "@/components/consumer-dashboard";

export default function ConsumerDashboard() {
  const { theme } = useTheme();
  const dash = useConsumerDashboard();

  if (dash.isBooting) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between">
        <Navbar />
        <div className="flex-grow flex items-center justify-center flex-col gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-purple-550 border-t-transparent animate-spin" />
            <Shield className="absolute inset-0 m-auto w-6 h-6 text-purple-400 animate-pulse" />
          </div>
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Synchronizing Dynamic Dashboard...</h3>
        </div>
        <Footer />
      </div>
    );
  }

  const wrapperClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />
      <DashboardAmbient />

      {/* Main Layout Grid */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-36 pb-24 flex-grow flex flex-col md:flex-row gap-8 relative z-10">

        <DashboardSidebar
          activeNav={dash.activeNav}
          setActiveNav={dash.setActiveNav}
          sidebarOpen={dash.sidebarOpen}
          setSidebarOpen={dash.setSidebarOpen}
          clientName={dash.clientName}
          logout={dash.logout}
        />

        {/* VIEWPORT CONTROLLER PANEL */}
        <div className="flex-grow min-w-0">
          <AnimatePresence mode="wait">
            {dash.activeNav === "dashboard" && (
              <OverviewViewport
                clientName={dash.clientName}
                clientArchetype={dash.clientArchetype}
                archetypeExplanation={dash.archetypeExplanation}
                chatMessages={dash.chatMessages}
                isTyping={dash.isTyping}
                chatInput={dash.chatInput}
                setChatInput={dash.setChatInput}
                handleSendMessage={dash.handleSendMessage}
                chatEndRef={dash.chatEndRef}
                setActiveNav={dash.setActiveNav}
              />
            )}
            {dash.activeNav === "policies" && (
              <PoliciesViewport activePoliciesList={dash.activePoliciesList} />
            )}
            {dash.activeNav === "advisor" && (
              <AdvisorViewport
                chatMessages={dash.chatMessages}
                isTyping={dash.isTyping}
                chatInput={dash.chatInput}
                setChatInput={dash.setChatInput}
                handleSendMessage={dash.handleSendMessage}
              />
            )}
            {dash.activeNav === "claims" && <ClaimsViewport />}
            {dash.activeNav === "documents" && (
              <DocumentsViewport
                uploadedFiles={dash.uploadedFiles}
                uploadingDoc={dash.uploadingDoc}
                uploadSuccess={dash.uploadSuccess}
                handleFileUpload={dash.handleFileUpload}
              />
            )}
            {dash.activeNav === "notifications" && (
              <NotificationsViewport
                notifications={dash.notifications}
                markAllNotificationsRead={dash.markAllNotificationsRead}
              />
            )}
          </AnimatePresence>
        </div>

      </div>

      <Footer />
    </div>
  );
}
