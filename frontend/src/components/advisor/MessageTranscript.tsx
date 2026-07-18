"use client";

import { RefObject } from "react";
import ChatMessage, { type ChatMsg, type RecommendationData } from "@/components/ChatMessage";
import ThinkingEngine from "@/components/ThinkingEngine";
import { ADVISORS, AGENT_NAME_TO_CATEGORY, type Advisor } from "@/lib/advisors";
import type { StreamState } from "@/hooks/useStreaming";
import type { ConnectingAgent } from "@/app/advisor/transferRules";
import { ConnectingOverlay } from "./ConnectingOverlay";

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
  chatEndRef: RefObject<HTMLDivElement>;
}

/** The scrollable message stream: connecting overlay, finalized messages,
 *  thinking indicator, and the in-flight streaming message. */
export function MessageTranscript({
  connectingTo, messages, advisor, streamingAdvisor, streamState, streamingTimestamp,
  onUIAction, onOptionClick, onRegenerate, onVoicePlay, chatEndRef,
}: MessageTranscriptProps) {
  return (
    <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 space-y-5 chat-scroll relative touch-pan-y" style={{ scrollbarWidth: "thin" }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.01),transparent_50%)] pointer-events-none" />

      {/* Connecting overlay — shown instantly after YES, dismissed on first SSE event */}
      <ConnectingOverlay connectingTo={connectingTo} />

      {/* Finalized messages */}
      {messages.map(m => (
        <ChatMessage
          key={m.id}
          message={m}
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
            text: streamState.text,
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

      <div ref={chatEndRef} />
    </div>
  );
}
