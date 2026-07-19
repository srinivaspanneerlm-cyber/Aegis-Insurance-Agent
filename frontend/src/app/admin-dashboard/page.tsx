"use client";

import { AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  useAdminDashboard,
  AdminBootScreen,
  AccessProhibited,
  AdminAmbient,
  AdminSidebar,
  TelemetryViewport,
  LeadsViewport,
  ChatsViewport,
  VaultViewport,
  AutomationViewport,
  LogsViewport,
} from "@/components/admin-dashboard";

export default function AdminDashboard() {
  const dash = useAdminDashboard();

  if (dash.isBooting) {
    return <AdminBootScreen />;
  }

  if (!dash.isAdmin) {
    return <AccessProhibited goToLogin={dash.goToLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white relative flex flex-col justify-between overflow-hidden">
      <Navbar />

      <AdminAmbient />

      {/* Primary Workspace Layout */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-36 pb-24 flex-grow flex flex-col lg:flex-row gap-8 relative z-10 text-left">

        <AdminSidebar
          activeNav={dash.activeNav}
          setActiveNav={dash.setActiveNav}
          userName={dash.user?.name}
          logout={dash.logout}
        />

        {/* MAIN VIEWPORT PANELS */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {dash.activeNav === "analytics" && (
              <TelemetryViewport
                stats={dash.stats}
                isSyncingHeartbeat={dash.isSyncingHeartbeat}
                handleTriggerSync={dash.handleTriggerSync}
                setLogs={dash.setLogs}
              />
            )}
            {dash.activeNav === "leads" && (
              <LeadsViewport
                leads={dash.leads}
                pagination={dash.leadsPagination}
                isLoading={dash.isLeadsLoading}
                onPageChange={dash.goToLeadsPage}
                handleApproveLead={dash.handleApproveLead}
              />
            )}
            {dash.activeNav === "chats" && (
              <ChatsViewport chats={dash.chats} />
            )}
            {dash.activeNav === "vault" && (
              <VaultViewport
                documents={dash.documents}
                dragActive={dash.dragActive}
                isSubmittingFile={dash.isSubmittingFile}
                uploadProgress={dash.uploadProgress}
                validationError={dash.validationError}
                uploadSuccess={dash.uploadSuccess}
                handleDrag={dash.handleDrag}
                handleDrop={dash.handleDrop}
                handleFileSelect={dash.handleFileSelect}
              />
            )}
            {dash.activeNav === "automation" && (
              <AutomationViewport setLogs={dash.setLogs} />
            )}
            {dash.activeNav === "telemetry" && (
              <LogsViewport logs={dash.logs} setLogs={dash.setLogs} />
            )}
          </AnimatePresence>
        </div>

      </div>

      <Footer />
    </div>
  );
}
