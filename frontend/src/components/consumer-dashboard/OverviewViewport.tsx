"use client";

import { RefObject } from "react";
import { motion } from "framer-motion";
import type { NavId, DashboardMessage } from "./types";
import { containerVariants } from "./overview/variants";
import { HeroBanner } from "./overview/HeroBanner";
import { AdvisorChatPanel } from "./overview/AdvisorChatPanel";
import { ResumeConsultationCard } from "./overview/ResumeConsultationCard";
import { RecommendationGoals } from "./overview/RecommendationGoals";
import { ProtectionScoreCard } from "./overview/ProtectionScoreCard";
import type { IntelligenceReport } from "@aegis/intelligence";
import { ArchetypeCard } from "./overview/ArchetypeCard";
import { QuickActionDesks } from "./overview/QuickActionDesks";

interface OverviewViewportProps {
  clientName: string;
  report: IntelligenceReport | null;
  isReportLoading: boolean;
  reportError: string | null;
  clientArchetype: string;
  archetypeExplanation: string;
  chatMessages: DashboardMessage[];
  isTyping: boolean;
  chatInput: string;
  setChatInput: (value: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  chatEndRef: RefObject<HTMLDivElement | null>;
  setActiveNav: (nav: NavId) => void;
}

/** Primary overview console (nav: "dashboard"). */
export function OverviewViewport({
  clientName, clientArchetype, archetypeExplanation,
  report, isReportLoading, reportError,
  chatMessages, isTyping, chatInput, setChatInput, handleSendMessage, chatEndRef,
  setActiveNav,
}: OverviewViewportProps) {
  return (
    <motion.div
      key="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="space-y-8"
    >
      <HeroBanner clientName={clientName} />

      {/* Sub sections splits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (lg:col-span-2): Chat, Memory, and Recommendations */}
        <div className="lg:col-span-2 space-y-8">
          <AdvisorChatPanel
            chatMessages={chatMessages}
            isTyping={isTyping}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleSendMessage={handleSendMessage}
            chatEndRef={chatEndRef}
          />
          <ResumeConsultationCard setActiveNav={setActiveNav} />
          <RecommendationGoals />
        </div>

        {/* Right Column (lg:col-span-1): Score, Profile archetype, and Quick Actions */}
        <div className="space-y-8 text-left">
          <ProtectionScoreCard report={report} loading={isReportLoading} error={reportError} />
          <ArchetypeCard clientArchetype={clientArchetype} archetypeExplanation={archetypeExplanation} />
          <QuickActionDesks setActiveNav={setActiveNav} />
        </div>
      </div>
    </motion.div>
  );
}
