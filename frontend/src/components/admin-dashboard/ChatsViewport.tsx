"use client";

import { motion } from "framer-motion";
import { MessagesSquare } from "lucide-react";
import type { ChatLog } from "@/types/domain";
import { EmptyState } from "@/components/ui";

/** Archived AI dialogue history inspector (nav: "chats"). */
export function ChatsViewport({ chats }: { chats: ChatLog[] }) {
  return (
    <motion.div
      key="chats"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="bg-slate-900/60 border border-cyan-500/20 rounded-[32px] p-6 sm:p-8 space-y-6"
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className="font-extrabold text-white text-base">Archived Dialogue History</h3>
        <p className="text-xs text-slate-400 mt-1 font-semibold">Active LLM underwriter interaction packets inspected for security.</p>
      </div>

      <div className="space-y-4">
        {chats.length > 0 ? (
          chats.map((c, idx) => (
            <div key={idx} className="p-5 bg-slate-950 border border-white/5 rounded-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-[10px] text-cyan-400 font-extrabold font-mono">PACKET-ID: #{c.id || idx + 101}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{new Date(c.createdAt || Date.now()).toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                <span className="text-cyan-400 font-black">User Context:</span> &quot;{c.message || c.text}&quot;
              </p>
              {c.advisorMessage && (
                <p className="text-xs text-purple-300 leading-relaxed font-semibold">
                  <span className="text-purple-400 font-black">Advisor Response:</span> &quot;{c.advisorMessage.message || c.advisorMessage.text}&quot;
                </p>
              )}
            </div>
          ))
        ) : (
          <EmptyState
            icon={<MessagesSquare className="w-6 h-6" />}
            title="No dialogues logged"
            description="No AI conversations have been recorded in the current telemetry session yet."
          />
        )}
      </div>
    </motion.div>
  );
}
