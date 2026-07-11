/**
 * Repository registry — the single import surface for the data-access layer.
 *
 *   const { userRepository, chatRepository } = require("../repositories");
 *
 * Each repository is a singleton bound to the shared Prisma client.
 */
const prisma = require("../config/db");
const BaseRepository = require("./base.repository");

// User — email lookups are hot on the auth path.
class UserRepository extends BaseRepository {
  constructor() {
    super(prisma, "user");
  }
  findByEmail(email, options = {}) {
    return this.delegate.findUnique({ where: { email }, ...options });
  }
}

// Chat — always scoped by userId (tenant isolation) and ordered by time.
class ChatRepository extends BaseRepository {
  constructor() {
    super(prisma, "chat");
  }
  findRecentByUser(userId, take = 8) {
    return this.delegate.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
  findHistory(where, take = 200) {
    return this.delegate.findMany({ where, orderBy: { createdAt: "asc" }, take });
  }
}

class LeadRepository extends BaseRepository {
  constructor() {
    super(prisma, "lead");
  }
}

class PolicyRepository extends BaseRepository {
  constructor() {
    super(prisma, "policy");
  }
}

class CompanyRepository extends BaseRepository {
  constructor() {
    super(prisma, "company");
  }
}

class DocumentRepository extends BaseRepository {
  constructor() {
    super(prisma, "uploadedDocument");
  }
  findByOwner(ownerId, options = {}) {
    return this.delegate.findMany({
      where: { ownerId },
      orderBy: { uploadedAt: "desc" },
      ...options,
    });
  }
}

module.exports = {
  BaseRepository,
  userRepository: new UserRepository(),
  chatRepository: new ChatRepository(),
  leadRepository: new LeadRepository(),
  policyRepository: new PolicyRepository(),
  companyRepository: new CompanyRepository(),
  documentRepository: new DocumentRepository(),
};
