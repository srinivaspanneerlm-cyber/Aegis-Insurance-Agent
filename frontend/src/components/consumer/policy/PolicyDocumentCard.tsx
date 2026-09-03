"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, ShieldCheck } from "lucide-react";
import { localise } from "@/lib/documents/localise";
import type { DocumentLocale, LocalisedText } from "@/types/documents";
import {
  CONSUMER_FORMATS_LABEL,
  CONSUMER_MAX_BYTES,
  formatSize,
  validatePolicyDocument,
} from "@/lib/consumer/documents";
import { acceptAttribute } from "@/lib/documents/validation";
import { CONSUMER_ACCEPT } from "@/lib/consumer/documents";
import { consumerService, type ConsumerDocument } from "@/services/api";

/**
 * Your certificate, on the policy screen.
 *
 * Optional, and it says so before it asks. Everything this product does works
 * from the details the customer typed; a document raises what Aegis can say
 * about them and nothing here depends on one arriving. A customer who has no
 * scanner, no PDF and a cracked camera is exactly who this was built for, and
 * an upload box that reads as a requirement turns them away at the last step.
 *
 * The file is checked here before it is sent — format and size, with the reason
 * in the customer's language — so somebody on a slow connection is not made to
 * wait for a rejection that was knowable immediately. That check is a courtesy,
 * not a boundary: the API reads the actual magic bytes and refuses anything the
 * browser let past.
 */

const COPY = {
  heading: { en: "Your certificate", ta: "உங்கள் சான்றிதழ்", taEn: "Ungal certificate" },
  optional: {
    en: `Optional. A photo or PDF of your policy certificate — ${CONSUMER_FORMATS_LABEL}, up to ${formatSize(CONSUMER_MAX_BYTES)}. Only you can see it.`,
    ta: `விருப்பத் தேர்வு. உங்கள் பாலிசி சான்றிதழின் புகைப்படம் அல்லது PDF — ${CONSUMER_FORMATS_LABEL}, ${formatSize(CONSUMER_MAX_BYTES)} வரை. உங்களால் மட்டுமே பார்க்க முடியும்.`,
    taEn: `Optional. Ungal policy certificate photo illa PDF — ${CONSUMER_FORMATS_LABEL}, ${formatSize(CONSUMER_MAX_BYTES)} varai. Neenga mattum thaan paakka mudiyum.`,
  },
  choose: { en: "Choose a file", ta: "ஒரு கோப்பைத் தேர்ந்தெடுங்கள்", taEn: "Oru file select pannunga" },
  replace: { en: "Replace it", ta: "மாற்றி வையுங்கள்", taEn: "Maathi vaikkanum" },
  sending: { en: "Sending…", ta: "அனுப்புகிறோம்…", taEn: "Anuppurom…" },
  view: { en: "View", ta: "பார்க்க", taEn: "Paakka" },
  onFile: { en: "On file", ta: "சேமிக்கப்பட்டுள்ளது", taEn: "Save aagi irukku" },
} satisfies Record<string, LocalisedText>;

export interface PolicyDocumentCardProps {
  policyId: string;
  /** The certificate already attached, when there is one. */
  document?: ConsumerDocument | null;
  locale?: DocumentLocale;
  /** Called with the policy the API returns, so the trust badge updates at once. */
  onUploaded: (result: Awaited<ReturnType<typeof consumerService.uploadPolicyDocument>>) => void;
}

export function PolicyDocumentCard({
  policyId,
  document,
  locale = "en",
  onUploaded,
}: PolicyDocumentCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    const rejection = validatePolicyDocument(file);
    if (rejection) {
      setError(localise(rejection.message, locale));
      return;
    }

    setError(null);
    setBusy(true);
    try {
      onUploaded(await consumerService.uploadPolicyDocument(policyId, file, locale));
    } catch (caught) {
      // The API's own sentence when it sent one — it says what to send instead,
      // which a generic failure message cannot.
      const message =
        (caught as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "We could not upload that just now. Please try again.";
      setError(message);
    } finally {
      setBusy(false);
      // Let the same file be chosen again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <section
      aria-labelledby="certificate-heading"
      className="flex flex-col gap-3 rounded-4xl border border-line bg-surface-raised p-5"
    >
      <h2 id="certificate-heading" className="flex items-center gap-2 text-sm font-bold text-content">
        <ShieldCheck className="h-4 w-4 shrink-0 text-content-muted" aria-hidden="true" />
        {localise(COPY.heading, locale)}
      </h2>

      <p className="text-xs font-medium leading-relaxed text-content-muted">
        {localise(COPY.optional, locale)}
      </p>

      {document && (
        <div
          data-testid="attached-document"
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface-sunken/50 p-3"
        >
          <FileText className="h-4 w-4 shrink-0 text-content-muted" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-content">{document.filename}</span>
            <span className="text-xs font-medium text-content-subtle">
              {[localise(COPY.onFile, locale), formatSize(document.sizeBytes)]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <a
            href={consumerService.documentFileUrl(document.id)}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-brand hover:underline"
          >
            {localise(COPY.view, locale)}
          </a>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        name="certificate"
        accept={acceptAttribute(CONSUMER_ACCEPT)}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-bold text-content transition-colors hover:border-brand/40 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Paperclip className="h-4 w-4" aria-hidden="true" />
        )}
        {busy
          ? localise(COPY.sending, locale)
          : localise(document ? COPY.replace : COPY.choose, locale)}
      </button>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          {error}
        </p>
      )}
    </section>
  );
}
