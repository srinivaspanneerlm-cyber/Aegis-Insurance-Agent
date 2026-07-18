/**
 * Repository registry — the single import surface for the data-access layer.
 *
 *   import { userRepository, chatRepository } from "../repositories";
 *
 * Each repository is a singleton bound to the shared Prisma client.
 */
import type { User, Chat, Lead, Policy, Company, UploadedDocument } from "@prisma/client";
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
  findByOwner(ownerId: string, options: Record<string, unknown> = {}): Promise<UploadedDocument[]> {
    return this.delegate.findMany({
      where: { ownerId },
      orderBy: { uploadedAt: "desc" },
      ...options,
    });
  }
}

export { BaseRepository };
export const userRepository = new UserRepository();
export const chatRepository = new ChatRepository();
export const leadRepository = new LeadRepository();
export const policyRepository = new PolicyRepository();
export const companyRepository = new CompanyRepository();
export const documentRepository = new DocumentRepository();
