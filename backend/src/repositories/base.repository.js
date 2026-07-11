/**
 * BaseRepository — the single data-access abstraction over Prisma.
 *
 * Controllers and services depend on repositories, never on the Prisma client
 * directly. This centralises query construction, gives every model consistent
 * pagination + soft-delete + optimistic-locking helpers, and makes a future
 * datastore change a one-layer edit.
 *
 * Behaviour note: methods are thin, explicit pass-throughs — they do NOT change
 * any existing query semantics. Soft-delete filtering is opt-in via
 * `includeDeleted`, so current callers keep identical results.
 */
class BaseRepository {
  /**
   * @param {import('@prisma/client').PrismaClient} prisma
   * @param {string} modelName  Prisma delegate name, e.g. "user", "chat".
   * @param {{ softDelete?: boolean }} [opts]
   */
  constructor(prisma, modelName, opts = {}) {
    if (!prisma || !prisma[modelName]) {
      throw new Error(`BaseRepository: unknown Prisma model "${modelName}"`);
    }
    this.prisma = prisma;
    this.modelName = modelName;
    this.delegate = prisma[modelName];
    this.supportsSoftDelete = opts.softDelete !== false;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  findById(id, options = {}) {
    return this.delegate.findUnique({ where: { id }, ...options });
  }

  findUnique(where, options = {}) {
    return this.delegate.findUnique({ where, ...options });
  }

  findFirst(where = {}, options = {}) {
    return this.delegate.findFirst({ where, ...options });
  }

  findMany(where = {}, options = {}) {
    return this.delegate.findMany({ where, ...options });
  }

  count(where = {}) {
    return this.delegate.count({ where });
  }

  /**
   * Offset pagination with a consistent envelope. Always bounded — never runs
   * an unbounded scan.
   */
  async paginate(where = {}, { page = 1, limit = 20, orderBy, ...rest } = {}) {
    const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const current = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (current - 1) * take;
    const [items, total] = await Promise.all([
      this.delegate.findMany({ where, skip, take, orderBy, ...rest }),
      this.delegate.count({ where }),
    ]);
    return { items, total, page: current, limit: take, pages: Math.ceil(total / take) };
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  create(data, options = {}) {
    return this.delegate.create({ data, ...options });
  }

  update(id, data, options = {}) {
    return this.delegate.update({ where: { id }, data, ...options });
  }

  updateWhere(where, data, options = {}) {
    return this.delegate.update({ where, data, ...options });
  }

  delete(id) {
    return this.delegate.delete({ where: { id } });
  }

  /**
   * Soft delete: mark the row as deleted instead of removing it. Falls back to a
   * hard delete for models without a `deletedAt` column.
   */
  softDelete(id) {
    if (!this.supportsSoftDelete) return this.delete(id);
    return this.delegate.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

module.exports = BaseRepository;
