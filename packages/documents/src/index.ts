/**
 * The shared document platform.
 *
 * Apps import from `@aegis/documents` and never from a deep path, so internal
 * reorganisation breaks nothing as long as this file keeps exporting the same
 * names.
 *
 * Nothing here talks to an API. Every component renders what it is handed and
 * emits what a person did — which is what lets one set of components serve the
 * customer portal, the employee workspace and both consoles, each with its own
 * data layer and its own permissions.
 */
export * from "./lib/types";

export { ProgressTimeline, type ProgressTimelineProps } from "./components/ProgressTimeline";
export { DocumentStatusBadge } from "./components/DocumentStatusBadge";
export { DocumentCard, type DocumentCardProps } from "./components/DocumentCard";
export { PreviewModal, type PreviewModalProps } from "./components/PreviewModal";
export { UploadDropzone, type UploadDropzoneProps } from "./components/UploadDropzone";
export { UploadCard, type UploadCardProps } from "./components/UploadCard";
export { RequirementCard, type RequirementCardProps } from "./components/RequirementCard";
