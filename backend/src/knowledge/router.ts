/**
 * The Knowledge Router, and the permission check every read goes through.
 *
 * Every AI assistant asks the router; none of them touches a table. That is the
 * point of the sprint: six assistants each building their own query against the
 * knowledge base is six places for a draft article or a restricted compliance
 * note to escape, and six places to fix when the rules change.
 *
 * Routing is rule-driven and readable rather than a classifier. Routing errors
 * are silent — a question sent to the wrong store returns nothing rather than
 * an error, so nobody discovers the rule was wrong. A rule an engineer can read
 * and a test can pin is worth more here than a few points of accuracy.
 */
import AppError from "../utils/appError";
import { auditService } from "../services/audit.service";
import { roleHasPermission } from "../auth/permissions";
import { permissionRepository, readableClassifications } from "./repository";
import type { Actor, Classification, KnowledgeRouter, RoutingDecision } from "./contracts";

/**
 * Signals that a question is about the person asking rather than about the
 * rules. "What is my sum insured" is a memory question; "what is the maximum
 * sum insured" is a knowledge question, and the difference is one word.
 */
const PERSONAL_MARKERS = [
  "my", "mine", "i have", "i hold", "i bought", "my policy", "for me",
  "am i", "do i", "did i", "my claim", "my renewal", "my cover",
];

const DOCUMENT_MARKERS = [
  "document", "documents", "upload", "uploaded", "rc book", "aadhaar",
  "pan card", "certificate", "proof", "photograph", "scan",
];

const ADVICE_MARKERS = [
  "should i", "recommend", "suggest", "which plan", "how much cover",
  "am i underinsured", "do i need", "gap", "better",
];

const REGULATION_MARKERS = [
  "irdai", "regulation", "circular", "rule", "sop", "procedure", "guideline",
  "compliance", "mandated", "statutory", "legally", "law",
];

export class RuleBasedKnowledgeRouter implements KnowledgeRouter {
  route(question: string, context: { hasCustomer?: boolean } = {}): RoutingDecision {
    const q = (question ?? "").toLowerCase().trim();

    if (!q) {
      return {
        source: "NONE",
        why: "There was no question to route.",
        confidence: 1,
        alternates: [],
      };
    }

    const personal = PERSONAL_MARKERS.some((m) => q.includes(m));
    const documents = DOCUMENT_MARKERS.some((m) => q.includes(m));
    const advice = ADVICE_MARKERS.some((m) => q.includes(m));
    const regulation = REGULATION_MARKERS.some((m) => q.includes(m));

    // Order matters, and this order is the argument. Regulation wins over
    // everything because a question naming a circular wants the circular, even
    // when phrased personally — "does IRDAI let me port my policy" is answered
    // by the rule, not by the customer's file.
    if (regulation) {
      return {
        source: "KNOWLEDGE_BASE",
        why: "The question names a rule, circular or procedure, so the answer is what the guidance says rather than anything about this customer.",
        confidence: 0.9,
        alternates: personal ? ["MEMORY"] : [],
      };
    }

    if (documents && context.hasCustomer) {
      return {
        source: "DOCUMENTS",
        why: "The question is about a specific document, and there is a customer in context whose documents can be checked.",
        confidence: 0.8,
        alternates: ["KNOWLEDGE_BASE"],
      };
    }

    if (advice) {
      return {
        source: "INTELLIGENCE",
        why: "The question asks what somebody should do, which is the insurance intelligence engine's job rather than a lookup.",
        confidence: 0.85,
        alternates: ["KNOWLEDGE_BASE", "MEMORY"],
      };
    }

    if (personal && context.hasCustomer) {
      return {
        source: "MEMORY",
        why: "The question is about this person specifically, so it is answered from what the platform knows about them.",
        confidence: 0.8,
        alternates: ["INTELLIGENCE", "KNOWLEDGE_BASE"],
      };
    }

    if (personal && !context.hasCustomer) {
      // Being asked a personal question with nobody in context is a real
      // failure mode, and answering from general knowledge would produce
      // confident nonsense about a customer who was never identified.
      return {
        source: "NONE",
        why: "The question is about a specific person, but no customer is in context. Answering from general guidance would produce something that sounds personal and is not.",
        confidence: 0.9,
        alternates: ["KNOWLEDGE_BASE"],
      };
    }

    return {
      source: "KNOWLEDGE_BASE",
      why: "Nothing marks this as personal, so it is treated as a question about how insurance works.",
      confidence: 0.6,
      alternates: ["INTELLIGENCE"],
    };
  }
}

let routerImpl: KnowledgeRouter = new RuleBasedKnowledgeRouter();
export const knowledgeRouter = (): KnowledgeRouter => routerImpl;
export function registerKnowledgeRouter(router: KnowledgeRouter): void {
  routerImpl = router;
}
export function resetKnowledgeRouter(): void {
  routerImpl = new RuleBasedKnowledgeRouter();
}

// ── Permissions ──────────────────────────────────────────────────────────────

/**
 * Whether a caller may read one article.
 *
 * `PUBLIC` and `INTERNAL` are decided by realm and permission — requiring a
 * grant row per person per article for ordinary guidance would mean nobody
 * could read anything. `RESTRICTED` needs an explicit grant, to this person or
 * to their role, unexpired and unrevoked.
 *
 * Every refusal is audited. A compliance document nobody can explain the access
 * pattern of is a compliance document that fails its own audit.
 */
export const knowledgePermissionService = {
  async canRead(
    actor: Actor,
    article: { id: string; classification: string; status: string }
  ): Promise<{ allowed: boolean; reason?: string }> {
    const classification = article.classification as Classification;

    if (classification !== "RESTRICTED") {
      const readable = readableClassifications(actor);
      if (!readable.includes(classification)) {
        return { allowed: false, reason: "This guidance is internal to staff." };
      }
      return { allowed: true };
    }

    // RESTRICTED from here down.
    if (roleHasPermission(actor.role, "platform.configure")) {
      // A platform operator can read anything, and it is recorded that they did.
      auditService.record({
        actorId: actor.id,
        action: "knowledge.restricted.read",
        entity: "KnowledgeArticle",
        entityId: article.id,
        metadata: { via: "platform.configure" },
      });
      return { allowed: true };
    }

    const grants = await permissionRepository.activeFor(article.id);
    const granted = grants.some(
      (g) => g.granteeUserId === actor.id || (g.granteeRole && g.granteeRole === actor.role)
    );

    if (!granted) {
      auditService.record({
        actorId: actor.id,
        action: "authz.knowledge.denied",
        entity: "KnowledgeArticle",
        entityId: article.id,
        metadata: { classification },
      });
      return { allowed: false, reason: "This document is restricted." };
    }

    auditService.record({
      actorId: actor.id,
      action: "knowledge.restricted.read",
      entity: "KnowledgeArticle",
      entityId: article.id,
      metadata: { via: "grant" },
    });
    return { allowed: true };
  },

  /** Writing needs the permission; approving needs a separate one. */
  assertCanWrite(actor: Actor): void {
    if (!roleHasPermission(actor.role, "knowledge.write")) {
      throw new AppError("You do not have permission to edit knowledge.", 403, "FORBIDDEN");
    }
  },

  /**
   * Approval is a distinct authority from authorship.
   *
   * Deliberately not `knowledge.write`. Somebody who can write guidance must
   * not be able to approve their own — that is the whole point of a review
   * step, and collapsing the two would make the workflow decorative.
   */
  assertCanApprove(actor: Actor): void {
    const canApprove =
      roleHasPermission(actor.role, "knowledge.write") &&
      (roleHasPermission(actor.role, "workflow.approve") ||
        roleHasPermission(actor.role, "platform.configure"));

    if (!canApprove) {
      throw new AppError(
        "Approving knowledge needs review authority, which is separate from being able to write it.",
        403,
        "APPROVAL_FORBIDDEN"
      );
    }
  },

  async grant(
    actor: Actor,
    articleId: string,
    input: { userId?: string; role?: string; access?: string; expiresAt?: Date }
  ) {
    this.assertCanApprove(actor);

    // Exactly one grantee. A grant with neither is a grant to nobody; a grant
    // with both is ambiguous about which one revoking removes.
    const hasUser = Boolean(input.userId);
    const hasRole = Boolean(input.role);
    if (hasUser === hasRole) {
      throw new AppError(
        "A grant names either a person or a role, not both and not neither.",
        400,
        "INVALID_GRANTEE"
      );
    }

    const created = await permissionRepository.grant({
      articleId,
      granteeUserId: input.userId ?? null,
      granteeRole: input.role ?? null,
      access: input.access ?? "READ",
      grantedById: actor.id,
      expiresAt: input.expiresAt ?? null,
    });

    auditService.record({
      actorId: actor.id,
      action: "knowledge.permission.granted",
      entity: "KnowledgeArticle",
      entityId: articleId,
      metadata: { grantee: input.userId ?? input.role, access: input.access ?? "READ" },
    });

    return created;
  },

  async revoke(actor: Actor, permissionId: string) {
    this.assertCanApprove(actor);
    const result = await permissionRepository.revoke(permissionId);
    auditService.record({
      actorId: actor.id,
      action: "knowledge.permission.revoked",
      metadata: { permissionId, revoked: result.count },
    });
    return { revoked: result.count };
  },

  list(articleId: string) {
    return permissionRepository.activeFor(articleId);
  },
};
