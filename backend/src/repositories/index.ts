/**
 * Repository registry — the single import surface for the data-access layer.
 *
 *   import { userRepository, chatRepository } from "../repositories";
 *
 * Each repository is a singleton bound to the shared Prisma client.
 */
import type { User, Chat, Lead, Policy, Company, UploadedDocument, RefreshToken, LinkedIdentity, AuditLog } from "@prisma/client";
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

// AuditLog — append-only compliance trail (writes are best-effort, never block).
class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor() {
    super(prisma, "auditLog");
  }
}

export { BaseRepository };
export const userRepository = new UserRepository();
export const chatRepository = new ChatRepository();
export const leadRepository = new LeadRepository();
export const policyRepository = new PolicyRepository();
export const companyRepository = new CompanyRepository();
export const documentRepository = new DocumentRepository();
export const refreshTokenRepository = new RefreshTokenRepository();
export const linkedIdentityRepository = new LinkedIdentityRepository();
export const auditRepository = new AuditLogRepository();
