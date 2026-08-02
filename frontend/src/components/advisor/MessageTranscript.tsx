"use client";

import type { ReactNode } from "react";
import ChatMessage, { type ChatMsg, type RecommendationData } from "@/components/ChatMessage";
import ThinkingEngine from "@/components/ThinkingEngine";
import { ADVISORS, AGENT_NAME_TO_CATEGORY, type Advisor } from "@/lib/advisors";
import type { StreamState } from "@/hooks/useStreaming";
import type { ConnectingAgent } from "@/app/advisor/transferRules";
import { useStickyScroll } from "@/hooks/useStickyScroll";
import { ConnectingOverlay } from "./ConnectingOverlay";
import { JumpToLatest } from "./JumpToLatest";

interface MessageTranscriptProps {
  connectingTo: ConnectingAgent | null;
  messages: ChatMsg[];
  advisor: Advisor;
  streamingAdvisor: Advisor;
  streamState: StreamState;
  streamingTimestamp: string;
  onUIAction: (action: string, planData: RecommendationData) => void;
  onOptionClick: (text: string) => void;
  onRegenerate: (msgId: string) => void;
  onVoicePlay: (text: string) => void;
  /** Rewrite message prose before it is rendered — used to strip UI-only tags. */
  transformText?: (text: string) => string;
  /** Extra content to place under a message, e.g. the document request cards. */
  renderAfterMessage?: (message: ChatMsg) => ReactNode;
}

/** The scrollable message stream: connecting overlay, finalized messages,
 *  thinking indicator, and the in-flight streaming message. Auto-scrolls to the
 *  newest content while the reader is at the bottom, and offers a "jump to
 *  latest" pill when they have scrolled up. */
export function MessageTranscript({
  connectingTo, messages, advisor, streamingAdvisor, streamState, streamingTimestamp,
  onUIAction, onOptionClick, onRegenerate, onVoicePlay, transformText, renderAfterMessage,
}: MessageTranscriptProps) {
  const { containerRef, showJump, handleScroll, scrollToBottom } =
    useStickyScroll<HTMLDivElement>([messages, streamState.text, streamState.phase]);

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-5 sm:px-7 py-6 space-y-5 chat-scroll relative touch-pan-y"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.01),transparent_50%)] pointer-events-none" />

        {/* Connecting overlay — shown instantly after YES, dismissed on first SSE event */}
        <ConnectingOverlay connectingTo={connectingTo} />

        {/* Finalized messages */}
        {messages.map(m => (
          <div key={m.id} className="space-y-3">
          <ChatMessage
            message={transformText ? { ...m, text: transformText(m.text) } : m}
            advisorAvatar={
              m.sender === "advisor"
                ? (AGENT_NAME_TO_CATEGORY[m.agentName || ""] ? ADVISORS[AGENT_NAME_TO_CATEGORY[m.agentName || ""]].avatar : advisor.avatar)
                : advisor.avatar
            }
            advisorTheme={
              m.sender === "advisor"
                ? (AGENT_NAME_TO_CATEGORY[m.agentName || ""] ? ADVISORS[AGENT_NAME_TO_CATEGORY[m.agentName || ""]].theme : advisor.theme)
                : advisor.theme
            }
            advisorName={advisor.name}
            onUIAction={onUIAction}
            onOptionClick={onOptionClick}
            onRegenerate={m.sender === "advisor" ? onRegenerate : undefined}
            onVoicePlay={m.sender === "advisor" ? onVoicePlay : undefined}
          />
          {renderAfterMessage?.(m)}
          </div>
        ))}

        {/* ThinkingEngine — shown during thinking phase */}
        <ThinkingEngine
          active={streamState.phase === "thinking"}
          currentStep={streamState.thinkingStep}
          thinkingHistory={streamState.thinkingHistory}
          agentName={streamingAdvisor.name}
          agentDomain={streamState.agentDomain || advisor.pythonDomain}
          advisorAvatar={streamingAdvisor.avatar}
          advisorTheme={streamingAdvisor.theme}
        />

        {/* Streaming message — shown during streaming phase */}
        {streamState.phase === "streaming" && streamState.text && (
          <ChatMessage
            message={{
              id: "streaming",
              sender: "advisor",
              text: transformText ? transformText(streamState.text) : streamState.text,
              timestamp: streamingTimestamp,
              agentName: streamState.agentName || advisor.name,
              agentDomain: streamState.agentDomain,
              transferred: streamState.transferred,
              isStreaming: true,
            }}
            advisorAvatar={streamingAdvisor.avatar}
            advisorTheme={streamingAdvisor.theme}
            advisorName={streamingAdvisor.name}
            onUIAction={onUIAction}
            onOptionClick={onOptionClick}
          />
        )}
      </div>

      <JumpToLatest show={showJump} onClick={() => scrollToBottom("smooth")} />
    </div>
  );
}
