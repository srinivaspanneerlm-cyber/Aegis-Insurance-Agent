import { API_URL } from "@/lib/workspace";
import type { Analytics, KnowledgeArticle, WorkItem } from "@/lib/workspace";

/**
 * The workspace's API client.
 *
 * `credentials: "include"` on everything — the session is an httpOnly cookie,
 * and omitting it produces a request that succeeds and is silently anonymous.
 */
export class WorkspaceError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "WorkspaceError";
    this.status = status;
    this.code = code;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } catch {
    throw new WorkspaceError("We could not reach Aegis.", 0, "NETWORK");
  }

  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new WorkspaceError(
      body.message ?? "Something went wrong.",
      response.status,
      body.code ?? "UNKNOWN"
    );
  }
  return body.data as T;
}

export const workspaceApi = {
  queue: () => call<{ items: WorkItem[] }>("/employee/work"),
  workItem: (id: string) => call<unknown>(`/employee/work/${encodeURIComponent(id)}`),
  analytics: () => call<Analytics>("/employee/analytics"),
  knowledge: (q: string, category?: string) =>
    call<{ articles: KnowledgeArticle[] }>(
      `/employee/knowledge?q=${encodeURIComponent(q)}${category ? `&category=${encodeURIComponent(category)}` : ""}`
    ),
  workflows: () => call<{ definitions: WorkflowDefinitionView[] }>("/employee/workflows"),
  escalations: () => call<{ escalations: Escalation[] }>("/employee/escalations"),
};

export interface WorkflowDefinitionView {
  definition: string;
  label: string;
  kind: string;
  steps: {
    key: string;
    name: string;
    description: string;
    actorKind: "SYSTEM" | "ASSISTANT" | "EMPLOYEE";
    requiresDecision: boolean;
  }[];
}

export interface Escalation {
  workItemId: string;
  reason: string;
  detail: string;
}
