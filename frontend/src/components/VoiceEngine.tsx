"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, RotateCcw, Loader2 } from "lucide-react";
import { useVoice } from "@/hooks/useVoice";

// ── Props ──────────────────────────────────────────────────────────────────────
interface VoiceEngineProps {
  onFinalTranscript: (text: string) => void;
  speakText?: string | null;
  onSpeakEnd?: () => void;
  agentDomain?: string;
  disabled?: boolean;
  autoSpeak?: boolean;
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
  onFinalTranscript,
  speakText,
  onSpeakEnd,
  agentDomain = "health",
  disabled = false,
  autoSpeak = false,
}: VoiceEngineProps) {
  const accent = DOMAIN_ACCENT[agentDomain] || DOMAIN_ACCENT.health;

  // Animated waveform bars (randomised when listening/speaking)
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0));
  const barTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const voice = useVoice({
    language: "en-IN",
    rate: 0.93,
    onTranscript: (text, isFinal) => {
      if (isFinal && text.trim()) {
        onFinalTranscript(text.trim());
      }
    },
    onSpeakEnd,
  });

  // Animate waveform bars when listening or speaking
  useEffect(() => {
    const active = voice.isListening || voice.isSpeaking;
    if (active) {
      barTimerRef.current = setInterval(() => {
        setBars(prev =>
          prev.map((_, i) => {
            const center = Math.abs(i - BAR_COUNT / 2);
            const envelope = Math.max(0, 1 - center / (BAR_COUNT / 2));
            const noise = voice.isListening
              ? voice.volume * 0.7 + Math.random() * 0.3
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
  }, [voice.isListening, voice.isSpeaking, voice.volume]);

  // Auto-speak when speakText changes
  useEffect(() => {
    if (autoSpeak && speakText) {
      voice.speak(speakText);
    }
  }, [speakText, autoSpeak]);

  const handleMicClick = () => {
    if (disabled) return;
    if (voice.isListening) {
      voice.stopListening();
    } else if (voice.isSpeaking) {
      voice.stopSpeaking();
    } else {
      voice.startListening();
    }
  };

  const active = voice.isListening || voice.isSpeaking;

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
        {voice.transcript && voice.isListening && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-0 mb-2 max-w-[220px] px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white/60 truncate backdrop-blur-md shadow-xl"
          >
            {voice.transcript}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {voice.error && voice.voiceState === "error" && (
          <motion.div
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-[10px] text-red-400 max-w-[140px] leading-tight"
          >
            {voice.error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main control button */}
      <AnimatePresence mode="wait">
        {voice.voiceState === "requesting" ? (
          <motion.div
            key="requesting"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
          >
            <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
          </motion.div>

        ) : voice.voiceState === "speaking" ? (
          <motion.button
            key="speaking"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={() => voice.stopSpeaking()}
            title="Stop speaking"
            className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center hover:bg-rose-500/25 transition-colors"
          >
            <VolumeX className="w-4 h-4" />
          </motion.button>

        ) : voice.voiceState === "error" ? (
          <motion.button
            key="error"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={voice.retryAfterError}
            title="Retry microphone"
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${accent.errBtn}`}
          >
            <RotateCcw className="w-4 h-4" />
          </motion.button>

        ) : voice.isListening ? (
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

      {/* Manual speak button (shown if not auto-speaking) */}
      {!autoSpeak && speakText && !voice.isSpeaking && (
        <AnimatePresence>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => voice.speak(speakText)}
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
