"use client";

import { Shield } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Spinner } from "@/components/shared/Spinner";
import Footer from "@/components/Footer";
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
  const dash = useConsumerDashboard();

  if (dash.isBooting) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between">
        <Navbar />
        <main id="main-content">
        <div className="flex-grow flex items-center justify-center flex-col gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
            <Spinner className="absolute inset-0 border-purple-550" />
            <Shield className="absolute inset-0 m-auto w-6 h-6 text-purple-400 animate-pulse" />
          </div>
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Synchronizing Dynamic Dashboard...</h3>
        </div>
        </main>
        <Footer />
      </div>
    );
  }

  const wrapperClass = "bg-surface text-content";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />
      <main id="main-content">
      <DashboardAmbient />

      {/* Main Layout Grid */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-36 pb-24 flex-grow flex flex-col md:flex-row gap-8 relative z-10">

        <DashboardSidebar
          activeNav={dash.activeNav}
          setActiveNav={dash.setActiveNav}
          sidebarOpen={dash.sidebarOpen}
          setSidebarOpen={dash.setSidebarOpen}
          clientName={dash.clientName}
          clientEmail={dash.clientEmail}
          logout={dash.logout}
        />

        {/* VIEWPORT CONTROLLER PANEL */}
        <div className="flex-grow min-w-0">
          <AnimatePresence mode="wait">
            {dash.activeNav === "dashboard" && (
              <OverviewViewport
                clientName={dash.clientName}
                report={dash.report}
                isReportLoading={dash.isReportLoading}
                reportError={dash.reportError}
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
              <PoliciesViewport
                activePoliciesList={dash.activePoliciesList}
                heldPolicies={dash.heldPolicies}
                isProfileLoading={dash.isProfileLoading}
                renewals={dash.report?.renewals ?? []}
                isReportLoading={dash.isReportLoading}
                pagination={dash.policiesPagination}
                isPaging={dash.isPoliciesPaging}
                onPageChange={dash.goToPoliciesPage}
              />
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
            {dash.activeNav === "claims" && <ClaimsViewport claims={dash.claims} loading={dash.isClaimsLoading} />}
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

      </main>
      <Footer />
    </div>
  );
}
