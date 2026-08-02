"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMsg } from "@/components/ChatMessage";
import { pipelineProgress } from "@/components/documents/statusMeta";
import type { AttachmentSource } from "@/lib/documents/attachmentSources";
import { localise } from "@/lib/documents/localise";
import { resolveDocumentRequest } from "@/lib/documents/parseDocumentRequest";
import { requirementFromKind } from "@/lib/documents/registry";
import { buildWorkflowSteps, receivedPercent, type WorkflowStepView } from "@/lib/documents/workflowSteps";
import {
  createDocumentIntelligenceClient,
  runVerificationPipeline,
  type DocumentIntelligenceClient,
  type DocumentIntelligenceMode,
} from "@/services/documentIntelligence";
import { uploadService } from "@/services/api";
import type {
  DocumentRequest,
  DocumentRequirement,
  DocumentUpload,
  VerificationStage,
} from "@/types/documents";
import { makeId } from "./history";

/**
 * The document workflow behind the advisor chat.
 *
 * All of it lives here rather than in `page.tsx` so the page gains wiring and
 * no logic: the streaming, voice and transfer paths are untouched by this
 * feature. The hook watches the transcript for an ask, owns the files attached
 * to it, drives each one through upload → verification, and tells the page when
 * the customer has handed over everything so the conversation can carry on by
 * itself.
 */

/** Files that arrived through the paperclip rather than a named requirement. */
export const ADHOC_REQUIREMENT_ID = "__adhoc";

/** Uploads remember which ask they answered — a fresh ask gets fresh cards. */
interface TrackedUpload extends DocumentUpload {
  requestId: string;
}

/** What the picker should open with. `null` means it is closed. */
export interface PickerState {
  requirement?: DocumentRequirement;
  accept?: string[];
  maxBytes?: number;
  multiple?: boolean;
  capture?: "environment" | "user";
  title?: string;
  autoOpenPicker?: boolean;
}

export interface DocumentWorkflow {
  /** The ask currently on screen, if any. */
  request: DocumentRequest | null;
  /** Id of the message that owns the cards, so the transcript knows where to put them. */
  requestMessageId: string | null;
  /** Files attached to the current ask. */
  uploads: DocumentUpload[];
  /** Files attached through the paperclip, which answer no particular requirement. */
  adhocUploads: DocumentUpload[];
  steps: WorkflowStepView[];
  picker: PickerState | null;
  openForRequirement: (requirement: DocumentRequirement) => void;
  openForSource: (source: AttachmentSource) => void;
  closePicker: () => void;
  confirmFiles: (files: File[]) => void;
  removeUpload: (upload: DocumentUpload) => void;
  retryUpload: (upload: DocumentUpload) => void;
}

export interface DocumentWorkflowOptions {
  messages: ChatMsg[];
  /**
   * Called once, when every required document for an ask has been handed over.
   * The page routes it through the normal send path, so the advisor picks the
   * conversation back up without the customer having to say anything.
   */
  onAllReceived?: (message: string) => void;
  /** Injectable for tests; production reads the env, defaulting to unavailable. */
  client?: DocumentIntelligenceClient;
}

const DEFAULT_MODE = (process.env.NEXT_PUBLIC_DOCUMENT_INTELLIGENCE_MODE ||
  "unavailable") as DocumentIntelligenceMode;

// ── Stage bookkeeping ────────────────────────────────────────────────────────

function mergeStage(stages: VerificationStage[], next: VerificationStage): VerificationStage[] {
  const at = stages.findIndex((s) => s.id === next.id);
  if (at === -1) return [...stages, next];
  const copy = [...stages];
  copy[at] = next;
  return copy;
}

/** Apply a stage transition and keep the headline progress in step with it. */
function withStage(upload: DocumentUpload, stage: VerificationStage): DocumentUpload {
  const stages = mergeStage(upload.stages, stage);
  return { ...upload, stages, progress: pipelineProgress(stages) };
}

/** Object URLs are only worth creating for things a preview can show. */
const previewFor = (file: File): string | undefined =>
  typeof URL.createObjectURL === "function" && file.type.startsWith("image/")
    ? URL.createObjectURL(file)
    : undefined;

const revokePreview = (upload: DocumentUpload) => {
  if (upload.file.previewUrl && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(upload.file.previewUrl);
  }
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDocumentWorkflow({
  messages,
  onAllReceived,
  client,
}: DocumentWorkflowOptions): DocumentWorkflow {
  const [tracked, setTracked] = useState<TrackedUpload[]>([]);
  const [picker, setPicker] = useState<PickerState | null>(null);

  const clientRef = useRef<DocumentIntelligenceClient>(
    client ?? createDocumentIntelligenceClient({ mode: DEFAULT_MODE }),
  );
  if (client && clientRef.current !== client) clientRef.current = client;

  // The newest advisor message that asks for something wins. Older asks are
  // superseded — two live checklists in one transcript is a maze, not a guide.
  const resolved = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.sender !== "advisor" || m.isStreaming) continue;
      const hit = resolveDocumentRequest(m.text, {
        agentName: m.agentName,
        agentDomain: m.agentDomain,
        requestId: m.id,
      });
      if (hit) return { messageId: m.id, request: hit.request };
    }
    return null;
  }, [messages]);

  const request = resolved?.request ?? null;
  const requestId = request?.id ?? null;

  const uploads = useMemo(
    () =>
      tracked.filter((u) => u.requestId === requestId && u.requirementId !== ADHOC_REQUIREMENT_ID),
    [tracked, requestId],
  );
  const adhocUploads = useMemo(
    () => tracked.filter((u) => u.requirementId === ADHOC_REQUIREMENT_ID),
    [tracked],
  );

  const steps = useMemo(() => buildWorkflowSteps({ request, uploads }), [request, uploads]);

  const patch = useCallback((id: string, fn: (u: TrackedUpload) => DocumentUpload) => {
    setTracked((prev) => prev.map((u) => (u.id === id ? { ...fn(u), requestId: u.requestId } : u)));
  }, []);

  // ── The journey of one file ────────────────────────────────────────────────

  const runUpload = useCallback(
    async (uploadId: string, file: File, requirement: DocumentRequirement) => {
      const kind = requirement.kind;
      const checkStages = requirement.stages.filter((s) => s !== "upload");

      let documentId: string | undefined;

      try {
        patch(uploadId, (u) => withStage({ ...u, phase: "uploading" }, { id: "upload", status: "running", progress: 0 }));

        const document = await uploadService.uploadDocument(file, (e) => {
          const percent = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
          patch(uploadId, (u) => withStage(u, { id: "upload", status: "running", progress: percent }));
        });
        documentId = (document as { id?: string } | undefined)?.id;

        patch(uploadId, (u) =>
          withStage(
            { ...u, phase: "verifying", documentId, uploadedAt: new Date().toISOString() },
            { id: "upload", status: "passed", detail: "File received" },
          ),
        );
      } catch {
        // Whatever the server said stays in the server's logs; the customer gets
        // a sentence they can act on.
        const error = "That upload did not go through. Please try again.";
        patch(uploadId, (u) =>
          withStage({ ...u, phase: "failed", error }, { id: "upload", status: "failed", detail: error }),
        );
        return;
      }

      const result = await runVerificationPipeline(
        checkStages,
        { documentId, kind, fileName: file.name, mimeType: file.type, sizeBytes: file.size },
        clientRef.current,
        (stage) => patch(uploadId, (u) => withStage(u, stage)),
      );

      patch(uploadId, (u) => ({
        ...u,
        phase: "completed",
        progress: 100,
        intelligence: result.intelligence,
      }));
    },
    [patch],
  );

  /** Originals, so a failed upload can be retried without making the customer
   *  hunt for the file a second time. */
  const filesById = useRef(new Map<string, { file: File; requirement: DocumentRequirement }>());

  const attach = useCallback(
    (files: File[], requirement: DocumentRequirement, ownerRequestId: string) => {
      for (const file of files) {
        const id = makeId();
        filesById.current.set(id, { file, requirement });
        setTracked((prev) => [
          ...prev,
          {
            id,
            requestId: ownerRequestId,
            requirementId: requirement.id,
            kind: requirement.kind,
            file: {
              name: file.name,
              sizeBytes: file.size,
              mimeType: file.type,
              previewUrl: previewFor(file),
            },
            phase: "queued",
            progress: 0,
            stages: requirement.stages.map((sid) => ({ id: sid, status: "pending" as const })),
          },
        ]);
        void runUpload(id, file, requirement);
      }
    },
    [runUpload],
  );

  // ── Picker ─────────────────────────────────────────────────────────────────

  const openForRequirement = useCallback((requirement: DocumentRequirement) => {
    setPicker({ requirement });
  }, []);

  const openForSource = useCallback((source: AttachmentSource) => {
    setPicker({
      accept: source.accept,
      maxBytes: source.maxBytes,
      multiple: source.multiple,
      capture: source.capture,
      title: localise(source.label),
      autoOpenPicker: source.id === "camera",
    });
  }, []);

  const closePicker = useCallback(() => setPicker(null), []);

  const confirmFiles = useCallback(
    (files: File[]) => {
      const current = picker;
      setPicker(null);
      if (files.length === 0) return;

      // An explicit `undefined` in the overrides would blank out the catalogue
      // default, so only the keys the picker actually knows are passed through.
      const adhoc: Partial<DocumentRequirement> = {
        id: ADHOC_REQUIREMENT_ID,
        required: false,
        multiple: current?.multiple ?? false,
      };
      if (current?.accept) adhoc.accept = current.accept;
      if (current?.maxBytes) adhoc.maxBytes = current.maxBytes;

      const requirement = current?.requirement ?? requirementFromKind("other", adhoc);

      attach(files, requirement, requestId ?? ADHOC_REQUIREMENT_ID);
    },
    [picker, attach, requestId],
  );

  const removeUpload = useCallback((upload: DocumentUpload) => {
    revokePreview(upload);
    filesById.current.delete(upload.id);
    setTracked((prev) => prev.filter((u) => u.id !== upload.id));
  }, []);

  const retryUpload = useCallback(
    (upload: DocumentUpload) => {
      const held = filesById.current.get(upload.id);
      if (!held) return;
      patch(upload.id, (u) => ({
        ...u,
        phase: "queued",
        progress: 0,
        error: undefined,
        stages: held.requirement.stages.map((sid) => ({ id: sid, status: "pending" as const })),
      }));
      void runUpload(upload.id, held.file, held.requirement);
    },
    [patch, runUpload],
  );

  // ── Auto-continuation ──────────────────────────────────────────────────────

  const continuedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!request || !onAllReceived) return;
    if (continuedFor.current === request.id) return;
    if (receivedPercent(request, uploads) < 100) return;
    // Nothing may still be moving — a half-verified document is not "handed over".
    if (uploads.some((u) => u.phase === "queued" || u.phase === "uploading" || u.phase === "verifying")) return;

    continuedFor.current = request.id;

    const names = request.requirements
      .filter((r) => r.required)
      .map((r) => localise(r.label))
      .join(", ");

    onAllReceived(
      names ? `I've uploaded the documents you asked for: ${names}.` : "I've uploaded the documents you asked for.",
    );
  }, [request, uploads, onAllReceived]);

  // Object URLs outlive the component unless we say otherwise.
  const trackedRef = useRef(tracked);
  trackedRef.current = tracked;
  useEffect(() => () => trackedRef.current.forEach(revokePreview), []);

  return {
    request,
    requestMessageId: resolved?.messageId ?? null,
    uploads,
    adhocUploads,
    steps,
    picker,
    openForRequirement,
    openForSource,
    closePicker,
    confirmFiles,
    removeUpload,
    retryUpload,
  };
}
