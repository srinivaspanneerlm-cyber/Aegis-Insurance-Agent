"use client";

import { motion } from "framer-motion";
import { localise } from "@/lib/documents/localise";
import type { WorkflowStepView } from "@/lib/documents/workflowSteps";
import { DocumentCard, UploadCard, WorkflowAccordion } from "@/components/documents";
import type {
  DocumentLocale,
  DocumentRequest,
  DocumentRequirement,
  DocumentUpload,
} from "@/types/documents";

interface DocumentRequestBlockProps {
  request: DocumentRequest;
  uploads: DocumentUpload[];
  adhocUploads: DocumentUpload[];
  steps: WorkflowStepView[];
  locale?: DocumentLocale;
  disabled?: boolean;
  onPick: (requirement: DocumentRequirement) => void;
  onDelete: (upload: DocumentUpload) => void;
  onRetry: (upload: DocumentUpload) => void;
}

/**
 * An agent's request for documents, as it appears under its message.
 *
 * The accordion is the frame and the upload cards live inside its `upload`
 * step, so the customer sees one thing to do at a time instead of a wall of
 * cards. Files that came in through the paperclip sit apart: they answer no
 * particular requirement, and pretending otherwise would tick a box nobody
 * filled.
 */
export function DocumentRequestBlock({
  request,
  uploads,
  adhocUploads,
  steps,
  locale = "en",
  disabled = false,
  onPick,
  onDelete,
  onRetry,
}: DocumentRequestBlockProps) {
  const renderStep = (step: WorkflowStepView) => {
    if (step.id !== "upload") return null;

    return (
      <div className="space-y-2">
        {request.requirements.map((requirement) => (
          <UploadCard
            key={requirement.id}
            requirement={requirement}
            uploads={uploads.filter((u) => u.requirementId === requirement.id)}
            locale={locale}
            disabled={disabled}
            onPick={onPick}
            onDelete={onDelete}
            onRetry={onRetry}
          />
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="ml-12 space-y-3"
    >
      <div>
        <h3 className="text-[12px] font-black uppercase tracking-wider text-slate-300">
          {localise(request.title, locale)}
        </h3>
        {request.note && (
          <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-400">
            {localise(request.note, locale)}
          </p>
        )}
      </div>

      <WorkflowAccordion steps={steps} locale={locale} renderStep={renderStep} />

      {adhocUploads.length > 0 && (
        <section aria-label="Also attached" className="space-y-2">
          <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-600">
            Also attached
          </h4>
          {adhocUploads.map((upload) => (
            <DocumentCard
              key={upload.id}
              upload={upload}
              locale={locale}
              onDelete={onDelete}
              onRetry={onRetry}
            />
          ))}
        </section>
      )}
    </motion.div>
  );
}
