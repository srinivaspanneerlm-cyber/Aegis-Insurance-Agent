/**
 * Aegis AI — the browser's side of server-side transcription.
 *
 * One function, one endpoint, and a deliberate refusal to know which vendor is
 * behind it. The recording goes to the Node backend, which authenticates the
 * customer, rate-limits the paid work and forwards it to the AI engine; the
 * engine's `STT_PROVIDER` decides who transcribes. Nothing in the browser
 * mentions Gemini, Whisper or Groq, so swapping one for another changes no
 * frontend code at all.
 *
 * Written with `fetch` rather than the shared `apiClient` on purpose. That
 * client sets a JSON content type and carries the session-renewal interceptor,
 * neither of which suits a multipart body that may be megabytes — and a
 * transcription that 401s should surface as "your session ended", not silently
 * trigger a renewal and replay a large upload a second time.
 */
import { API_URL } from "@/lib/config";
import {
  baseMimeType,
  isTooLargeToUpload,
  isTooShortToTranscribe,
  recordingFilename,
} from "@/lib/audioCapture";

export interface TranscriptionResult {
  /** Exactly what was said. Sent to the advisor verbatim. */
  transcript: string;
  /**
   * `en-IN`, `ta-IN`, or `ta-en` for Thanglish — a hint, not an instruction.
   * Carried so the UI knows what was heard; the advisor reads the transcript
   * itself, the same way it reads a typed message.
   */
  language: string | null;
  provider: string | null;
}

/**
 * Why a transcription did not happen, in a form the runtime can act on.
 *
 * `kind` separates the two cases that need opposite responses from the
 * customer: `empty` means speak again, everything else means the turn is over
 * and typing is the way through. Collapsing them — which a single generic
 * error would do — is how a customer ends up being told to retype a sentence
 * that was merely too quiet.
 */
export type TranscriptionFailure =
  | "empty"
  | "too-large"
  | "unsupported"
  | "unauthorized"
  | "rate-limited"
  | "timeout"
  | "network"
  | "provider";

export class SpeechToTextError extends Error {
  readonly kind: TranscriptionFailure;
  /** Safe to show as-is. Always names a way forward. */
  readonly userMessage: string;

  constructor(kind: TranscriptionFailure, userMessage: string, detail?: string) {
    super(detail || userMessage);
    this.name = "SpeechToTextError";
    this.kind = kind;
    this.userMessage = userMessage;
  }
}

/** The default sentence for a status we did not anticipate. */
const GENERIC = "We couldn't turn that into words. Please try again, or type your question.";

/**
 * Map a status to a sentence.
 *
 * The server already writes a customer-facing message for the cases it
 * classifies, so that message is preferred when present; these are the floor,
 * for a proxy or gateway that answered instead of the app.
 */
function failureFor(status: number): { kind: TranscriptionFailure; message: string } {
  if (status === 401 || status === 403) {
    return { kind: "unauthorized", message: "Your session ended. Sign in again to use voice." };
  }
  if (status === 413) {
    return { kind: "too-large", message: "That recording is too long. Please keep it short, or type your question." };
  }
  if (status === 415) {
    return { kind: "unsupported", message: "This browser's recording format isn't supported. Please type your question instead." };
  }
  if (status === 422) {
    return { kind: "empty", message: "We didn't catch that. Tap the mic and speak again." };
  }
  if (status === 429) {
    return { kind: "rate-limited", message: "Too many voice requests just now. Wait a moment, or type your question." };
  }
  if (status === 504) {
    return { kind: "timeout", message: "Transcribing took too long. Please try again, or type your question." };
  }
  if (status === 503) {
    return { kind: "provider", message: "Voice input is unavailable right now. Please type your question instead." };
  }
  return { kind: "provider", message: GENERIC };
}

/**
 * How long the browser waits before giving up.
 *
 * Above the backend's own transcription timeout, so its specific error wins the
 * race and reaches the customer. A timer that fires first would replace "the
 * provider is slow" with "something went wrong", which is strictly less useful.
 */
export const TRANSCRIBE_TIMEOUT_MS = 30000;

export interface TranscribeOptions {
  /** The customer's interface language, offered to the provider as a hint. */
  language?: string;
  /** Lets the caller abandon a transcription — e.g. the customer interrupted. */
  signal?: AbortSignal;
  /** Test seam. Production callers use the global. */
  fetchImpl?: typeof fetch;
  /** Test seam for the base URL. */
  apiUrl?: string;
}

/**
 * Send one recording and get back what was said.
 *
 * Throws `SpeechToTextError` for every failure — including an empty transcript,
 * which is a failure of this turn even though the request succeeded. The caller
 * therefore never has to decide whether an empty string means "silence" or
 * "something broke".
 */
export async function transcribeAudio(
  audio: Blob,
  options: TranscribeOptions = {}
): Promise<TranscriptionResult> {
  const { language, signal, fetchImpl, apiUrl } = options;
  const doFetch = fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!doFetch) {
    throw new SpeechToTextError("network", GENERIC, "no fetch implementation available");
  }

  // Checked here so a turn that cannot possibly work never becomes an upload.
  if (isTooShortToTranscribe(audio.size)) {
    throw new SpeechToTextError("empty", "We didn't catch that. Tap the mic and speak again.");
  }
  if (isTooLargeToUpload(audio.size)) {
    throw new SpeechToTextError(
      "too-large",
      "That recording is too long. Please keep it short, or type your question."
    );
  }

  const mime = baseMimeType(audio.type) || "audio/webm";
  const form = new FormData();
  form.append("audio", audio, recordingFilename(mime));
  if (language) form.append("language", language);

  // Its own timer, linked to the caller's signal so an interrupt still aborts.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener("abort", onCallerAbort);

  let response: Response;
  try {
    response = await doFetch(`${apiUrl ?? API_URL}/voice/transcribe`, {
      method: "POST",
      body: form,
      // The session rides an httpOnly cookie, exactly as it does for chat.
      credentials: "include",
      signal: controller.signal,
      // Content-Type is left unset on purpose: the browser must add the
      // multipart boundary itself, and setting it by hand omits that and makes
      // the body unparseable at the other end.
    });
  } catch (err) {
    if (signal?.aborted) {
      throw new SpeechToTextError("timeout", "Voice input was cancelled.", "aborted by caller");
    }
    if ((err as Error)?.name === "AbortError") {
      throw new SpeechToTextError(
        "timeout",
        "Transcribing took too long. Please try again, or type your question."
      );
    }
    throw new SpeechToTextError(
      "network",
      "Couldn't reach Aegis to transcribe that. Check your connection, or type your question.",
      (err as Error)?.message
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }

  if (!response.ok) {
    const fallback = failureFor(response.status);
    let serverMessage: string | undefined;
    try {
      const body = await response.json();
      const candidate = body?.message ?? body?.detail;
      if (typeof candidate === "string" && candidate.trim()) serverMessage = candidate.trim();
    } catch {
      // A gateway answered with HTML, or the body was empty. The status alone
      // is enough to say something useful.
    }
    throw new SpeechToTextError(fallback.kind, serverMessage ?? fallback.message, `HTTP ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SpeechToTextError("provider", GENERIC, "response body was not JSON");
  }

  // The success envelope is `{ status, data }` — see `utils/apiResponse.ts`.
  // Read defensively rather than trusted: payload drift between these two
  // services has broken this repo before, and a shape change should surface as
  // a clear voice error, not as `undefined` reaching the orchestrator.
  const data = (payload as { data?: Record<string, unknown> })?.data;
  const transcript = typeof data?.transcript === "string" ? data.transcript.trim() : "";
  if (!transcript) {
    throw new SpeechToTextError("empty", "We didn't catch that. Tap the mic and speak again.");
  }

  return {
    transcript,
    language: typeof data?.language === "string" ? data.language : null,
    provider: typeof data?.provider === "string" ? data.provider : null,
  };
}
