import voiceService from "../services/voice.service";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";
import { VOICE } from "../config/constants";
import { audioMatchesDeclaredType, isAllowedAudioMime, baseMimeType } from "../utils/audioTypes";

/** Languages the composer may ask the provider to expect. Bounded so a crafted
 *  header cannot become an arbitrary string in a prompt sent to a paid API. */
const LANGUAGE_HINTS = new Set(["en-IN", "en-US", "en-GB", "en", "ta-IN", "ta", "ta-en"]);

/**
 * Transcribe one recorded voice turn.
 *
 * Everything about the request is treated as a claim until it is checked: the
 * declared type, the size, and the bytes themselves. The recording is never
 * written to disk and never logged — it is a customer speaking about their
 * health, their income or their family, and the only place it belongs is in
 * memory for the length of this request.
 */
const transcribeAudio = catchAsync(async (req, res, next) => {
  const file = req.file;

  if (!file || !file.buffer || file.buffer.length === 0) {
    return next(new AppError("No recording was received. Please try again.", 400, "VALIDATION_ERROR"));
  }

  // Below this there is a container header and nothing else. Refusing here
  // rather than upstream keeps an empty turn from costing a provider call.
  if (file.buffer.length < VOICE.MIN_AUDIO_BYTES) {
    return next(
      new AppError("We didn't catch that. Tap the mic and speak again.", 422, "VOICE_EMPTY_AUDIO")
    );
  }

  const declared = baseMimeType(file.mimetype);
  if (!isAllowedAudioMime(declared)) {
    return next(
      new AppError(
        "That recording format isn't supported. Please type your question instead.",
        415,
        "VOICE_UNSUPPORTED_AUDIO"
      )
    );
  }

  // The declared type is spoofable; the bytes are not. A file that is not
  // really audio is refused before it can buy a paid provider call.
  if (!audioMatchesDeclaredType(file.buffer, declared)) {
    return next(
      new AppError(
        "That file isn't a valid audio recording.",
        415,
        "VOICE_UNSUPPORTED_AUDIO"
      )
    );
  }

  const requested = String(req.body?.language ?? "").trim();
  const languageHint = LANGUAGE_HINTS.has(requested) ? requested : undefined;

  const result = await voiceService.transcribe({
    audio: file.buffer,
    mimeType: declared,
    languageHint,
    requestId: req.id as string,
  });

  sendSuccess(res, 200, {
    transcript: result.transcript,
    // Carried through to the browser so the UI knows what was heard. The
    // transcript itself reaches the advisor verbatim through the same send
    // path a typed message uses, and the existing language layer reads it
    // there — this field starts no second translation system.
    language: result.language,
    provider: result.provider,
  });
});

export { transcribeAudio };
