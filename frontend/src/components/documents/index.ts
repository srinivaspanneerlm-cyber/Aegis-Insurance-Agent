/**
 * Document Intelligence workflow components. Import from `@/components/documents`.
 *
 * Every component here is presentational: it renders the contracts in
 * `@/types/documents` and delegates file handling to its parent, so the same
 * card works in the chat transcript, the workflow accordion and a standalone
 * document list.
 */
export { UploadCard } from "./UploadCard";
export { DocumentCard } from "./DocumentCard";
export { UploadModal } from "./UploadModal";
export { AttachmentMenu } from "./AttachmentMenu";
export { UploadProgress } from "./UploadProgress";
export { VerificationStatus } from "./VerificationStatus";
export { WorkflowAccordion } from "./WorkflowAccordion";
export {
  completionPercent,
  isSimulated,
  passedBadges,
  phaseMeta,
  pipelineProgress,
  requirementState,
  unverifiedCount,
  type RequirementState,
  type StatusTone,
  type VerificationBadge,
} from "./statusMeta";
