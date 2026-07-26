"use client";

import { RefObject } from "react";
import { ShieldCheck, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  chatBgClass, advisorBubbleClass, userBubbleClass, inputClass,
} from "./contactTheme";
import type { ChatMessage } from "./useContactChat";

interface VaultChatRoomProps {
  isChatOpen: boolean;
  toggleChat: () => void;
  messages: ChatMessage[];
  isTyping: boolean;
  inputVal: string;
  setInputVal: (value: string) => void;
  handleSendMessage: (e?: React.FormEvent, customMsg?: string) => void;
  chatEndRef: RefObject<HTMLDivElement | null>;
  chatConsoleRef: RefObject<HTMLDivElement | null>;
}

/** Collapsible "secure room" chat console with Sri AI. */
export function VaultChatRoom({
  isChatOpen, toggleChat, messages, isTyping,
  inputVal, setInputVal, handleSendMessage, chatEndRef, chatConsoleRef,
}: VaultChatRoomProps) {
  const advisorBubble = advisorBubbleClass;

  return (
    <section ref={chatConsoleRef} className="relative px-6 py-12 z-10">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={toggleChat}
            className={`py-2 px-5 rounded-full border text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
              isChatOpen
                ? "bg-purple-650 border-purple-500 text-white shadow-glow"
                : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
            }`}
          >
            {isChatOpen ? "Close Secure Room" : "Open Secure Room"}
          </button>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Direct Link to Core Intel</span>
          </div>
        </div>

        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.3 }}
              className={`rounded-[32px] border overflow-hidden flex flex-col ${chatBgClass}`}
            >
              {/* Console header */}
              <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-650 to-cyan-500 flex items-center justify-center font-black text-white shadow-lg text-sm">
                    S
                  </div>
                  <div className="text-left leading-none">
                    <h3 className="text-sm font-black text-white">Sri AI</h3>
                    <span className="text-[9px] text-purple-400 font-extrabold uppercase tracking-widest block mt-1">
                      Chief Executive AI Advisor
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-glow" />
                  <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider">Telemetry Secure</span>
                </div>
              </div>

              {/* Messages streams scrollable */}
              <div className="p-6 overflow-y-auto space-y-6 max-h-[380px] min-h-[300px] text-left">
                {messages.map((m, idx) => {
                  const isUser = m.sender === "user";
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isUser ? "justify-end" : "justify-start"} items-start gap-3`}
                    >
                      {!isUser && (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-650 to-cyan-500 flex items-center justify-center font-black text-white text-xs flex-shrink-0 mt-0.5">
                          S
                        </div>
                      )}
                      <div className="max-w-[80%] space-y-1">
                        <div className={`p-4 rounded-[22px] border text-xs font-semibold leading-relaxed whitespace-pre-line shadow-sm ${
                          isUser ? userBubbleClass : advisorBubble
                        }`}>
                          {m.text}
                        </div>
                        <span className="text-[9px] text-slate-500 block px-2 leading-none">
                          {m.timestamp}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Typing thinking state */}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-650 to-cyan-500 flex items-center justify-center font-black text-white text-xs flex-shrink-0 mt-0.5">
                      S
                    </div>
                    <div className="space-y-1">
                      <div className={`p-4 rounded-[22px] border text-xs font-bold leading-normal italic flex items-center gap-3 ${advisorBubble}`}>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-0" />
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-150" />
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-300" />
                        </div>
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[9.5px] animate-pulse">
                          Connecting you to the executive advisor...
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Footer chat console input */}
              <div className="p-4 border-t border-white/5 bg-slate-900/10">
                <form onSubmit={handleSendMessage} className="flex gap-3">
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="Ask Sri AI about vault clearance, platform workflows..."
                    className={`flex-grow py-3 px-4 rounded-xl border outline-none text-xs font-semibold transition-all ${inputClass}`}
                  />
                  <button
                    type="submit"
                    className="py-3 px-6 rounded-xl bg-purple-650 hover:bg-purple-600 text-white font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-1.5 transition-all border border-purple-500/20 cursor-pointer"
                  >
                    <span>Transmit</span>
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </section>
  );
}
