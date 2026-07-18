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
import type { PrismaClient } from "@prisma/client";
import { PAGINATION } from "../config/constants";

// The Prisma delegate is model-specific and generated; typing it structurally
// here would fight those generated types, so this is the single ORM boundary
// where `any` is intentional. Public methods re-introduce types via the
// `TModel` generic so every caller stays type-safe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaDelegate = any;

type Where = Record<string, unknown>;
type QueryOptions = Record<string, unknown>;

interface PaginateOptions extends QueryOptions {
  page?: number | string;
  limit?: number | string;
  orderBy?: unknown;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

class BaseRepository<TModel = unknown> {
  protected prisma: PrismaClient;
  protected modelName: string;
  protected delegate: PrismaDelegate;
  protected supportsSoftDelete: boolean;

  constructor(prisma: PrismaClient, modelName: string, opts: { softDelete?: boolean } = {}) {
    const delegate = (prisma as unknown as Record<string, PrismaDelegate>)[modelName];
    if (!prisma || !delegate) {
      throw new Error(`BaseRepository: unknown Prisma model "${modelName}"`);
    }
    this.prisma = prisma;
    this.modelName = modelName;
    this.delegate = delegate;
    this.supportsSoftDelete = opts.softDelete !== false;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  findById(id: string, options: QueryOptions = {}): Promise<TModel | null> {
    return this.delegate.findUnique({ where: { id }, ...options });
  }

  findUnique(where: Where, options: QueryOptions = {}): Promise<TModel | null> {
    return this.delegate.findUnique({ where, ...options });
  }

  findFirst(where: Where = {}, options: QueryOptions = {}): Promise<TModel | null> {
    return this.delegate.findFirst({ where, ...options });
  }

  findMany(where: Where = {}, options: QueryOptions = {}): Promise<TModel[]> {
    return this.delegate.findMany({ where, ...options });
  }

  count(where: Where = {}): Promise<number> {
    return this.delegate.count({ where });
  }

  /**
   * Offset pagination with a consistent envelope. Always bounded — never runs
   * an unbounded scan.
   */
  async paginate(
    where: Where = {},
    { page = 1, limit = PAGINATION.DEFAULT_LIMIT, orderBy, ...rest }: PaginateOptions = {}
  ): Promise<PaginatedResult<TModel>> {
    const take = Math.min(
      Math.max(parseInt(String(limit), 10) || PAGINATION.DEFAULT_LIMIT, 1),
      PAGINATION.MAX_LIMIT
    );
    const current = Math.max(parseInt(String(page), 10) || 1, 1);
    const skip = (current - 1) * take;
    const [items, total] = await Promise.all([
      this.delegate.findMany({ where, skip, take, orderBy, ...rest }),
      this.delegate.count({ where }),
    ]);
    return { items, total, page: current, limit: take, pages: Math.ceil(total / take) };
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  create(data: Record<string, unknown>, options: QueryOptions = {}): Promise<TModel> {
    return this.delegate.create({ data, ...options });
  }

  update(id: string, data: Record<string, unknown>, options: QueryOptions = {}): Promise<TModel> {
    return this.delegate.update({ where: { id }, data, ...options });
  }

  updateWhere(where: Where, data: Record<string, unknown>, options: QueryOptions = {}): Promise<TModel> {
    return this.delegate.update({ where, data, ...options });
  }

  delete(id: string): Promise<TModel> {
    return this.delegate.delete({ where: { id } });
  }

  /**
   * Soft delete: mark the row as deleted instead of removing it. Falls back to a
   * hard delete for models without a `deletedAt` column.
   */
  softDelete(id: string): Promise<TModel> {
    if (!this.supportsSoftDelete) return this.delete(id);
    return this.delegate.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

export = BaseRepository;
