"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceRuntime, type VoiceRuntime } from "@/hooks/useVoiceRuntime";
import VoiceEngine from "@/components/VoiceEngine";
import { AgentBadge } from "@/components/brand";
import {
  matchWakePhrase,
  greetingFor,
  hasGreetedThisSession,
  markGreetedThisSession,
} from "@/lib/wakeGreeting";
import { VOICE_TRANSCRIPTION } from "@/lib/config";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { recordingUnavailableMessage } from "@/lib/voiceSupport";

function currentSessionId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEYS.SESSION_ID) || "";
}

/** What the widget's one status line says, driven entirely off the runtime's
 * own state rather than a second copy of it. */
function statusLabel(runtime: VoiceRuntime): string {
  if (runtime.turnState === "ERROR") return "Mic trouble — tap to try again";
  if (runtime.hardwareState === "requesting") return "Enable your mic to begin";
  if (runtime.isListening) return "Listening — say “Hello Aegis”";
  if (runtime.isSpeaking) return "Aegis is speaking";
  if (runtime.isBusy) return "One moment…";
  return "Say “Hello Aegis” to begin";
}

/**
 * The home page's voice entry point: the mic opens on its own when the page
 * loads, recognises "Hello Aegis", answers with a short self-introduction,
 * and hands anything more — "...I need motor insurance for my car" — to the
 * real conversation on `/advisor`, same session, rather than growing a
 * second chat surface here.
 *
 * Not a second voice layer. `useVoiceRuntime` is designed to be composed per
 * surface — `/advisor` already owns one instance — and this one drives no
 * transport of its own either: a bare wake phrase is answered with
 * `startSpeaking`, the same control the existing replay button already uses
 * outside a turn, and anything with real content is handed to the one
 * existing send path by navigating into it, never re-implemented here.
 */
export function VoiceGreeting() {
  const runtimeRef = useRef<VoiceRuntime | null>(null);

  const handleWrappedSubmit = useCallback((text: string) => {
    const sessionId = currentSessionId();
    const { isWake, remainder, tamil } = matchWakePhrase(text);

    if (isWake && !remainder) {
      if (hasGreetedThisSession(sessionId)) {
        // A second bare "Hello Aegis" in the same session — nothing new was
        // asked, so reopen listening instead of repeating the introduction.
        runtimeRef.current?.reset();
        return;
      }
      markGreetedThisSession(sessionId);
      runtimeRef.current?.startSpeaking(greetingFor(tamil));
      return;
    }

    if (isWake) markGreetedThisSession(sessionId);
    const content = isWake ? remainder : text;
    if (typeof window === "undefined") return;
    try {
      // `tamil` rides along so /advisor can mark this turn `spoken: true`
      // (and, weakly, its language) even though it never went through that
      // page's own `useVoiceRuntime` — see the handoff effect there for why
      // that marker is what makes the reply come back worded for the ear and
      // actually get read aloud, not just answered in text.
      sessionStorage.setItem(STORAGE_KEYS.VOICE_HANDOFF, JSON.stringify({ text: content, tamil }));
    } catch {
      // Best-effort — worst case the handoff carries no text and the
      // customer repeats themselves once, typed or spoken, on /advisor.
    }
    window.location.href = "/advisor?voiceHandoff=1";
  }, []);

  const runtime = useVoiceRuntime({
    onSubmit: handleWrappedSubmit,
    sessionId: currentSessionId(),
    transcription: VOICE_TRANSCRIPTION,
  });
  runtimeRef.current = runtime;

  // Checked once: whether this browser can even record. Server transcription
  // means the recogniser itself is no longer the hard stop — `getUserMedia`
  // is — so this is the one thing worth knowing before showing a mic that
  // can never work. Anything narrower (denied permission, no speech heard)
  // is already surfaced live by `VoiceEngine` off the runtime's own state.
  const [unsupported] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
      return null;
    }
    return recordingUnavailableMessage();
  });

  // Genuinely hands-free: the mic opens on its own once, on load, rather than
  // waiting for a tap — this page has no other reason to ask for the
  // microphone, so "ready" here means actually listening, not merely armed.
  // The consent boundary that matters is still intact: this only *calls*
  // `startListening`, which still goes through the browser's own permission
  // prompt the first time, and does nothing at all once denied — no retry
  // loop, no second attempt. `getUserMedia` needs no click to be invoked; the
  // gesture requirement in the DOM spec is for audio *autoplay*, not capture.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current || unsupported) return;
    autoStartedRef.current = true;
    void runtimeRef.current?.startListening();
  }, [unsupported]);

  // Bottom-*left*, deliberately not the bottom-right corner: `FloatingAI`
  // (`layout.tsx`, every page) already owns `fixed bottom-6 right-6 z-50` for
  // its own "Talk with AI" launcher. Sharing that corner put this widget
  // underneath it — reachable by nothing, which is exactly what it looked
  // like from the outside: the mic appeared to do nothing at all.
  if (unsupported) {
    return (
      <div className="fixed bottom-6 left-6 z-40 max-w-[16rem] px-4 py-3 rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl shadow-xl text-xs text-white/50">
        {unsupported}
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-40 flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl shadow-xl">
      <AgentBadge agent="aegis" size={40} showLabel={false} speaking={runtime.isSpeaking} thinking={runtime.isBusy} />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
        {statusLabel(runtime)}
      </span>
      <VoiceEngine runtime={runtime} agentDomain="executive" />
    </div>
  );
}
