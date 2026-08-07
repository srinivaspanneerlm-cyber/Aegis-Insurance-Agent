/**
 * Institutional memory: what the business durably knows, and why it thinks so.
 *
 * **This is not the agents' memory.** `ai-python/app/memory` and
 * `Aegis-AI/layer3` hold each agent's own namespaced working state, and that
 * isolation is the architecture's crown jewel. Nothing here reads or writes an
 * agent's namespace. Facts arrive by being asserted through this service, with
 * provenance attached; an agent that wants one asks for it.
 *
 * Three rules follow from that.
 *
 * **Nothing is overwritten.** A changed fact supersedes the old one, which is
 * kept. "They preferred email, now they prefer phone" is a history worth
 * having, and a fact that was acted on must stay visible after it changes —
 * otherwise nobody can explain a decision made on it.
 *
 * **Every fact carries where it came from.** A customer who asks "why do you
 * think that about me?" is entitled to an answer, and `AI_INFERRED` is a very
 * different answer from `CUSTOMER_STATED`.
 *
 * **Confidence is not decoration.** An inference from one conversation is not
 * the same as something the customer confirmed, and advice built on the two
 * must not sound equally certain.
 */
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { roleHasPermission } from "../auth/permissions";
import {
  conversationMemoryRepository,
  memoryRepository,
} from "../knowledge/repository";
import {
  MEMORY_KINDS,
  MEMORY_SCOPES,
  MEMORY_SOURCES,
  type Actor,
  type MemoryAssertion,
  type MemoryFact,
  type MemoryKind,
  type MemoryScope,
  type MemoryService,
  type MemorySource,
} from "../knowledge/contracts";

const SCOPES = new Set<string>(MEMORY_SCOPES);
const KINDS = new Set<string>(MEMORY_KINDS);
const SOURCES = new Set<string>(MEMORY_SOURCES);

/** Keys are namespaced and bounded, so a caller cannot invent an unbounded one. */
const KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const toFact = (row: {
  id: string;
  kind: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  sourceRef: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}): MemoryFact => ({
  id: row.id,
  kind: row.kind as MemoryKind,
  key: row.key,
  value: parseValue(row.value),
  confidence: row.confidence,
  source: row.source as MemorySource,
  sourceRef: row.sourceRef,
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
});

/**
 * Whether this caller may touch this subject's memory.
 *
 * The one place that decides it, so a new entry point cannot invent a looser
 * rule — the same shape as the intelligence engine's `authoriseFor`.
 *
 * A customer reaches their own CUSTOMER-scope memory and nothing else. Staff
 * reach a customer's with `customer.read`. ORGANIZATION and PLATFORM memory are
 * staff-only regardless of subject, because "the organisation" is not a person
 * whose own record they could be reading.
 */
function authorise(
  actor: Actor,
  scope: MemoryScope,
  subjectId: string,
  intent: "read" | "write"
): void {
  const deny = (reason: string): never => {
    auditService.record({
      actorId: actor.id,
      action: "authz.memory.denied",
      metadata: { scope, subjectId, intent, reason },
    });
    throw new AppError("You do not have access to that memory.", 403, "FORBIDDEN");
  };

  if (scope === "CUSTOMER" || scope === "EMPLOYEE") {
    if (actor.id === subjectId) {
      // Somebody may read everything about themselves. Writing is a different
      // matter: a person editing the platform's record of what it inferred
      // about them would be editing evidence, so self-writes are refused and a
      // correction goes through an advisor.
      if (intent === "read") return;
      if (!roleHasPermission(actor.role, "customer.write")) {
        deny("self-write");
      }
      return;
    }
    if (intent === "read" && roleHasPermission(actor.role, "customer.read")) return;
    if (intent === "write" && roleHasPermission(actor.role, "customer.write")) return;
    deny("no customer permission");
  }

  if (scope === "ORGANIZATION") {
    if (intent === "read" && roleHasPermission(actor.role, "analytics.read")) return;
    if (intent === "write" && roleHasPermission(actor.role, "organization.manage")) return;
    deny("no organisation permission");
  }

  if (scope === "PLATFORM") {
    if (roleHasPermission(actor.role, "platform.configure")) return;
    deny("not a platform operator");
  }
}

function validate(assertion: MemoryAssertion): void {
  if (!SCOPES.has(assertion.scope)) {
    throw new AppError("That is not a memory scope we recognise.", 400, "UNKNOWN_SCOPE");
  }
  if (!KINDS.has(assertion.kind)) {
    throw new AppError("That is not a memory kind we recognise.", 400, "UNKNOWN_KIND");
  }
  if (assertion.source && !SOURCES.has(assertion.source)) {
    throw new AppError("That is not a memory source we recognise.", 400, "UNKNOWN_SOURCE");
  }
  if (!assertion.subjectId?.trim()) {
    throw new AppError("A memory needs a subject.", 400, "SUBJECT_REQUIRED");
  }
  if (!KEY_PATTERN.test(assertion.key ?? "")) {
    throw new AppError(
      "A memory key looks like `contact.preferred_channel` — lower case, dot separated.",
      400,
      "INVALID_KEY"
    );
  }
  if (assertion.confidence !== undefined) {
    if (assertion.confidence < 0 || assertion.confidence > 1) {
      throw new AppError("Confidence runs from 0 to 1.", 400, "INVALID_CONFIDENCE");
    }
  }
}

export const memoryService: MemoryService = {
  /** Asserts a fact, superseding any live value of the same key. */
  async remember(actor: Actor, assertion: MemoryAssertion): Promise<MemoryFact> {
    validate(assertion);
    authorise(actor, assertion.scope, assertion.subjectId, "write");

    const serialised = JSON.stringify(assertion.value ?? null);
    if (serialised.length > 20_000) {
      throw new AppError("That value is too large for a memory.", 400, "VALUE_TOO_LARGE");
    }

    const existing = await memoryRepository.live(
      assertion.scope,
      assertion.subjectId,
      assertion.key
    );

    // An identical re-assertion is not a change. Without this, an AI that
    // re-derives the same fact each turn writes a new row per turn and buries
    // the actual history.
    if (existing && existing.value === serialised) {
      return toFact(existing);
    }

    const created = await memoryRepository.create({
      scope: assertion.scope,
      subjectId: assertion.subjectId,
      kind: assertion.kind,
      key: assertion.key,
      value: serialised,
      confidence: assertion.confidence ?? (assertion.source === "AI_INFERRED" ? 0.6 : 1),
      source: assertion.source ?? "SYSTEM",
      sourceRef: assertion.sourceRef ?? null,
      expiresAt: assertion.expiresAt ?? null,
      createdById: actor.id,
    });

    if (existing) await memoryRepository.supersede(existing.id, created.id);

    auditService.record({
      actorId: actor.id,
      action: "memory.remembered",
      entity: "MemoryRecord",
      entityId: created.id,
      metadata: {
        scope: assertion.scope,
        subjectId: assertion.subjectId,
        key: assertion.key,
        source: created.source,
        superseded: existing?.id ?? null,
      },
    });

    return toFact(created);
  },

  async recall(actor, scope, subjectId, options = {}) {
    if (!SCOPES.has(scope)) {
      throw new AppError("That is not a memory scope we recognise.", 400, "UNKNOWN_SCOPE");
    }
    authorise(actor, scope, subjectId, "read");

    const rows = await memoryRepository.liveAll(scope, subjectId, {
      ...(options.kind ? { kind: options.kind } : {}),
      ...(options.prefix ? { prefix: options.prefix } : {}),
    });

    // Reads are audited when somebody looks at a person other than themselves.
    // Auditing self-reads would drown the log in noise and protect nobody.
    if (actor.id !== subjectId) {
      auditService.record({
        actorId: actor.id,
        action: "memory.recalled",
        metadata: { scope, subjectId, count: rows.length },
      });
    }

    return rows.map(toFact);
  },

  /**
   * Deletes every trace of a key, including its history.
   *
   * The one operation here that truly destroys data, so it is the one with the
   * narrowest permission and the loudest audit entry. It exists because a
   * customer asking to be forgotten has a right that outranks the platform's
   * preference for keeping history.
   */
  async forget(actor: Actor, scope: MemoryScope, subjectId: string, key: string) {
    authorise(actor, scope, subjectId, "write");
    if (!KEY_PATTERN.test(key ?? "")) {
      throw new AppError("That is not a valid memory key.", 400, "INVALID_KEY");
    }

    const result = await memoryRepository.forget(scope, subjectId, key);

    auditService.record({
      actorId: actor.id,
      action: "memory.forgotten",
      metadata: { scope, subjectId, key, rows: result.count },
    });

    return { forgotten: result.count };
  },

  /** Every value a key has held, so a change can be explained. */
  async keyHistory(actor: Actor, scope: MemoryScope, subjectId: string, key: string) {
    authorise(actor, scope, subjectId, "read");
    const rows = await memoryRepository.keyHistory(scope, subjectId, key);
    return {
      key,
      entries: rows.map((row) => ({
        ...toFact(row),
        supersededAt: row.supersededAt,
        current: row.supersededAt === null,
      })),
    };
  },

  /**
   * Everything known about somebody, for a subject-access request.
   *
   * Includes superseded and expired records. A person asking what is held about
   * them is owed what the platform actually holds, not the tidied version.
   */
  async export(actor: Actor, scope: MemoryScope, subjectId: string) {
    authorise(actor, scope, subjectId, "read");
    const rows = await memoryRepository.everything(scope, subjectId);

    auditService.record({
      actorId: actor.id,
      action: "memory.exported",
      metadata: { scope, subjectId, records: rows.length },
    });

    return {
      scope,
      subjectId,
      exportedAt: new Date(),
      records: rows.map((row) => ({
        ...toFact(row),
        supersededAt: row.supersededAt,
        current: row.supersededAt === null,
      })),
    };
  },
};

// ── Conversation memory ──────────────────────────────────────────────────────

/**
 * A conversation's working memory on the platform side.
 *
 * Again: not the agents' memory. This holds what the platform's own services
 * need across a conversation — what has been established, what is still open,
 * what not to ask twice.
 *
 * Its most useful operation is `promote`: turning something established in a
 * conversation into an institutional fact, with the conversation recorded as
 * the source. That is the bridge between the two memories, and it is explicit
 * rather than automatic, because a machine deciding on its own what to write
 * permanently into a customer's record is how a misheard aside becomes a
 * permanent fact.
 */
export const conversationMemoryService = {
  async note(
    actor: Actor,
    input: {
      sessionRef: string;
      kind: string;
      label: string;
      value: unknown;
      userId?: string;
      pinned?: boolean;
      retention?: "TEMPORARY" | "SESSION" | "PROMOTED";
      ttlMinutes?: number;
    }
  ) {
    if (!input.sessionRef?.trim()) {
      throw new AppError("A conversation memory needs a session.", 400, "SESSION_REQUIRED");
    }
    const kinds = new Set(["SUMMARY", "ESTABLISHED_FACT", "OPEN_QUESTION", "INTENT", "HANDOFF_NOTE"]);
    if (!kinds.has(input.kind)) {
      throw new AppError("That is not a conversation memory kind.", 400, "UNKNOWN_KIND");
    }

    const retention = input.retention ?? "SESSION";
    // Temporary entries expire; session entries last until swept by session
    // end. Pinned entries ignore both — see the sweep.
    const expiresAt =
      input.ttlMinutes !== undefined
        ? new Date(Date.now() + input.ttlMinutes * 60_000)
        : retention === "TEMPORARY"
          ? new Date(Date.now() + 60 * 60_000)
          : null;

    return conversationMemoryRepository.create({
      sessionRef: input.sessionRef,
      userId: input.userId ?? null,
      kind: input.kind,
      label: input.label.slice(0, 200),
      value: JSON.stringify(input.value ?? null),
      pinned: input.pinned ?? false,
      retention,
      expiresAt,
    });
  },

  async forSession(actor: Actor, sessionRef: string, options: { pinnedOnly?: boolean } = {}) {
    const rows = await conversationMemoryRepository.forSession(sessionRef, options);

    // A session belongs to whoever it was opened for. Somebody else needs the
    // customer-read permission, exactly as they would to see the conversation.
    const owners = new Set(rows.map((r) => r.userId).filter(Boolean));
    const mine = owners.size === 0 || (owners.size === 1 && owners.has(actor.id));
    if (!mine && !roleHasPermission(actor.role, "customer.read")) {
      throw new AppError("You do not have access to that session.", 403, "FORBIDDEN");
    }

    return {
      sessionRef,
      entries: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        label: row.label,
        value: parseValue(row.value),
        pinned: row.pinned,
        retention: row.retention,
        promotedRecordId: row.promotedRecordId,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      })),
    };
  },

  async pin(actor: Actor, id: string, pinned: boolean) {
    const entry = await conversationMemoryRepository.findById(id);
    if (!entry) throw new AppError("That note does not exist.", 404, "NOT_FOUND");
    if (entry.userId && entry.userId !== actor.id && !roleHasPermission(actor.role, "customer.read")) {
      throw new AppError("That note does not exist.", 404, "NOT_FOUND");
    }
    return conversationMemoryRepository.pin(id, pinned);
  },

  /**
   * Writes something established in a conversation into institutional memory.
   *
   * Explicit, never automatic, and it records the conversation as the source so
   * the resulting fact can be traced back to what was actually said.
   */
  async promote(
    actor: Actor,
    id: string,
    target: { scope: MemoryScope; subjectId: string; kind: MemoryKind; key: string; confidence?: number }
  ) {
    const entry = await conversationMemoryRepository.findById(id);
    if (!entry) throw new AppError("That note does not exist.", 404, "NOT_FOUND");

    const fact = await memoryService.remember(actor, {
      scope: target.scope,
      subjectId: target.subjectId,
      kind: target.kind,
      key: target.key,
      value: parseValue(entry.value),
      // Promoted by a person, so it carries their authority rather than the
      // machine's — unless they say otherwise.
      source: "ADVISOR_ENTERED",
      sourceRef: `conversation:${entry.sessionRef}`,
      ...(target.confidence !== undefined ? { confidence: target.confidence } : {}),
    });

    await conversationMemoryRepository.markPromoted(id, fact.id);

    auditService.record({
      actorId: actor.id,
      action: "memory.promoted",
      metadata: { conversationMemoryId: id, recordId: fact.id, key: target.key },
    });

    return fact;
  },

  /** Removes expired, unpinned entries. Safe to run repeatedly. */
  async sweep() {
    const result = await conversationMemoryRepository.sweep();
    return { swept: result.count };
  },
};

// ── Organisation memory ──────────────────────────────────────────────────────

/**
 * Organisation-level memory.
 *
 * A service over `MemoryRecord` at `ORGANIZATION` scope rather than a table of
 * its own. A parallel table would duplicate supersession, expiry, provenance
 * and the audit trail — and the second copy is always the one that drifts.
 * What is genuinely organisation-specific is the *permission* rule, and that
 * lives in `authorise`.
 */
export const organizationMemoryService = {
  remember(actor: Actor, organizationId: string, input: { kind: MemoryKind; key: string; value: unknown; sourceRef?: string }) {
    return memoryService.remember(actor, {
      scope: "ORGANIZATION",
      subjectId: organizationId,
      kind: input.kind,
      key: input.key,
      value: input.value,
      source: "ADVISOR_ENTERED",
      ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
    });
  },

  recall(actor: Actor, organizationId: string, options: { kind?: MemoryKind; prefix?: string } = {}) {
    return memoryService.recall(actor, "ORGANIZATION", organizationId, options);
  },

  history(actor: Actor, organizationId: string, key: string) {
    return memoryService.keyHistory(actor, "ORGANIZATION", organizationId, key);
  },
};
