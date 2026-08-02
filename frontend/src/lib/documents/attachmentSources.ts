import type { LocalisedText } from "@/types/documents";
import {
  ACCEPT_ANY,
  ACCEPT_IMAGERY,
  ACCEPT_PAPERWORK,
  MAX_UPLOAD_BYTES,
  MIME,
} from "./registry";

/**
 * What the paperclip offers.
 *
 * Each source is just a pre-filled picker configuration — narrowing `accept`
 * up front means a customer looking for a photo is not scrolling past PDFs in
 * their file manager. `browse` is the escape hatch that accepts everything.
 */

export type AttachmentSourceId = "documents" | "images" | "videos" | "camera" | "browse";

export interface AttachmentSource {
  id: AttachmentSourceId;
  label: LocalisedText;
  hint: LocalisedText;
  accept: string[];
  maxBytes: number;
  multiple: boolean;
  /** Asks a mobile browser to open the camera directly rather than the gallery. */
  capture?: "environment" | "user";
}

export const ATTACHMENT_SOURCES: AttachmentSource[] = [
  {
    id: "documents",
    label: { en: "Documents", ta: "ஆவணங்கள்", taEn: "Documents" },
    hint: { en: "PDF, DOCX or a scan" },
    accept: ACCEPT_PAPERWORK,
    maxBytes: MAX_UPLOAD_BYTES,
    multiple: true,
  },
  {
    id: "images",
    label: { en: "Images", ta: "படங்கள்", taEn: "Images" },
    hint: { en: "PNG, JPG, HEIC or WEBP" },
    accept: ACCEPT_IMAGERY,
    maxBytes: MAX_UPLOAD_BYTES,
    multiple: true,
  },
  {
    id: "videos",
    label: { en: "Videos", ta: "வீடியோ", taEn: "Videos" },
    hint: { en: "MP4 or MOV walkaround" },
    accept: [MIME.mp4, MIME.mov],
    maxBytes: MAX_UPLOAD_BYTES,
    multiple: true,
  },
  {
    id: "camera",
    label: { en: "Camera", ta: "கேமரா", taEn: "Camera" },
    hint: { en: "Take a photo right now" },
    accept: ACCEPT_IMAGERY,
    maxBytes: MAX_UPLOAD_BYTES,
    multiple: false,
    capture: "environment",
  },
  {
    id: "browse",
    label: { en: "Browse Files", ta: "கோப்புகளை உலாவு", taEn: "Browse files" },
    hint: { en: "Anything Aegis accepts" },
    accept: ACCEPT_ANY,
    maxBytes: MAX_UPLOAD_BYTES,
    multiple: true,
  },
];

export function getAttachmentSource(id: AttachmentSourceId): AttachmentSource | null {
  return ATTACHMENT_SOURCES.find((s) => s.id === id) ?? null;
}
