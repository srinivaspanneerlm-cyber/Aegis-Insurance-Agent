"use client";
import { useState, useCallback, useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoiceState = "idle" | "requesting" | "listening" | "processing" | "speaking" | "error";

export interface VoiceOptions {
  language?: string;
  rate?: number;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onSpeakEnd?: () => void;
}

export interface VoiceHook {
  voiceState: VoiceState;
  transcript: string;
  error: string | null;
  isSpeaking: boolean;
  isListening: boolean;
  volume: number;           // 0–1 for waveform bars
  startListening: () => Promise<void>;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  retryAfterError: () => void;
}

// ── Minimal Web Speech API types ────────────────────────────────────────────────
// The Speech Recognition API is not part of the standard TS DOM lib, so the
// shapes the browser hands us are declared here instead of falling back to `any`.

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVoice(options: VoiceOptions = {}): VoiceHook {
  const { language = "en-IN", rate = 0.93, onTranscript, onSpeakEnd } = options;

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const rafRef         = useRef<number>(0);

  // ── Volume analyser (waveform data) ───────────────────────────────────────
  const _startVolumeAnalysis = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.slice(0, data.length / 2).reduce((a, b) => a + b, 0) / (data.length / 2);
        setVolume(Math.min(1, avg / 90));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      /* AudioContext not available in some environments */
    }
  }, []);

  const _stopVolumeAnalysis = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
    setVolume(0);
  }, []);

  // ── Start listening ────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (voiceState === "listening" || voiceState === "speaking") return;
    setError(null);
    setTranscript("");
    setVoiceState("requesting");

    // Check browser support
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition is not supported in this browser. Try Chrome.");
      setVoiceState("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      _startVolumeAnalysis(stream);

      const rec = new SR();
      rec.lang = language;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      recognitionRef.current = rec;

      rec.onstart = () => setVoiceState("listening");

      rec.onresult = (e: SpeechRecognitionEventLike) => {
        let text = "";
        let isFinal = false;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          text = e.results[i][0].transcript;
          isFinal = e.results[i].isFinal;
        }
        setTranscript(text);
        onTranscript?.(text, isFinal);
      };

      rec.onerror = (e: SpeechRecognitionErrorEventLike) => {
        // aborted fires when we call rec.stop() manually — not a real error
        if (e.error === "aborted") return;

        const msg =
          e.error === "not-allowed" || e.error === "service-not-allowed"
            ? "Mic blocked — allow microphone in browser settings."
            : e.error === "network"
            ? "Voice needs internet. Check your connection and try again."
            : e.error === "audio-capture"
            ? "Microphone not found or in use by another app."
            : e.error === "no-speech"
            ? "No speech detected. Tap mic and speak."
            : "Voice unavailable. Try again.";
        setError(msg);
        setVoiceState("error");
        _stopVolumeAnalysis();
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      rec.onend = () => {
        _stopVolumeAnalysis();
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        recognitionRef.current = null;
        setVoiceState(prev => prev === "listening" ? "idle" : prev);
      };

      rec.start();
    } catch (err) {
      const name = (err as DOMException)?.name;
      const msg =
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Mic blocked — allow microphone in browser settings."
          : name === "NotFoundError"
          ? "No microphone found. Plug one in and try again."
          : "Could not access microphone.";
      setError(msg);
      setVoiceState("error");
    }
  }, [voiceState, language, onTranscript, _startVolumeAnalysis, _stopVolumeAnalysis]);

  // ── Stop listening ─────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    _stopVolumeAnalysis();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setVoiceState("idle");
  }, [_stopVolumeAnalysis]);

  // ── TTS speak ─────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    // Clean text: remove JSON tags, markdown, limit length
    const clean = text
      .replace(/\[RECOMMENDATION:\{[\s\S]*?\}\]/g, "")
      .replace(/[#*_`~>]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .slice(0, 1500)
      .trim();

    if (!clean) return;

    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = language;
    utt.rate = rate;
    utt.pitch = 1.0;
    utt.volume = 1.0;

    // Pick a high-quality local voice
    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(v => v.lang.startsWith("en") && v.localService && v.name.toLowerCase().includes("female")) ||
        voices.find(v => v.lang.startsWith("en") && v.localService) ||
        voices.find(v => v.lang.startsWith("en"));
      if (preferred) utt.voice = preferred;
    };

    // Voices may not be loaded yet
    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = () => { loadVoice(); };
    }

    utt.onstart  = () => { setIsSpeaking(true); setVoiceState("speaking"); };
    utt.onend    = () => { setIsSpeaking(false); setVoiceState("idle"); onSpeakEnd?.(); };
    utt.onerror  = () => { setIsSpeaking(false); setVoiceState("idle"); };

    window.speechSynthesis.speak(utt);
  }, [language, rate, onSpeakEnd]);

  // ── Stop speaking ──────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setVoiceState("idle");
  }, []);

  // ── Retry after error ──────────────────────────────────────────────────────
  const retryAfterError = useCallback(() => {
    setError(null);
    setVoiceState("idle");
    setTranscript("");
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      _stopVolumeAnalysis();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [_stopVolumeAnalysis]);

  return {
    voiceState,
    transcript,
    error,
    isSpeaking,
    isListening: voiceState === "listening",
    volume,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    retryAfterError,
  };
}
