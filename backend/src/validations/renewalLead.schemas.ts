/**
 * Same contract as `schemas.ts` and `consumer.schemas.ts`: a function that
 * returns error strings or null. The two aliases are re-declared rather than
 * imported for the same reason they are there — they are a shape, not a module.
 */
type RequestData = Record<string, unknown>;
type ValidationErrors = string[] | null;
import {
  CLOSED_REASONS,
  CONTACT_CHANNELS,
  RENEWAL_LEAD_STATUSES,
  isClosedReason,
  isContactChannel,
  isRenewalLeadStatus,
} from "../consumer/renewalLead";

/**
 * What an operator may send about somebody else's renewal request.
 *
 * Deliberately narrow. `RenewalLead` carries a `userId`, a `consentId`, a
 * `deletedAt` and the urgency snapshot the queue sorts by — none of which an
 * operator has any business setting, and all of which a body with no allow-list
 * would happily accept. That is the exact shape of the bug this codebase
 * already found once on `leadUpdateSchema`.
 */

const ADVANCE_FIELDS = ["status", "closedReason", "assignToMe"] as const;

function rejectUnknown(data: RequestData, allowed: readonly string[], errors: string[]): void {
  const permitted = new Set<string>(allowed);
  const unknown = Object.keys(data).filter((key) => !permitted.has(key));
  if (unknown.length > 0) {
    errors.push(`These fields cannot be set here: ${unknown.sort().join(", ")}.`);
  }
}

export const renewalLeadAdvanceSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  rejectUnknown(data, ADVANCE_FIELDS, errors);

  if (!isRenewalLeadStatus(data.status)) {
    errors.push(`Choose one of: ${RENEWAL_LEAD_STATUSES.join(", ")}.`);
  }

  // Whether it is *required* is the service's call — it depends on the target
  // state, which is a workflow rule rather than a shape rule. Here we only
  // insist that if one is given it is one of the reasons the queue counts.
  if (data.closedReason !== undefined && data.closedReason !== null) {
    if (!isClosedReason(data.closedReason)) {
      errors.push(`A closing reason must be one of: ${CLOSED_REASONS.join(", ")}.`);
    }
  }

  if (data.assignToMe !== undefined && typeof data.assignToMe !== "boolean") {
    errors.push("The assignment choice must be yes or no.");
  }

  return errors.length > 0 ? errors : null;
};

/** `?status=`, `?channel=`, `?page=`, `?limit=`, `?format=csv` on the queue. */
export const renewalLeadQuerySchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];

  if (data.status !== undefined && !isRenewalLeadStatus(data.status)) {
    errors.push(`Unknown status. Choose one of: ${RENEWAL_LEAD_STATUSES.join(", ")}.`);
  }
  if (data.channel !== undefined && !isContactChannel(data.channel)) {
    errors.push(`Unknown channel. Choose one of: ${CONTACT_CHANNELS.join(", ")}.`);
  }
  for (const key of ["page", "limit"] as const) {
    if (data[key] === undefined) continue;
    const value = Number(data[key]);
    if (!Number.isInteger(value) || value < 1) errors.push(`'${key}' must be a whole number above zero.`);
  }
  if (data.format !== undefined && data.format !== "csv") {
    errors.push("Query parameter 'format' must be 'csv' when given.");
  }

  return errors.length > 0 ? errors : null;
};
