/**
 * Repository registry — the single import surface for the data-access layer.
 *
 *   import { userRepository, chatRepository } from "../repositories";
 *
 * Each repository is a singleton bound to the shared Prisma client.
 */
import type {
  User,
  Chat,
  Session,
  Lead,
  Policy,
  Company,
  UploadedDocument,
  RefreshToken,
  LinkedIdentity,
  AuthSession,
  VerificationToken,
  LoginEvent,
  EmployeeProfile,
  WorkItem,
  WorkItemEvent,
  WorkflowRun,
  WorkflowStep,
  KnowledgeArticle,
  AuditLog,
} from "@prisma/client";
import prisma from "../config/db";
import BaseRepository from "./base.repository";

// User — email lookups are hot on the auth path.
class UserRepository extends BaseRepository<User> {
  constructor() {
    super(prisma, "user");
  }
  findByEmail(email: string, options: Record<string, unknown> = {}): Promise<User | null> {
    return this.delegate.findUnique({ where: { email }, ...options });
  }
}

// Chat — always scoped by userId (tenant isolation) and ordered by time.
class ChatRepository extends BaseRepository<Chat> {
  constructor() {
    super(prisma, "chat");
  }
  findRecentByUser(userId: string, take = 8): Promise<Chat[]> {
    return this.delegate.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
  findHistory(where: Record<string, unknown>, take = 200): Promise<Chat[]> {
    return this.delegate.findMany({ where, orderBy: { createdAt: "asc" }, take });
  }
}

class LeadRepository extends BaseRepository<Lead> {
  constructor() {
    super(prisma, "lead");
  }
}

class PolicyRepository extends BaseRepository<Policy> {
  constructor() {
    super(prisma, "policy");
  }
}

class CompanyRepository extends BaseRepository<Company> {
  constructor() {
    super(prisma, "company");
  }
}

class DocumentRepository extends BaseRepository<UploadedDocument> {
  constructor() {
    super(prisma, "uploadedDocument");
  }
  // Duplicate detection: a prior, non-deleted upload by the same owner with the
  // same content hash.
  findDuplicate(ownerId: string | null, contentHash: string): Promise<UploadedDocument | null> {
    return this.delegate.findFirst({ where: { ownerId, contentHash, deletedAt: null } });
  }
}

// RefreshToken — durable, rotating session credentials (only the hash is stored).
class RefreshTokenRepository extends BaseRepository<RefreshToken> {
  constructor() {
    super(prisma, "refreshToken");
  }
  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.delegate.findUnique({ where: { tokenHash } });
  }
  revokeById(id: string): Promise<RefreshToken> {
    return this.delegate.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  /** Revoke every live credential belonging to one sitting. */
  async revokeForSession(sessionId: string): Promise<number> {
    const result = await this.delegate.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /**
   * End every live session this user has. Returns how many were ended, which is
   * what makes the audit entry worth reading afterwards.
   */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.delegate.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
}

// LinkedIdentity — the external accounts a user can sign in with. Looked up on
// (provider, subject), which is the pair the unique index covers.
class LinkedIdentityRepository extends BaseRepository<LinkedIdentity> {
  constructor() {
    super(prisma, "linkedIdentity");
  }

  findBySubject(provider: string, subject: string): Promise<LinkedIdentity | null> {
    return this.delegate.findUnique({ where: { provider_subject: { provider, subject } } });
  }

  /**
   * Attach an external identity to a user, or refresh the one already there.
   *
   * An upsert rather than a create because two tabs finishing a sign-in at once
   * would otherwise race into the unique constraint, and the second one losing
   * is not a reason to refuse somebody entry.
   */
  link(input: {
    userId: string;
    provider: string;
    subject: string;
    email: string | null;
  }): Promise<LinkedIdentity> {
    const { userId, provider, subject, email } = input;
    return this.delegate.upsert({
      where: { provider_subject: { provider, subject } },
      create: { userId, provider, subject, email, lastUsed: new Date() },
      update: { lastUsed: new Date() },
    });
  }

  markUsed(id: string): Promise<LinkedIdentity> {
    return this.delegate.update({ where: { id }, data: { lastUsed: new Date() } });
  }
}

// AuthSession — one row per "somebody signed in here". Distinct from the AI
// conversation `Session`; see the schema comment on why the name differs.
class AuthSessionRepository extends BaseRepository<AuthSession> {
  constructor() {
    super(prisma, "authSession");
  }

  /** What is signed in to this account right now, most recent first. */
  listActive(userId: string, take = 20): Promise<AuthSession[]> {
    return this.delegate.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
      take,
    });
  }

  touch(id: string): Promise<AuthSession> {
    return this.delegate.update({ where: { id }, data: { lastSeenAt: new Date() } });
  }

  revoke(id: string, reason: string): Promise<AuthSession> {
    return this.delegate.update({
      where: { id },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** End every live sitting for this account. Returns how many ended. */
  async revokeAllForUser(userId: string, reason: string): Promise<number> {
    const result = await this.delegate.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }
}

// VerificationToken — one-time proofs for email verification and password reset.
class VerificationTokenRepository extends BaseRepository<VerificationToken> {
  constructor() {
    super(prisma, "verificationToken");
  }

  findByHash(tokenHash: string): Promise<VerificationToken | null> {
    return this.delegate.findUnique({ where: { tokenHash } });
  }

  consume(id: string): Promise<VerificationToken> {
    return this.delegate.update({ where: { id }, data: { consumedAt: new Date() } });
  }

  /**
   * Retire any outstanding token of this purpose before issuing a new one, so
   * requesting a second reset link silently disables the first. Otherwise every
   * link ever sent stays live until it expires, and a forwarded old email is a
   * working account takeover.
   */
  async consumeOutstanding(userId: string, purpose: string): Promise<number> {
    const result = await this.delegate.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return result.count;
  }
}

// LoginEvent — every attempt, successful or not. Append-only.
class LoginEventRepository extends BaseRepository<LoginEvent> {
  constructor() {
    super(prisma, "loginEvent");
  }

  listForUser(userId: string, take = 50): Promise<LoginEvent[]> {
    return this.delegate.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}

// ── Employee operations ─────────────────────────────────────────────────────

class EmployeeProfileRepository extends BaseRepository<EmployeeProfile> {
  constructor() {
    super(prisma, "employeeProfile");
  }

  findByUserId(userId: string): Promise<EmployeeProfile | null> {
    return this.delegate.findUnique({ where: { userId } });
  }

  /** Everyone a router may hand work to, with how much they already hold. */
  async routingCandidates(
    department: string
  ): Promise<
    { id: string; department: string; status: string; workloadLimit: number; openCount: number }[]
  > {
    const people: {
      id: string;
      department: string;
      status: string;
      workloadLimit: number;
    }[] = await this.delegate.findMany({
      where: { department, status: "ACTIVE" },
      select: { id: true, department: true, status: true, workloadLimit: true },
    });

    // One grouped count rather than a query per person — this runs on every
    // piece of work that arrives.
    const open = await prisma.workItem.groupBy({
      by: ["assigneeId"],
      where: { assigneeId: { in: people.map((p) => p.id) }, closedAt: null },
      _count: { _all: true },
    });
    const counts = new Map<string | null, number>(
      (open as { assigneeId: string | null; _count: { _all: number } }[]).map((row) => [
        row.assigneeId,
        row._count._all,
      ])
    );

    return people.map((person) => ({ ...person, openCount: counts.get(person.id) ?? 0 }));
  }
}

class WorkItemRepository extends BaseRepository<WorkItem> {
  constructor() {
    super(prisma, "workItem");
  }

  findByReference(reference: string): Promise<WorkItem | null> {
    return this.delegate.findUnique({ where: { reference } });
  }

  /**
   * Somebody's queue. Overdue and urgent surface first, because a queue sorted
   * by arrival is a queue where the thing about to breach is on page three.
   */
  queueFor(assigneeId: string, take = 50): Promise<WorkItem[]> {
    return this.delegate.findMany({
      where: { assigneeId, closedAt: null },
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
      take,
    });
  }

  openForEscalation(take = 200): Promise<WorkItem[]> {
    return this.delegate.findMany({
      where: { closedAt: null },
      orderBy: { dueAt: "asc" },
      take,
    });
  }
}

class WorkItemEventRepository extends BaseRepository<WorkItemEvent> {
  constructor() {
    super(prisma, "workItemEvent");
  }

  timeline(workItemId: string, take = 100): Promise<WorkItemEvent[]> {
    return this.delegate.findMany({
      where: { workItemId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}

class WorkflowRunRepository extends BaseRepository<WorkflowRun> {
  constructor() {
    super(prisma, "workflowRun");
  }

  findByWorkItem(workItemId: string): Promise<WorkflowRun | null> {
    return this.delegate.findUnique({ where: { workItemId } });
  }
}

class WorkflowStepRepository extends BaseRepository<WorkflowStep> {
  constructor() {
    super(prisma, "workflowStep");
  }

  forRun(runId: string): Promise<WorkflowStep[]> {
    return this.delegate.findMany({ where: { runId }, orderBy: { order: "asc" } });
  }

  findByKey(runId: string, key: string): Promise<WorkflowStep | null> {
    return this.delegate.findUnique({ where: { runId_key: { runId, key } } });
  }
}

class KnowledgeArticleRepository extends BaseRepository<KnowledgeArticle> {
  constructor() {
    super(prisma, "knowledgeArticle");
  }

  /**
   * Search by substring across title, summary and tags.
   *
   * Deliberately simple, and deliberately not pretending otherwise: SQLite has
   * no full-text index here and a `contains` scan is honest about what it is.
   * It is bounded by `take`, so it degrades predictably rather than surprising
   * somebody at ten thousand articles — which is when this earns a real index.
   */
  search(term: string, category?: string, take = 20): Promise<KnowledgeArticle[]> {
    const query = term.trim();
    return this.delegate.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { summary: { contains: query } },
                { tags: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: { publishedAt: "desc" },
      take,
    });
  }
}

// AuditLog — append-only compliance trail (writes are best-effort, never block).
class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor() {
    super(prisma, "auditLog");
  }
}

export { BaseRepository };
/**
 * Conversation sessions the AI engine owns.
 *
 * The engine mints a session id and the browser echoes it back on the next
 * turn. `Chat.sessionId` is a foreign key to this table, so a chat could only
 * carry that id if a row for it existed — and nothing created one. The first
 * turn stored null and passed; the second, the moment a well-behaved client
 * used the id it had just been given, violated the constraint and returned 500.
 */
class SessionRepository extends BaseRepository<Session> {
  constructor() {
    super(prisma, "session");
  }

  /**
   * Make sure a chat may reference this session, without disturbing one that is
   * already there — the engine keeps a session across many turns, and each turn
   * should only move `lastActive`.
   */
  async ensure(
    sessionId: string,
    data: { userId?: string | null; agentDomain?: string | null; agentName?: string | null }
  ): Promise<void> {
    await this.delegate.upsert({
      where: { sessionId },
      create: { sessionId, ...data },
      update: { lastActive: new Date() },
    });
  }
}

export const userRepository = new UserRepository();
export const chatRepository = new ChatRepository();
export const sessionRepository = new SessionRepository();
export const leadRepository = new LeadRepository();
export const policyRepository = new PolicyRepository();
export const companyRepository = new CompanyRepository();
export const documentRepository = new DocumentRepository();
export const refreshTokenRepository = new RefreshTokenRepository();
export const linkedIdentityRepository = new LinkedIdentityRepository();
export const authSessionRepository = new AuthSessionRepository();
export const verificationTokenRepository = new VerificationTokenRepository();
export const loginEventRepository = new LoginEventRepository();
export const employeeProfileRepository = new EmployeeProfileRepository();
export const workItemRepository = new WorkItemRepository();
export const workItemEventRepository = new WorkItemEventRepository();
export const workflowRunRepository = new WorkflowRunRepository();
export const workflowStepRepository = new WorkflowStepRepository();
export const knowledgeArticleRepository = new KnowledgeArticleRepository();
export const auditRepository = new AuditLogRepository();
