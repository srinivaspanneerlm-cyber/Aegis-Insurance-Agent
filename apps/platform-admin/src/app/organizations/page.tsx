"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { StepUpDialog } from "@/components/StepUpDialog";
import { platformApi, PlatformError, type OrganizationRow } from "@/lib/api";

const STATUS_TONE = { ACTIVE: "success", SUSPENDED: "warning", ARCHIVED: "neutral" } as const;

/**
 * Tenancy.
 *
 * Suspension rather than deletion is the primary action, and the wording says
 * why: a hard delete would orphan every record that tenant's staff created.
 * Archival is as close to gone as this console goes.
 */
export default function OrganizationsPage() {
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<OrganizationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<null | { action: string; run: () => Promise<void> }>(null);

  const load = useCallback(async (search: string) => {
    setRows(null);
    setError(null);
    try {
      setRows((await platformApi.organizations(search)).organizations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  /**
   * Run a mutation, and if the API asks for a fresh confirmation, prompt for one
   * and retry. Written once here rather than at each call site — every write on
   * this page needs the same dance.
   */
  const guarded = useCallback((action: string, run: () => Promise<void>) => {
    const attempt = async () => {
      try {
        await run();
        setNotice(null);
      } catch (e) {
        if (e instanceof PlatformError && e.code === "REAUTH_REQUIRED") {
          setPending({ action, run });
          return;
        }
        setError(e instanceof Error ? e.message : "That did not work.");
      }
    };
    void attempt();
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "");
    const form = event.currentTarget;
    guarded("Creating an organisation", async () => {
      await platformApi.createOrganization({
        name,
        emailDomains: String(data.get("emailDomains") ?? "") || undefined,
        plan: String(data.get("plan") ?? "TRIAL"),
      });
      form.reset();
      await load(term);
    });
  }

  function setStatus(org: OrganizationRow, status: string) {
    guarded(`Setting ${org.name} to ${status.toLowerCase()}`, async () => {
      const result = await platformApi.setOrganizationStatus(org.id, status);
      setNotice(
        status === "ACTIVE"
          ? `${org.name} is active again.`
          : `${org.name} ${status.toLowerCase()}. ${result.endedSessions} session(s) ended.`
      );
      await load(term);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Organizations</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          The tenants using Aegis. Suspension ends every session their staff hold.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="rounded-control bg-success/10 px-4 py-3 text-body-sm text-success"
        >
          {notice}
        </p>
      ) : null}

      <Panel title="Add an organisation">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="org-name" className="sr-only">
              Organisation name
            </label>
            <input
              id="org-name"
              name="name"
              required
              placeholder="Acme Insurance Ltd"
              className="h-11 w-full rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div>
            <label htmlFor="org-domains" className="sr-only">
              Email domains
            </label>
            <input
              id="org-domains"
              name="emailDomains"
              placeholder="acme.com"
              className="h-11 w-full rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div className="flex gap-2">
            <label htmlFor="org-plan" className="sr-only">
              Plan
            </label>
            <select
              id="org-plan"
              name="plan"
              className="h-11 flex-1 rounded-control border border-line/60 bg-surface-raised/40 px-2 text-body-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option value="TRIAL">Trial</option>
              <option value="STANDARD">Standard</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
            <button
              type="submit"
              className="focus-ring h-11 rounded-control bg-brand px-4 text-body-sm font-semibold text-brand-fg transition-colors hover:bg-brand-hover"
            >
              Add
            </button>
          </div>
        </form>
      </Panel>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load(term);
        }}
        className="flex gap-3"
      >
        <label htmlFor="org-search" className="sr-only">
          Search organisations
        </label>
        <input
          id="org-search"
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name"
          className="h-11 flex-1 rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
        <button
          type="submit"
          className="focus-ring h-11 rounded-control border border-line px-5 text-body-sm font-medium text-content transition-colors hover:border-line-strong"
        >
          Search
        </button>
      </form>

      <Panel title={rows ? `${rows.length} organisation(s)` : "Loading"}>
        {rows === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty icon="building">No organisations yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((org) => (
              <li
                key={org.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line/30 pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body-sm font-medium text-content">{org.name}</p>
                    <Badge tone={STATUS_TONE[org.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                      {org.status}
                    </Badge>
                    {org.license ? <Badge tone="info">{org.license.plan}</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-caption text-content-muted">
                    {org.slug} · {org._count.members} member(s)
                    {org.license ? ` · ${org.license.seats} seat(s)` : ""}
                    {org.emailDomains ? ` · ${org.emailDomains}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {org.status === "ACTIVE" ? (
                    <button
                      type="button"
                      onClick={() => setStatus(org, "SUSPENDED")}
                      className="focus-ring rounded-control border border-line px-3 py-1.5 text-caption font-medium text-content transition-colors hover:border-warning"
                    >
                      Suspend
                    </button>
                  ) : org.status === "SUSPENDED" ? (
                    <button
                      type="button"
                      onClick={() => setStatus(org, "ACTIVE")}
                      className="focus-ring rounded-control border border-line px-3 py-1.5 text-caption font-medium text-content transition-colors hover:border-success"
                    >
                      Reinstate
                    </button>
                  ) : null}
                  {org.status !== "ARCHIVED" ? (
                    <button
                      type="button"
                      onClick={() => setStatus(org, "ARCHIVED")}
                      className="focus-ring rounded-control border border-line px-3 py-1.5 text-caption font-medium text-content-secondary transition-colors hover:border-danger"
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="text-pretty text-caption text-content-muted">
        There is no delete. Removing a tenant would orphan every record their staff created — cases,
        documents, audit entries — so archival is as far as this console goes.
      </p>

      <StepUpDialog
        open={pending !== null}
        action={pending?.action ?? ""}
        onCancel={() => setPending(null)}
        onConfirmed={() => {
          const p = pending;
          setPending(null);
          if (p) void p.run().then(() => load(term));
        }}
      />
    </div>
  );
}
