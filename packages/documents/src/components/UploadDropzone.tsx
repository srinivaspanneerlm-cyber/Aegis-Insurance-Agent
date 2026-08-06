"use client";

import { useCallback, useState, type DragEvent } from "react";
import { cn } from "@aegis/utils";
import { ACCEPTED_MIME_TYPES, MAX_UPLOAD_BYTES, formatBytes, rejectionFor } from "../lib/types";

export interface UploadDropzoneProps {
  /** Called with the files that passed the client-side checks. */
  onFiles: (files: File[]) => void;
  /** Narrower than the global list when a requirement says so. */
  accepts?: readonly string[];
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
}

/**
 * Drag-and-drop with a real file input underneath.
 *
 * The input is the control; the drop zone is an enhancement. That ordering
 * matters — a div with drag handlers is invisible to a keyboard and to
 * assistive technology, so the whole thing is a `<label>` wrapping a real
 * `<input type="file">`. Keyboard, screen reader and the operating system's own
 * picker all work because the browser's control is doing the work.
 *
 * Rejected files are reported individually. "Some files could not be added" is
 * useless when you selected eight.
 */
export function UploadDropzone({
  onFiles,
  accepts = ACCEPTED_MIME_TYPES,
  multiple = true,
  disabled = false,
  label = "Choose files or drag them here",
}: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [rejections, setRejections] = useState<string[]>([]);

  const accept = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const accepted: File[] = [];
      const refused: string[] = [];

      for (const file of Array.from(fileList)) {
        const reason = rejectionFor(file, accepts);
        if (reason) refused.push(`${file.name}: ${reason}`);
        else accepted.push(file);
      }

      setRejections(refused);
      if (accepted.length > 0) onFiles(multiple ? accepted : accepted.slice(0, 1));
    },
    [accepts, multiple, onFiles]
  );

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) accept(event.dataTransfer.files);
  };

  return (
    <div>
      <label
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-card flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-10 text-center transition-colors",
          "focus-within:ring-brand/40 focus-within:ring-2",
          dragging ? "border-brand bg-brand/5" : "border-line/60 hover:border-line-strong",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input
          type="file"
          multiple={multiple}
          disabled={disabled}
          accept={accepts.join(",")}
          onChange={(event) => {
            accept(event.target.files);
            // Reset, so selecting the same file twice in a row still fires.
            event.target.value = "";
          }}
          className="sr-only"
        />
        <span className="text-body-sm text-content font-medium">{label}</span>
        <span className="text-caption text-content-muted mt-1">
          Up to {formatBytes(MAX_UPLOAD_BYTES)} each · PDF, Word, photographs or video
        </span>
      </label>

      {rejections.length > 0 ? (
        <ul role="alert" className="mt-3 flex flex-col gap-1">
          {rejections.map((reason) => (
            <li key={reason} className="text-caption text-danger text-pretty">
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
