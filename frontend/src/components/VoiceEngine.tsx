"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, RotateCcw, Loader2 } from "lucide-react";
import type { VoiceRuntime } from "@/hooks/useVoiceRuntime";

// ── Props ──────────────────────────────────────────────────────────────────────
/**
 * Presentational only. The microphone, the recogniser and the speaker are owned
 * by `useVoiceRuntime` on the advisor page, because the page is where the send
 * path and the stream already live — a turn cannot be sequenced from inside a
 * button. This component draws that runtime and calls its controls.
 */
interface VoiceEngineProps {
  runtime: VoiceRuntime;
  /** The latest advisor reply, offered for replay. Hidden while it is playing. */
  speakText?: string | null;
  agentDomain?: string;
  disabled?: boolean;
}

// ── Domain accent colors ───────────────────────────────────────────────────────
const DOMAIN_ACCENT: Record<string, { bar: string; ring: string; btn: string; errBtn: string }> = {
  health:         { bar: "bg-emerald-400", ring: "border-emerald-500/50 shadow-emerald-500/20", btn: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25", errBtn: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400" },
  motor:          { bar: "bg-blue-400",    ring: "border-blue-500/50 shadow-blue-500/20",       btn: "bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25",             errBtn: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400" },
  travel:         { bar: "bg-violet-400",  ring: "border-violet-500/50 shadow-violet-500/20",   btn: "bg-violet-500/15 border-violet-500/30 text-violet-400 hover:bg-violet-500/25",     errBtn: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400" },
  "home-property":{ bar: "bg-amber-400",   ring: "border-amber-500/50 shadow-amber-500/20",     btn: "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25",         errBtn: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400" },
  miscellaneous:  { bar: "bg-rose-400",    ring: "border-rose-500/50 shadow-rose-500/20",       btn: "bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25",             errBtn: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400" },
  executive:      { bar: "bg-rose-400",    ring: "border-rose-500/50 shadow-rose-500/20",       btn: "bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25",             errBtn: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400" },
};

const BAR_COUNT = 24;

// ── Component ─────────────────────────────────────────────────────────────────

export default function VoiceEngine({
  runtime,
  speakText,
  agentDomain = "health",
  disabled = false,
}: VoiceEngineProps) {
  const accent = DOMAIN_ACCENT[agentDomain] || DOMAIN_ACCENT.health;

  // Animated waveform bars (randomised when listening/speaking)
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0));
  const barTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate waveform bars when listening or speaking
  useEffect(() => {
    const active = (runtime.isListening && !runtime.isTranscribing) || runtime.isSpeaking;
    if (active) {
      barTimerRef.current = setInterval(() => {
        setBars(prev =>
          prev.map((_, i) => {
            const center = Math.abs(i - BAR_COUNT / 2);
            const envelope = Math.max(0, 1 - center / (BAR_COUNT / 2));
            const noise = runtime.isListening
              ? runtime.volume * 0.7 + Math.random() * 0.3
              : 0.4 + Math.random() * 0.4;
            return noise * envelope;
          })
        );
      }, 70);
    } else {
      if (barTimerRef.current) clearInterval(barTimerRef.current);
      setBars(Array(BAR_COUNT).fill(0));
    }
    return () => { if (barTimerRef.current) clearInterval(barTimerRef.current); };
  }, [runtime.isListening, runtime.isSpeaking, runtime.isTranscribing, runtime.volume]);

  // Replying out loud is the runtime's decision, not this component's: it reads
  // a spoken turn back automatically and leaves a typed one silent. Nothing is
  // auto-played from here.

  const handleMicClick = () => {
    if (disabled) return;
    if (runtime.isListening) {
      // "I'm done", not "cancel". In browser mode `endTurn` *is* `stopListening`
      // — the recogniser owns its own utterance boundaries there — so this is
      // unchanged for Chrome. With the server transcribing, it is what sends
      // the recording, and tapping stop discarding a whole sentence would be
      // the wrong reading of that button.
      runtime.endTurn();
    } else if (runtime.isSpeaking) {
      runtime.stopSpeaking();
    } else {
      void runtime.startListening();
    }
  };

  const active = (runtime.isListening && !runtime.isTranscribing) || runtime.isSpeaking;

  return (
    <div className="flex items-center gap-2 relative">

      {/* Live waveform bars */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-[2px] h-8 overflow-hidden"
          >
            {bars.map((h, i) => (
              <motion.div
                key={i}
                className={`w-[2px] rounded-full ${accent.bar}`}
                animate={{ height: `${Math.max(3, h * 26)}px`, opacity: 0.6 + h * 0.4 }}
                transition={{ duration: 0.07, ease: "easeOut" }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interim transcript preview */}
      <AnimatePresence>
        {runtime.transcript && runtime.isListening && !runtime.isTranscribing && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-0 mb-2 max-w-[220px] px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white/60 truncate backdrop-blur-md shadow-xl"
          >
            {runtime.transcript}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Why voice stopped. Floated above the composer like the interim
          transcript rather than sitting inside the row: these messages name a
          cause and a way out, and the 140px sliver this used to be squeezed
          them into an unreadable three-line smear that also shrank the input. */}
      <AnimatePresence>
        {runtime.error && (runtime.turnState === "ERROR" || runtime.isRecovering) && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-0 mb-2 w-[min(22rem,70vw)] px-3 py-2 rounded-xl bg-slate-900/95 border border-red-500/30 text-xs leading-snug text-red-300 backdrop-blur-md shadow-xl"
          >
            {runtime.error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main control button */}
      <AnimatePresence mode="wait">
        {runtime.isTranscribing ? (
          <motion.div
            key="transcribing"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            role="status"
            aria-label="Transcribing what you said"
            title="Transcribing…"
            className={`w-9 h-9 rounded-xl border flex items-center justify-center ${accent.btn}`}
          >
            {/* The seconds an upload takes are silent and invisible otherwise,
                and a customer who sees nothing happen assumes the mic failed
                and speaks again — which is how one question becomes two. */}
            <Loader2 className="w-4 h-4 animate-spin" />
          </motion.div>

        ) : runtime.hardwareState === "requesting" ? (
          <motion.div
            key="requesting"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
          >
            <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
          </motion.div>

        ) : runtime.isRecovering ? (
          <motion.div
            key="recovering"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            role="status"
            aria-label="Reconnecting"
            title="Reconnecting…"
            className={`w-9 h-9 rounded-xl border flex items-center justify-center ${accent.errBtn}`}
          >
            {/* A transient failure clearing itself — no button, nothing for the
                customer to acknowledge, unlike the hard `ERROR` state below. */}
            <Loader2 className="w-4 h-4 animate-spin" />
          </motion.div>

        ) : runtime.isSpeaking ? (
          <motion.button
            key="speaking"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            // Cutting in, not just stopping. Tapping the microphone while the
            // advisor is talking is a customer saying "wait — let me speak",
            // and making them tap twice for that is the friction voice was
            // supposed to remove. The advisor is silenced before the mic
            // opens, never alongside it.
            onClick={() => void runtime.interruptAndListen()}
            title="Interrupt and speak"
            className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center hover:bg-rose-500/25 transition-colors"
          >
            <VolumeX className="w-4 h-4" />
          </motion.button>

        ) : runtime.turnState === "ERROR" ? (
          <motion.button
            key="error"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={runtime.reset}
            title="Retry microphone"
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${accent.errBtn}`}
          >
            <RotateCcw className="w-4 h-4" />
          </motion.button>

        ) : runtime.isListening ? (
          <motion.button
            key="listening"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={handleMicClick}
            className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center relative shadow-lg ${accent.ring}`}
          >
            {/* Pulsing ring */}
            <motion.div
              className={`absolute inset-0 rounded-xl border-2 ${accent.ring.split(" ")[0]}`}
              animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            <MicOff className="w-4 h-4 text-white relative z-10" />
          </motion.button>

        ) : (
          <motion.button
            key="idle"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={handleMicClick}
            disabled={disabled}
            title="Click to speak"
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
              disabled
                ? "bg-white/3 border-white/5 text-white/20 cursor-not-allowed"
                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
            }`}
          >
            <Mic className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Replay the last reply. Hidden while it is already playing, while the
          mic is open, and while a turn is in flight — clicking it during a
          dispatch would consume the transition the incoming reply needs. */}
      {speakText && !runtime.isBusy && runtime.can("START_SPEAKING") && (
        <AnimatePresence>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => runtime.startSpeaking(speakText)}
            title="Play advisor response"
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${accent.btn}`}
          >
            <Volume2 className="w-4 h-4" />
          </motion.button>
        </AnimatePresence>
      )}
    </div>
  );
}
