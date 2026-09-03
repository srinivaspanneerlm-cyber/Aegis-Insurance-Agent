import express from "express";
import multer, { MulterError } from "multer";
import type { NextFunction, Request, Response } from "express";
import * as voiceController from "../controllers/voice.controller";
import { protect } from "../middleware/auth.middleware";
import { aiLimiter } from "../config/security";
import { VOICE } from "../config/constants";
import { isAllowedAudioMime } from "../utils/audioTypes";
import AppError from "../utils/appError";

const router = express.Router();

/**
 * Memory storage, not disk — deliberately different from `upload.routes.ts`.
 *
 * A document is uploaded to be kept. A voice turn is uploaded to be read once
 * and forgotten: writing it to `src/uploads` would leave a customer's spoken
 * words, which are often the most sensitive thing they say, sitting on the
 * filesystem long after the sentence they became was answered. The size cap is
 * what makes holding it in memory safe.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VOICE.MAX_AUDIO_BYTES, files: 1, fields: 4 },
  fileFilter: (_req, file, cb) => {
    // First gate only — the declared type is a claim. The controller sniffs the
    // real container before anything is forwarded.
    if (isAllowedAudioMime(file.mimetype)) return cb(null, true);
    cb(new AppError("That recording format isn't supported.", 415, "VOICE_UNSUPPORTED_AUDIO"));
  },
});

const acceptRecording = upload.single("audio");

/**
 * Multer signals a breached limit by throwing rather than calling `next` with
 * an operational error, so without this a recording slightly over the cap comes
 * back as a generic 500 and the customer is told nothing they can act on.
 */
const handleRecordingErrors = (req: Request, res: Response, next: NextFunction): void => {
  acceptRecording(req, res, (err: unknown) => {
    if (!(err instanceof MulterError)) return next(err);

    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "That recording is too long. Please keep it under a minute, or type your question."
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Please send one recording at a time."
          : "That recording could not be accepted.";

    next(new AppError(message, 413, "VOICE_AUDIO_TOO_LARGE"));
  });
};

/**
 * POST /api/voice/transcribe
 *
 * Authenticated, because the transcription costs paid provider quota and is
 * done on a customer's behalf. Rate limited with `aiLimiter` — the same limiter
 * the chat and stream routes use — for the same reason: this is the third door
 * into paid AI work and it must not be the unguarded one.
 */
router.post("/transcribe", protect, aiLimiter, handleRecordingErrors, voiceController.transcribeAudio);

export = router;
