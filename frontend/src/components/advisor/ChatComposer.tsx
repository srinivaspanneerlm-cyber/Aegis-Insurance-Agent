"use client";

import { RefObject } from "react";
import { Send, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import VoiceEngine from "@/components/VoiceEngine";
import { ADVISORS, type AdvisorKey } from "@/lib/advisors";

interface ChatComposerProps {
  previousAdvisorCategory: AdvisorKey | null;
  onReturnToPrevious: () => void;
  isStreaming: boolean;
  onSubmit: (e?: React.FormEvent) => void;
  onFinalTranscript: (text: string) => void;
  speakText: string | null;
  onSpeakEnd: () => void;
  voiceAgentDomain: string;
  textareaRef: RefObject<HTMLTextAreaElement>;
  inputVal: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
}

/** Bottom input area: return-to-previous pill, voice engine, textarea, send. */
export function ChatComposer({
  previousAdvisorCategory, onReturnToPrevious, isStreaming, onSubmit,
  onFinalTranscript, speakText, onSpeakEnd, voiceAgentDomain,
  textareaRef, inputVal, onInputChange, onKeyDown, placeholder,
}: ChatComposerProps) {
  return (
    <div className="p-4 border-t border-white/5 bg-slate-950/40 relative z-10 select-none flex-shrink-0">

      {/* Return to Previous Advisor pill (Rule 6) */}
      <AnimatePresence>
        {previousAdvisorCategory && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className="flex justify-center mb-3"
          >
            <button
              onClick={onReturnToPrevious}
              disabled={isStreaming}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 touch-manipulation disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(148,163,184,1)",
              }}
            >
              <ChevronLeft className="w-3 h-3" />
              Return to {ADVISORS[previousAdvisorCategory].name}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={onSubmit} className="flex items-end gap-3">

        {/* Voice engine */}
        <div className="flex-shrink-0 pb-1">
          <VoiceEngine
            onFinalTranscript={onFinalTranscript}
            speakText={speakText}
            onSpeakEnd={onSpeakEnd}
            agentDomain={voiceAgentDomain}
            disabled={isStreaming}
            autoSpeak={false}
          />
        </div>

        {/* Auto-resize textarea */}
        <div className="flex-grow relative select-text touch-auto">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputVal}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={isStreaming}
            className="w-full py-3.5 pl-5 pr-4 rounded-[22px] border outline-none text-xs font-semibold transition-all resize-none leading-relaxed bg-slate-950/65 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:bg-slate-950 shadow-inner disabled:opacity-50"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={!inputVal.trim() || isStreaming}
          className="p-3.5 rounded-2xl flex-shrink-0 flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:scale-100 active:scale-95 touch-manipulation select-none bg-white text-slate-950 hover:bg-slate-100 shadow-[0_0_15px_rgba(255,255,255,0.1)] mb-px"
        >
          <Send className="w-4 h-4 stroke-[2.2]" />
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 px-1.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider">
        <span>🔐 Pipeline V3.8</span>
        <span className="hidden sm:inline">Conversations are private &amp; secure</span>
        <span>Cleared: IRDAI-MOCK</span>
      </div>
    </div>
  );
}
