/**
 * The knowledge API client.
 *
 * A thin, typed wrapper over the Phase A endpoints. It does three things the
 * portals would otherwise each do slightly differently: send the session
 * cookie, turn an error envelope into a thrown error carrying its code, and
 * cache reads that are safe to cache.
 *
 * `credentials: "include"` on everything. Omitting it produces a request that
 * succeeds and is silently anonymous, which is the worst possible failure —
 * the caller sees an empty list and concludes there is no knowledge, rather
 * than that they were not signed in.
 */
import type {
  ConversationMemoryEntry,
  KnowledgeArticle,
  KnowledgeCategory,
  KnowledgeHistory,
  KnowledgeTag,
  MemoryFact,
  MemoryScope,
  RoutingDecision,
  SearchResult,
} from "./types";

export class KnowledgeError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "KnowledgeError";
    this.status = status;
    this.code = code;
  }
}

/**
 * A small time-boxed cache for reads.
 *
 * Categories and tags change roughly never and are read on every page; without
 * this, opening four screens fetches the same list four times. Deliberately not
 * a general-purpose cache — writes clear it wholesale, because a stale article
 * list after an approval is worse than the request it saved.
 */
class ReadCache {
  private readonly entries = new Map<string, { at: number; value: unknown }>();
  constructor(private readonly ttlMs = 30_000) {}

  get<T>(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set(key: string, value: unknown): void {
    this.entries.set(key, { at: Date.now(), value });
  }

  clear(): void {
    this.entries.clear();
  }
}

export interface ClientOptions {
  /** The API root, e.g. `http://localhost:5000/api/v1`. */
  readonly baseUrl: string;
  /** Injected in tests. Defaults to the global fetch. */
  readonly fetchImpl?: typeof fetch;
  readonly cacheTtlMs?: number;
}

export class KnowledgeClient {
  private readonly cache: ReadCache;
  private readonly doFetch: typeof fetch;

  constructor(private readonly options: ClientOptions) {
    this.cache = new ReadCache(options.cacheTtlMs ?? 30_000);
    this.doFetch = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  private async call<T>(path: string, init: RequestInit = {}, cacheable = false): Promise<T> {
    const key = `${init.method ?? "GET"} ${path}`;
    if (cacheable) {
      const hit = this.cache.get<T>(key);
      if (hit !== undefined) return hit;
    }

    let response: Response;
    try {
      response = await this.doFetch(`${this.options.baseUrl}${path}`, {
        ...init,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
    } catch {
      // A network failure and a 500 are different problems with different
      // advice, so they get different codes rather than one generic error.
      throw new KnowledgeError("We could not reach Aegis.", 0, "NETWORK");
    }

    let body: { status?: string; data?: T; message?: string; code?: string } = {};
    try {
      body = (await response.json()) as typeof body;
    } catch {
      if (!response.ok) {
        throw new KnowledgeError("Something went wrong.", response.status, "BAD_RESPONSE");
      }
    }

    if (!response.ok) {
      throw new KnowledgeError(
        body.message ?? "Something went wrong.",
        response.status,
        body.code ?? "ERROR"
      );
    }

    const data = body.data as T;
    if (cacheable) this.cache.set(key, data);
    return data;
  }

  /** Anything that changes content invalidates every cached read. */
  private mutate<T>(path: string, init: RequestInit): Promise<T> {
    this.cache.clear();
    return this.call<T>(path, init);
  }

  // ── Knowledge ──────────────────────────────────────────────────────────────

  categories(): Promise<{ categories: KnowledgeCategory[] }> {
    return this.call("/knowledge/categories", {}, true);
  }

  tags(): Promise<{ tags: KnowledgeTag[] }> {
    return this.call("/knowledge/tags", {}, true);
  }

  articles(
    filters: {
      category?: string;
      categoryId?: string;
      status?: string;
      take?: number;
    } = {}
  ): Promise<{ articles: KnowledgeArticle[] }> {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.status) params.set("status", filters.status);
    params.set("take", String(filters.take ?? 30));
    return this.call(`/knowledge/articles?${params}`, {}, true);
  }

  article(idOrSlug: string): Promise<KnowledgeArticle> {
    return this.call(`/knowledge/articles/${encodeURIComponent(idOrSlug)}`);
  }

  history(id: string): Promise<KnowledgeHistory> {
    return this.call(`/knowledge/articles/${encodeURIComponent(id)}/history`);
  }

  search(query: {
    q: string;
    category?: string;
    take?: number;
    includeUnapproved?: boolean;
  }): Promise<SearchResult> {
    const params = new URLSearchParams({ q: query.q });
    if (query.category) params.set("category", query.category);
    if (query.take) params.set("take", String(query.take));
    if (query.includeUnapproved) params.set("includeUnapproved", "true");
    return this.call(`/knowledge/search?${params}`);
  }

  route(question: string, hasCustomer = false): Promise<RoutingDecision> {
    return this.call("/knowledge/route", {
      method: "POST",
      body: JSON.stringify({ question, hasCustomer }),
    });
  }

  createArticle(input: Record<string, unknown>): Promise<KnowledgeArticle> {
    return this.mutate("/knowledge/articles", { method: "POST", body: JSON.stringify(input) });
  }

  updateArticle(id: string, input: Record<string, unknown>): Promise<KnowledgeArticle> {
    return this.mutate(`/knowledge/articles/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  submit(id: string): Promise<KnowledgeArticle> {
    return this.mutate(`/knowledge/articles/${encodeURIComponent(id)}/submit`, { method: "POST" });
  }

  review(
    id: string,
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
    notes?: string
  ): Promise<KnowledgeArticle> {
    return this.mutate(`/knowledge/articles/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, notes }),
    });
  }

  archive(id: string, reason: string): Promise<KnowledgeArticle> {
    return this.mutate(`/knowledge/articles/${encodeURIComponent(id)}/archive`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  analytics(): Promise<Record<string, unknown>> {
    return this.call("/knowledge/analytics");
  }

  // ── Memory ─────────────────────────────────────────────────────────────────

  memory(
    scope: MemoryScope,
    subjectId: string,
    options: { kind?: string; prefix?: string } = {}
  ): Promise<{ facts: MemoryFact[] }> {
    const params = new URLSearchParams();
    if (options.kind) params.set("kind", options.kind);
    if (options.prefix) params.set("prefix", options.prefix);
    return this.call(`/knowledge/memory/${scope}/${encodeURIComponent(subjectId)}?${params}`);
  }

  memoryHistory(
    scope: MemoryScope,
    subjectId: string,
    key: string
  ): Promise<{ key: string; entries: MemoryFact[] }> {
    return this.call(
      `/knowledge/memory/${scope}/${encodeURIComponent(subjectId)}/history/${encodeURIComponent(key)}`
    );
  }

  memoryExport(
    scope: MemoryScope,
    subjectId: string
  ): Promise<{ scope: string; subjectId: string; exportedAt: string; records: MemoryFact[] }> {
    return this.call(`/knowledge/memory/${scope}/${encodeURIComponent(subjectId)}/export`);
  }

  conversationMemory(sessionRef: string): Promise<{
    sessionRef: string;
    entries: ConversationMemoryEntry[];
  }> {
    return this.call(`/knowledge/conversation-memory/${encodeURIComponent(sessionRef)}`);
  }

  pinConversationMemory(id: string, pinned: boolean): Promise<ConversationMemoryEntry> {
    return this.mutate(`/knowledge/conversation-memory/${encodeURIComponent(id)}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned }),
    });
  }
}
