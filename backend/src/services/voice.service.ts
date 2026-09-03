/**
 * Aegis AI — voice transcription bridge.
 *
 * Sits on exactly the seam `ai.service.ts` already occupies: the browser talks
 * to this backend because this is where the customer's session is verified and
 * where paid AI work is throttled, and this backend talks to the Python engine
 * because that is where every provider decision lives. The vendor is never
 * named here — this file forwards bytes and reads a transcript back, and
 * `STT_PROVIDER` on the engine decides who did the work.
 *
 * The audio is forwarded as a raw body rather than re-wrapped in a multipart
 * form. There is one recording per request and one trusted caller, so a form
 * boundary would buy nothing and cost a full copy of a buffer that may be
 * megabytes, per concurrent request.
 */
import env from "../config/env";
import { createHttpClient } from "../utils/httpClient";
import { VOICE } from "../config/constants";
import { logger } from "../config/logger";
import AppError from "../utils/appError";

const internalHeaders: Record<string, string> = env.AI_INTERNAL_API_KEY
  ? { "X-Internal-Api-Key": env.AI_INTERNAL_API_KEY }
  : {};

// Its own client, with its own timeout. Retries are 0 on purpose: a retry
// doubles the provider spend for a customer who is already waiting, and the
// answer to a failed transcription is to type instead — which works instantly.
const voiceHttp = createHttpClient({
  timeout: VOICE.TIMEOUT_MS,
  retries: 0,
  maxBodyLength: VOICE.MAX_AUDIO_BYTES * 2,
  maxContentLength: VOICE.MAX_AUDIO_BYTES * 2,
});

export interface TranscriptionResult {
  transcript: string;
  /** 'en-IN' | 'ta-IN' | 'ta-en' — a hint carried alongside, never applied here. */
  language: string | null;
  provider: string | null;
  durationMs: number;
}

interface TranscribeInput {
  audio: Buffer;
  mimeType: string;
  /** The customer's interface language, offered to the provider as a hint. */
  languageHint?: string;
  requestId?: string;
}

interface EngineErrorBody {
  detail?: string;
}

/**
 * Statuses the engine raises deliberately, each standing for a different thing
 * the customer can do about it. Passed through rather than flattened into 502,
 * because "we didn't catch that, speak again" and "voice is down, type instead"
 * are opposite instructions and the browser has to be able to tell them apart.
 */
const PASSTHROUGH_STATUSES = new Set([413, 415, 422, 503, 504]);

const transcribe = async ({
  audio,
  mimeType,
  languageHint,
  requestId,
}: TranscribeInput): Promise<TranscriptionResult> => {
  const url = `${env.AI_SERVICE_URL}/voice/transcribe`;

  try {
    const response = await voiceHttp.post(url, audio, {
      headers: {
        ...internalHeaders,
        ...(requestId ? { "X-Request-Id": requestId } : {}),
        "Content-Type": mimeType,
        ...(languageHint ? { "X-Audio-Language": languageHint } : {}),
      },
    });

    const data = response.data ?? {};
    return {
      transcript: typeof data.transcript === "string" ? data.transcript : "",
      language: typeof data.language === "string" ? data.language : null,
      provider: typeof data.provider === "string" ? data.provider : null,
      durationMs: Number.isFinite(data.duration_ms) ? Number(data.duration_ms) : 0,
    };
  } catch (err) {
    const error = err as { response?: { status?: number; data?: EngineErrorBody }; code?: string; message?: string };
    const status = error.response?.status;

    // Nothing about the audio itself is logged — not its bytes, not a
    // transcript. What is useful operationally is the shape of the failure.
    logger.warn(
      { requestId, status, code: error.code, err: error.message },
      "[Voice] transcription failed"
    );

    if (status && PASSTHROUGH_STATUSES.has(status)) {
      const detail = error.response?.data?.detail;
      throw new AppError(
        typeof detail === "string" && detail
          ? detail
          : "Voice input failed. Please type your question instead.",
        status,
        "VOICE_TRANSCRIPTION_FAILED"
      );
    }

    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      throw new AppError(
        "Transcribing took too long. Please try again, or type your question.",
        504,
        "VOICE_TRANSCRIPTION_TIMEOUT"
      );
    }

    // Engine unreachable, or an error it did not classify. Unlike the chat
    // path there is no resilient fallback to offer: a transcript cannot be
    // guessed. Saying so plainly, with the way out, is the honest answer.
    throw new AppError(
      "Voice input is unavailable right now. Please type your question instead.",
      503,
      "VOICE_UNAVAILABLE"
    );
  }
};

export const voiceService = { transcribe };
export default voiceService;
