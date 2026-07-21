"use client";

import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import type { DashboardMessage } from "./types";

interface AdvisorViewportProps {
  chatMessages: DashboardMessage[];
  isTyping: boolean;
  chatInput: string;
  setChatInput: (value: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
}

/** Full-width AI consultant chat (nav: "advisor"). */
export function AdvisorViewport({
  chatMessages, isTyping, chatInput, setChatInput, handleSendMessage,
}: AdvisorViewportProps) {
  return (
    <motion.div
      key="advisor"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className={`border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 bg-white border-slate-200 dark:bg-slate-900/40 dark:border-white/5`}
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className={`font-black text-base text-content`}>Aegis Premium AI Consultant</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">Empathetic underwriter intelligence matching risk packages automatically.</p>
      </div>

      <div className={`border rounded-3xl p-6 min-h-[380px] flex flex-col justify-between bg-slate-50 border-slate-150 dark:bg-white/[0.01] dark:border-white/5`}>
        <div className="flex-grow space-y-5 overflow-y-auto max-h-[250px] pr-2 mb-6">
          {chatMessages.map((msg) => {
            const isAI = msg.sender === "ai";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${isAI ? "mr-auto text-left" : "ml-auto flex-row-reverse text-right"}`}
              >
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-xs ${
                  isAI ? "bg-purple-650/20 text-purple-300 border border-purple-500/20" : "bg-purple-600 text-white"
                }`}>
                  {isAI ? "S" : "U"}
                </div>
                <div className={`p-4 rounded-2xl text-[12px] leading-relaxed font-semibold ${
                  isAI
                    ? ("bg-white border border-slate-200 text-slate-700 shadow-sm dark:bg-white/[0.02] dark:border dark:border-white/5 dark:text-slate-350 dark:shadow-sm")
                    : "bg-purple-650 text-white"
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex gap-3 max-w-[80%] mr-auto">
              <div className="w-8 h-8 rounded-lg bg-purple-650/20 border border-purple-500/20 flex items-center justify-center font-bold text-xs text-purple-300">
                S
              </div>
              <div className={`p-4 rounded-2xl flex items-center gap-1.5 shadow-sm border bg-white border border-slate-200 dark:bg-white/[0.02] dark:border-white/5`}>
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} className={`flex gap-2 border rounded-2xl p-2.5 bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10`}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask Aegis about life legacy cover, auto shields, or health extensions..."
            className={`flex-1 bg-transparent px-3 outline-none text-[12px] font-semibold text-navy-950 placeholder-slate-400 dark:text-white dark:placeholder-slate-500`}
          />
          <button
            type="submit"
            className="bg-purple-650 hover:bg-purple-600 text-white py-2.5 px-5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-purple-500/20"
          >
            <span>Transmit Message</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
