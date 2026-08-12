"use client";

import { RefObject } from "react";
import { Sparkles, Clock, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import type { DashboardMessage } from "../types";
import { cardVariants } from "./variants";

interface AdvisorChatPanelProps {
  chatMessages: DashboardMessage[];
  isTyping: boolean;
  chatInput: string;
  setChatInput: (value: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  chatEndRef: RefObject<HTMLDivElement | null>;
}

/** Sarah AI advisor block: recommendation summary, live chat, and input. */
export function AdvisorChatPanel({
  chatMessages, isTyping, chatInput, setChatInput, handleSendMessage, chatEndRef,
}: AdvisorChatPanelProps) {
  return (
    <motion.div
      variants={cardVariants}
      className={`rounded-[32px] border p-6 sm:p-8 space-y-6 text-left relative overflow-hidden flex flex-col justify-between min-h-[460px] bg-white border-slate-200 shadow-premium dark:bg-slate-900/40 dark:border-white/5 dark:shadow-2xl`}
    >
      <div className="flex items-center justify-between border-b border-white/5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3.5">
          {/* Pulsing Sarah Avatar */}
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-650 to-indigo-650 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-6 h-6 fill-white animate-pulse" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
          </div>
          <div>
            <h3 className={`text-sm font-black leading-none text-content`}>Sarah AI Advisor</h3>
            {/* Glowing recommendation badge */}
            <span className="inline-flex items-center gap-1 text-[8.5px] text-purple-400 font-extrabold uppercase tracking-widest mt-1.5 leading-none">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
              <span>Advice matched to you</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 bg-white/5 border border-white/10 py-1.5 px-3 rounded-full font-bold">
          <Clock className="w-3.5 h-3.5 text-purple-400" />
          <span>Audit Active</span>
        </div>
      </div>

      {/* AI Advisor Speech Block (Memory and Recommendations) */}
      <div className={`p-4.5 rounded-2xl border text-[12px] leading-relaxed font-semibold text-left bg-purple-50/50 border-purple-100 text-slate-700 dark:bg-purple-950/15 dark:border-purple-500/20 dark:text-slate-300`}>
        <p className="flex items-start gap-2">
          <span className="text-purple-400 text-sm mt-0.5">✦</span>
          <span>
            <strong>Sarah AI prepared:</strong> Based on your profile and family priorities, I have audited your active coverages. Your Supreme Health Shield is fully locked, but we detected a key coverage gap in your vehicle assets.
          </span>
        </p>
      </div>

      {/* Chat messages */}
      <div className="flex-grow my-2 overflow-y-auto space-y-4 max-h-[200px] pr-2 text-left">
        {chatMessages.map((msg) => {
          const isAI = msg.sender === "ai";
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${isAI ? "mr-auto text-left" : "ml-auto flex-row-reverse text-right"}`}
            >
              <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-xs ${
                isAI ? "bg-purple-650/20 text-purple-300 border border-purple-500/20" : "bg-purple-650 text-white"
              }`}>
                {isAI ? "S" : "U"}
              </div>
              <div className={`p-4 rounded-2xl text-[12px] leading-relaxed font-semibold ${
                isAI
                  ? ("bg-slate-50 border border-slate-150 text-slate-700 dark:bg-white/[0.02] dark:border dark:border-white/5 dark:text-slate-300")
                  : "bg-purple-650 text-white shadow-sm"
              }`}>
                {msg.text}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-3 max-w-[80%] mr-auto">
            <div className="w-8 h-8 rounded-lg bg-purple-650/20 text-purple-300 border border-purple-500/20 flex items-center justify-center font-bold text-xs">
              S
            </div>
            <div className={`p-4 rounded-2xl flex items-center gap-1.5 shadow-sm border bg-slate-50 border-slate-150 dark:bg-white/[0.02] dark:border-white/5`}>
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat input controls */}
      <form onSubmit={handleSendMessage} className={`flex gap-2 border rounded-2xl p-2.5 flex-shrink-0 transition-colors duration-300 bg-slate-100 border-slate-200 dark:bg-white/[0.02] dark:border-white/10`}>
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask Sarah about coverage limits, vehicle riders, or claims matching..."
          className={`flex-1 bg-transparent px-3 outline-none text-[12px] font-semibold text-navy-950 placeholder-slate-400 dark:text-white dark:placeholder-slate-500`}
        />
        <button
          type="submit"
          className="bg-purple-650 hover:bg-purple-600 text-white py-2 px-4.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-purple-500/20 shadow-glow"
        >
          <span>Ask</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </form>
    </motion.div>
  );
}
