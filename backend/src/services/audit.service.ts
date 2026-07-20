import { auditRepository } from "../repositories";
import { audit as auditLog } from "../config/logger";

interface AuditEntry {
  /** The user who performed the action; null/undefined = system/anonymous. */
  actorId?: string | null;
  /** Dotted action name, e.g. "auth.login.success", "policy.created". */
  action: string;
  entity?: string;
  entityId?: string;
  /** Contextual detail — never secrets/PII in the clear (stored as JSON). */
  metadata?: Record<string, unknown>;
}

/**
 * Enterprise audit trail. Every recorded event goes to BOTH:
 *   1. the structured `audit` log stream (real-time, correlated, shipped), and
 *   2. the AuditLog table (durable, queryable for compliance).
 *
 * The DB write is best-effort and fire-and-forget: an audit failure is logged
 * but never blocks or fails the request it describes.
 */
export const auditService = {
  record({ actorId, action, entity, entityId, metadata }: AuditEntry): void {
    auditLog.info(
      { event: action, actorId: actorId ?? null, entity, entityId, ...metadata },
      action
    );

    void auditRepository
      .create({
        actorId: actorId ?? null,
        action,
        entity: entity ?? null,
        entityId: entityId ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .catch((err: unknown) => {
        auditLog.error({ action, err: (err as Error).message }, "audit persist failed");
      });
  },
};
