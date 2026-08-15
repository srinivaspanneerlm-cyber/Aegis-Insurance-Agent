"use client";
import React, { memo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Volume2, RefreshCw } from "lucide-react";

import { parseRecommendation } from "./chat/parseRecommendation";
import { FormattedText } from "./chat/FormattedText";
import { StreamingCursor, TransferBadge, CopyButton } from "./chat/atoms";
import type { ChatMessageProps } from "./chat/types";

// Placeholder shown while a recommendation chunk streams in, so the transcript
// doesn't jump when the lazy card mounts.
const RecSkeleton = () => (
  <div className="mt-1 rounded-2xl border border-white/5 bg-slate-900/40 p-4 animate-pulse">
    <div className="h-3.5 w-1/3 rounded bg-white/10" />
    <div className="mt-3 h-2.5 w-2/3 rounded bg-white/8" />
    <div className="mt-2 h-2.5 w-1/2 rounded bg-white/8" />
  </div>
);

// The recommendation UI renders only after a recommendation finishes streaming
// (see below). Code-split it so it stays out of the advisor's initial bundle
// and loads on demand the first time a plan is shown.
const MultiPlanSuite = dynamic(
  () => import("./chat/MultiPlanSuite").then((m) => m.MultiPlanSuite),
  { ssr: false, loading: RecSkeleton },
);
const SinglePlanRecommendation = dynamic(
  () => import("./chat/SinglePlanRecommendation").then((m) => m.SinglePlanRecommendation),
  { ssr: false, loading: RecSkeleton },
);
const RecommendationCard = dynamic(
  () => import("./chat/RecommendationCard").then((m) => m.RecommendationCard),
  { ssr: false, loading: RecSkeleton },
);

// Re-exported so existing importers of ChatMessage keep working unchanged.
export type {
  RecommendationData,
  PlanScores,
  MultiPlan,
  ChatMsg,
  ChatMessageProps,
} from "./chat/types";
export { StreamingCursor } from "./chat/atoms";

// ── Main ChatMessage Component ─────────────────────────────────────────────────

const ChatMessage = memo(function ChatMessage({
  message,
  advisorAvatar = "S",
  advisorTheme = "from-emerald-600 to-teal-500",
  advisorName = "Sarah AI",
  onUIAction,
  onOptionClick,
  onRegenerate,
  onVoicePlay,
}: ChatMessageProps) {
  const parsed = parseRecommendation(message.text);
  const displayText = parsed ? parsed.cleanedText : message.text;

  // ── User message ─────────────────────────────────────────────────────────
  if (message.sender === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end w-full"
      >
        <div className="max-w-[78%] space-y-1.5 text-right">
          <div className="px-4 py-3 rounded-3xl rounded-br-sm bg-slate-800/70 border border-white/8 text-[13px] font-medium text-slate-200 text-left leading-relaxed shadow-sm">
            {message.text}
          </div>
          <p className="text-[9px] text-slate-600 px-1">{message.timestamp}</p>
        </div>
      </motion.div>
    );
  }

  // ── Advisor message ───────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex items-start gap-3 w-full"
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${advisorTheme} text-white font-black text-sm flex items-center justify-center flex-shrink-0 shadow-lg`}>
        {advisorAvatar}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Agent name + transfer badge */}
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {message.agentName || advisorName}
          </p>
          {message.transferred && (
            <TransferBadge from={message.transferFromName} to={message.agentName} />
          )}
        </div>

        {/* Message bubble */}
        {displayText.trim() && (
          <div className="rounded-3xl rounded-tl-sm px-5 py-4 border border-white/5 bg-slate-900/60 backdrop-blur-sm shadow-sm">
            <FormattedText
              text={displayText}
              onOptionClick={onOptionClick}
            />
            {/* Streaming cursor */}
            {message.isStreaming && (
              <span className="mt-1 inline-block">
                <StreamingCursor />
              </span>
            )}
          </div>
        )}

        {/* Recommendation card. The backend decides how many plans a turn is
            allowed to show; this only renders what it sent. */}
        {parsed && !message.isStreaming && (
          parsed.data.type === "single_plan" && parsed.data.plans?.length
            ? <SinglePlanRecommendation data={parsed.data} onUIAction={onUIAction} />
            : parsed.data.type === "multi_plan" && parsed.data.plans?.length
              ? <MultiPlanSuite data={parsed.data} onUIAction={onUIAction} />
              : <RecommendationCard data={parsed.data} onUIAction={onUIAction} />
        )}

        {/* Timestamp + action buttons */}
        {!message.isStreaming && (
          <div className="flex items-center gap-1 px-1">
            <p className="text-[9px] text-slate-600 flex-1">{message.timestamp}</p>
            <CopyButton text={message.text} />
            {onVoicePlay && (
              <button
                onClick={() => onVoicePlay(displayText)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-white/25 hover:text-white/50 transition-colors"
                title="Read aloud"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(message.id)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-white/25 hover:text-white/50 transition-colors"
                title="Regenerate response"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default ChatMessage;
