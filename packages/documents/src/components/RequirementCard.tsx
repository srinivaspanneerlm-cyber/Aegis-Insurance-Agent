"use client";

import { cn } from "@aegis/utils";
import { UploadDropzone } from "./UploadDropzone";
import type { DocumentRequirement } from "../lib/types";

export interface RequirementCardProps {
  requirement: DocumentRequirement;
  onFiles: (requirement: DocumentRequirement, files: File[]) => void;
  disabled?: boolean;
}

/**
 * One document the platform has asked for.
 *
 * Rendered entirely from the requirement, which came from the server — no
 * portal holds a list of what a motor policy needs. That is what lets a new
 * product, or a customer whose circumstances changed the answer, work without
 * a front-end change.
 *
 * The *reason* is shown as prominently as the label. "Vehicle registration
 * certificate" tells somebody what to find; "to confirm the vehicle is
 * registered to you" tells them why it is worth the trouble, and that is the
 * difference between an upload and an abandoned application.
 */
export function RequirementCard({ requirement, onFiles, disabled }: RequirementCardProps) {
  const supplied = requirement.status === "SUPPLIED" || requirement.status === "WAIVED";

  return (
    <section
      className={cn(
        "rounded-card border p-4",
        supplied ? "border-success/30 bg-success/5" : "border-line/50 bg-surface-raised/20"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-body-sm text-content font-medium">{requirement.label}</h3>
        {requirement.required ? (
          <span className="border-line/60 text-content-muted rounded-pill border px-2 py-0.5 text-[0.625rem] font-semibold uppercase">
            Required
          </span>
        ) : (
          <span className="text-caption text-content-muted">Optional</span>
        )}
        {supplied ? (
          <span className="border-success/40 text-success rounded-pill border px-2 py-0.5 text-[0.625rem] font-semibold uppercase">
            Received
          </span>
        ) : null}
      </div>

      {requirement.reason ? (
        <p className="text-caption text-content-secondary mt-1.5 text-pretty">
          {requirement.reason}
        </p>
      ) : null}

      {!supplied ? (
        <div className="mt-4">
          <UploadDropzone
            accepts={requirement.accepts}
            multiple={requirement.multiple}
            disabled={disabled ?? false}
            onFiles={(files) => onFiles(requirement, files)}
            label={requirement.multiple ? "Add photographs" : "Choose a file"}
          />
        </div>
      ) : null}
    </section>
  );
}
