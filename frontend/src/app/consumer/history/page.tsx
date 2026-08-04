"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ArrowLeft, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { chatService } from "@/services/api";
import { ChatLog } from "@/types/domain";
import { EmptyState } from "@/components/ui";

export default function ConsumerHistoryPage() {
  const { isReady } = useRequireAuth();

  const router = useRouter();
  const [history, setHistory] = useState<ChatLog[]>([]);

  useEffect(() => {
    async function loadChatHistory() {
      try {
        const data = await chatService.getHistory();
        if (data && data.length > 0) setHistory(data);
      } catch {
        logger.warn("Failed to load historical chats. Seed placeholder data.");
        setHistory([
          { id: "1", message: "Suggest a smart auto shield plan", createdAt: new Date(Date.now() - 3600 * 2000).toISOString(), advisorMessage: { message: "For your vehicle protection, the Aegis Smart Auto Shield locks in zero-depreciation coverage and 24/7 recovery." } }
        ]);
      }
    }
    loadChatHistory();
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <Navbar />
        <main id="main-content">
        <div className="flex-grow flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-purple-650 border-t-transparent rounded-full animate-spin" />
        </div>
        </main>
        <Footer />
      </div>
    );
  }

  const wrapperClass = "bg-surface text-content";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />
      <main id="main-content">

      <section className="relative pt-36 pb-24 flex-grow flex items-center justify-center z-10 text-left">
        <div className="max-w-3xl w-full mx-auto px-6">
          <button 
            onClick={() => router.push("/consumer-dashboard")}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-purple-400 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>

          <div className="space-y-8">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 text-purple-400 bg-purple-950/30 border border-purple-800/40 py-1 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                <span>Underwriting Dialogues</span>
              </span>
              <h2 className="text-3xl font-black text-white">Consultation Log history</h2>
              <p className="text-xs text-slate-400 font-semibold max-w-lg">
                Inspect archived conversations logged during personalized risk evaluation matching.
              </p>
            </div>

            <div className="space-y-4">
              {history.length === 0 && (
                <EmptyState
                  icon={<Clock className="w-6 h-6" />}
                  title="No consultations yet"
                  description="Once you talk to an Aegis advisor, your conversation history will appear here."
                />
              )}
              {history.map((h, idx) => (
                <div key={idx} className="p-6 bg-slate-900/60 border border-white/5 rounded-3xl text-left space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-[10px] text-purple-400 font-extrabold font-mono">CONVERSATION-ID: #{h.id || idx + 101}</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{new Date(h.createdAt ?? Date.now()).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    <span className="text-purple-400 font-black">Your Context:</span> &quot;{h.message}&quot;
                  </p>
                  {h.advisorMessage && (
                    <p className="text-xs text-cyan-300 leading-relaxed font-semibold">
                      <span className="text-cyan-400 font-black">Aegis Response:</span> &quot;{h.advisorMessage.message || h.advisorMessage.text}&quot;
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}
