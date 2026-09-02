"use client";

import { MessageSquareText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentBadge } from "@/components/brand";
import VoiceEngine from "@/components/VoiceEngine";
import type { VoiceRuntime } from "@/hooks/useVoiceRuntime";
import type { StreamPhase } from "@/hooks/useStreaming";
import type { Advisor } from "@/lib/advisors";

interface CallViewProps {
  advisor: Advisor;
  runtime: VoiceRuntime;
  streamPhase: StreamPhase;
  lastUserText: string | null;
  lastAdvisorText: string | null;
  onSwitchToChat: () => void;
}

/** What the one status line under the mark says, off state that already exists. */
function statusLine(runtime: VoiceRuntime, streamPhase: StreamPhase, advisorName: string): string {
  if (runtime.turnState === "ERROR") return "Something went wrong — tap the mic to retry";
  if (runtime.isRecovering) return "Reconnecting…";
  if (runtime.isTranscribing) return "Got it, one second…";
  if (runtime.isListening) return "Listening…";
  if (streamPhase === "thinking") return `${advisorName} is thinking…`;
  if (runtime.isSpeaking || streamPhase === "streaming") return `${advisorName} is speaking…`;
  return `Tap the mic to talk to ${advisorName}`;
}

/**
 * A phone-call surface for a voice-started conversation: the advisor's mark,
 * one status line, the last thing each side said, and the mic — instead of
 * the full transcript/sidebar chat screen. Landing there was the actual
 * complaint this answers: arriving from the home page's wake phrase into a
 * page full of message bubbles reads as "now go use a chatbot", not as the
 * call that was just in progress.
 *
 * Everything under it is unchanged. This renders *instead of* the chat panel
 * in `advisor/page.tsx`, never in place of any of its logic — the same
 * `sendToAdvisor`, the same `voiceRuntime`, the same session. "Show chat"
 * is one state flip, not a different page, so nothing here is a second
 * conversation surface — it is a second way to look at the one that exists.
 */
export function CallView({ advisor, runtime, streamPhase, lastUserText, lastAdvisorText, onSwitchToChat }: CallViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <button
        onClick={onSwitchToChat}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/60 hover:text-white/90 transition-colors"
      >
        <MessageSquareText className="w-3.5 h-3.5" />
        Show chat
      </button>

      <AgentBadge
        agent={advisor.brand}
        size={120}
        showLabel
        showRole
        speaking={runtime.isSpeaking || streamPhase === "streaming"}
        thinking={streamPhase === "thinking"}
      />

      <p className="text-sm font-medium text-white/70 min-h-[1.25rem]" role="status">
        {statusLine(runtime, streamPhase, advisor.name)}
      </p>

      <div className="flex flex-col gap-3 max-w-lg w-full">
        <AnimatePresence mode="wait">
          {lastUserText && (
            <motion.p
              key={lastUserText}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-white/40"
            >
              You said: <span className="text-white/60">&ldquo;{lastUserText}&rdquo;</span>
            </motion.p>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {lastAdvisorText && (
            <motion.p
              key={lastAdvisorText}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-base leading-relaxed text-white/90"
            >
              {lastAdvisorText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <VoiceEngine runtime={runtime} agentDomain={advisor.pythonDomain} />
    </div>
  );
}
