"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  readBrowserVoiceFacts,
  recordingUnavailableMessage,
  speechErrorMessage,
  unsupportedBrowserMessage,
} from "@/lib/voiceSupport";
import {
  RECORDING_TIMESLICE_MS,
  canRecordAudio,
  pickRecordingMimeType,
} from "@/lib/audioCapture";
import { sanitizeForSpeech } from "@/lib/speech";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoiceState = "idle" | "requesting" | "listening" | "processing" | "speaking" | "error";

export interface VoiceOptions {
  language?: string;
  rate?: number;
  onTranscript?: (text: string, isFinal: boolean) => void;
  /**
   * Keep the recogniser open across pauses instead of letting the browser close
   * the utterance on its own endpointing. Set when something else — the VAD in
   * `lib/vad` — owns the end of the turn. Left off, the previous behaviour is
   * unchanged.
   */
  continuous?: boolean;
  onSpeakEnd?: () => void;
  /**
   * The speech synthesiser failed mid-utterance.
   *
   * Distinct from `onSpeakEnd`, and fired instead of it: without a signal here
   * the caller's pump — which only advances on `onSpeakEnd` — has no way to
   * know the utterance is over, and a turn stays stuck in `SPEAKING` forever
   * with the microphone never reopening. The caller decides what "failed" means
   * for the turn; this hook only reports the fact.
   */
  onSpeakError?: () => void;
  /**
   * Who turns the audio into words.
   *
   * `"browser"` is the original path: `SpeechRecognition` listens and
   * transcribes, which works in Chrome and Edge and fails everywhere else —
   * Firefox and Safari have no recogniser, Brave has one with Google's key
   * removed. It stays the default so nothing that already calls this hook
   * changes behaviour.
   *
   * `"server"` records with `MediaRecorder` instead and hands the audio to
   * `onAudio`. No recogniser is touched, so the browser needs nothing beyond a
   * microphone — which is what makes voice work in all four browsers.
   */
  transcription?: "browser" | "server";
  /**
   * A finished recording, in `"server"` mode only. Fired on `flushRecording()`
   * — never on `stopListening()`, which means the customer cancelled and their
   * audio should go nowhere.
   */
  onAudio?: (audio: Blob, mimeType: string) => void;
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
  /**
   * Throw away what has been recorded so far and keep listening.
   *
   * The counterpart to `flushRecording`, for the stretch where the microphone
   * is open only to notice that the customer has started speaking. Nothing
   * captured while the advisor was talking is worth keeping unless they
   * actually cut in, and a reply that runs for a minute must not leave a
   * minute of audio sitting in memory.
   */
  discardRecording: () => void;
  /**
   * Hand over what has been recorded so far and keep listening.
   *
   * The end of a turn and the end of the microphone are different events, and
   * conflating them is what forces a second `getUserMedia` — with its permission
   * check and its device warm-up — between one sentence and the next. In
   * `"browser"` mode this does nothing: the recogniser owns its own utterance
   * boundaries there.
   */
  flushRecording: () => void;
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
  const {
    language = "en-IN",
    rate = 0.93,
    continuous = false,
    transcription = "browser",
    onTranscript,
    onAudio,
    onSpeakEnd,
    onSpeakError,
  } = options;
  const serverTranscription = transcription === "server";

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

  // ── Recorder (server transcription only) ──────────────────────────────────
  // Deliberately hung off the *same* MediaStream the analyser already uses.
  // Asking for a second one would mean a second `getUserMedia`, a second device
  // handle, and on some hardware a second permission prompt — for audio the
  // browser is already delivering.
  const recorderRef   = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<BlobPart[]>([]);
  const recorderMimeRef = useRef<string>("");
  // What to do with the chunks when the recorder next stops. `discard` is the
  // default because the dangerous mistake is emitting audio the customer meant
  // to cancel, not dropping audio they meant to send.
  const flushIntentRef = useRef<"discard" | "emit" | "recycle">("discard");
  const onAudioRef = useRef(onAudio);
  onAudioRef.current = onAudio;

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

  // ── Recording ─────────────────────────────────────────────────────────────

  /**
   * Assemble what has been captured and hand it over, then clear the buffer.
   *
   * An empty recording is still emitted, as an empty blob. It is tempting to
   * return early instead, but a flush that produces nothing would then leave
   * the caller waiting on audio that never arrives — a spinner that never
   * stops. Handing over the emptiness lets it be recognised and recovered from
   * as the ordinary "we didn't catch that" it is.
   */
  const _emitRecording = useCallback(() => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    const mime = recorderMimeRef.current || "audio/webm";
    onAudioRef.current?.(new Blob(chunks, { type: mime }), mime);
  }, []);

  /**
   * Attach a recorder to a live microphone stream.
   *
   * Returns false when the browser cannot record at all, which is the one case
   * where server transcription has nothing to fall back on — and is vanishingly
   * rare, since `MediaRecorder` is the piece every current browser has.
   */
  const _startRecorder = useCallback((stream: MediaStream): boolean => {
    const Recorder = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
    if (typeof Recorder !== "function") return false;

    const picked = pickRecordingMimeType(
      typeof Recorder.isTypeSupported === "function"
        ? (m: string) => Recorder.isTypeSupported(m)
        : null
    );
    if (picked === null) return false;

    try {
      // An empty pick means "use your own default" — the browser then reports
      // what it actually chose on `.mimeType`, which is what the server is told.
      const recorder = picked ? new Recorder(stream, { mimeType: picked }) : new Recorder(stream);
      recorderMimeRef.current = recorder.mimeType || picked || "audio/webm";
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const intent = flushIntentRef.current;
        flushIntentRef.current = "discard";

        if (intent === "recycle") {
          // Keep listening, keep nothing. Used while the advisor is speaking:
          // the buffer must not grow for the length of a long reply, but the
          // microphone has to stay open to hear the customer cut in.
          chunksRef.current = [];
          const alive = streamRef.current?.getTracks().some((t) => t.readyState === "live");
          if (alive && recorderRef.current === recorder) {
            try { recorder.start(RECORDING_TIMESLICE_MS); } catch { /* stream ended */ }
          }
          return;
        }

        if (intent !== "emit") {
          // Cancelled. The audio is dropped here and never leaves the device.
          chunksRef.current = [];
          return;
        }
        _emitRecording();
        // A flush ends a *turn*, not the microphone: if the stream is still
        // live, start capturing the next one immediately. Without this the
        // customer would have to re-open the mic between every sentence.
        const stillLive = streamRef.current?.getTracks().some((t) => t.readyState === "live");
        if (stillLive && recorderRef.current === recorder) {
          try { recorder.start(RECORDING_TIMESLICE_MS); } catch { /* stream ended between checks */ }
        }
      };

      recorder.onerror = () => {
        setError("Recording stopped unexpectedly. Please try again, or type your question.");
        setVoiceState("error");
      };

      // A timeslice so chunks exist before `stop()` is ever called — some
      // WebKit builds deliver nothing at all when asked for one final blob.
      recorder.start(RECORDING_TIMESLICE_MS);
      recorderRef.current = recorder;
      return true;
    } catch {
      return false;
    }
  }, [_emitRecording]);

  /** Tear the recorder down, dropping anything not already handed over. */
  const _stopRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    flushIntentRef.current = "discard";
    chunksRef.current = [];
    if (!recorder) return;
    try { if (recorder.state !== "inactive") recorder.stop(); } catch { /* already gone */ }
  }, []);

  // ── Start listening ────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (voiceState === "listening" || voiceState === "speaking") return;
    setError(null);
    setTranscript("");
    setVoiceState("requesting");

    // What this browser needs depends on who is transcribing. With the server
    // doing it, `SpeechRecognition` is not consulted at all — which is the
    // whole point: Firefox and Safari never had it, and Brave's is present but
    // permanently broken. All that is required is a microphone and a recorder.
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (serverTranscription) {
      if (!canRecordAudio()) {
        setError(recordingUnavailableMessage());
        setVoiceState("error");
        return;
      }
    } else if (!SR) {
      setError(unsupportedBrowserMessage(readBrowserVoiceFacts()));
      setVoiceState("error");
      return;
    }

    try {
      // Asked for explicitly rather than left to the browser's defaults,
      // because barge-in depends on it. The microphone stays open while the
      // advisor is speaking through the same device's loudspeaker, and without
      // echo cancellation the level meter hears Aegis, decides the customer is
      // talking, and cuts the advisor off mid-sentence on every single reply.
      //
      // All three are requested, not required: a browser or a device that does
      // not offer one of them still yields a usable stream, and the barge-in
      // thresholds in `lib/vad` are set high enough to survive the residue.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      _startVolumeAnalysis(stream);

      if (serverTranscription) {
        if (!_startRecorder(stream)) {
          _stopVolumeAnalysis();
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setError(recordingUnavailableMessage());
          setVoiceState("error");
          return;
        }
        // The mic is open and capturing. There is no recogniser to wait on, so
        // the state moves here rather than in an `onstart` callback.
        setVoiceState("listening");
        return;
      }

      const rec = new SR!();
      rec.lang = language;
      rec.continuous = continuous;
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

        // `network` does not reliably mean the connection is down — see
        // lib/voiceSupport. Blaming a working router here sent someone off to
        // reset it while the real cause was the browser.
        setError(speechErrorMessage(e.error, readBrowserVoiceFacts()));
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
  }, [
    voiceState,
    language,
    continuous,
    serverTranscription,
    onTranscript,
    _startVolumeAnalysis,
    _stopVolumeAnalysis,
    _startRecorder,
  ]);

  // ── Stop listening ─────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    // Cancelling, not finishing: whatever was captured is dropped rather than
    // transcribed. `flushRecording` is the way to end a turn and keep the words.
    _stopRecorder();
    recognitionRef.current?.stop();
    _stopVolumeAnalysis();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setVoiceState("idle");
  }, [_stopVolumeAnalysis, _stopRecorder]);

  // ── Flush the current recording ────────────────────────────────────────────
  const discardRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    flushIntentRef.current = "recycle";
    try {
      recorder.stop();
    } catch {
      flushIntentRef.current = "discard";
    }
  }, []);

  const flushRecording = useCallback(() => {
    const recorder = recorderRef.current;
    // Nothing to flush in browser mode, and nothing to flush if the recorder
    // has already been asked once — a second request before `onstop` lands
    // would emit the same audio twice, which becomes two turns.
    if (!recorder || recorder.state !== "recording") return;
    flushIntentRef.current = "emit";
    try {
      recorder.stop();
    } catch {
      flushIntentRef.current = "discard";
    }
  }, []);

  // ── TTS speak ─────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    // The same rules as before, now in `lib/speech` so a *fragment* can be
    // cleaned too — a sentence spoken while the rest of the reply is still
    // being written never passes through here as a whole reply.
    const clean = sanitizeForSpeech(text);

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
    // Reported instead of `onSpeakEnd`, not alongside it — the caller's pump
    // only advances on one signal, and firing both would double-advance it.
    utt.onerror  = () => { setIsSpeaking(false); setVoiceState("idle"); onSpeakError?.(); };

    window.speechSynthesis.speak(utt);
  }, [language, rate, onSpeakEnd, onSpeakError]);

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
      _stopRecorder();
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      _stopVolumeAnalysis();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [_stopVolumeAnalysis, _stopRecorder]);

  return {
    voiceState,
    transcript,
    error,
    isSpeaking,
    isListening: voiceState === "listening",
    volume,
    startListening,
    stopListening,
    flushRecording,
    discardRecording,
    speak,
    stopSpeaking,
    retryAfterError,
  };
}
