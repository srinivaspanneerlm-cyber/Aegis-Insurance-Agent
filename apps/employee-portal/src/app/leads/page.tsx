"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { usePermissions } from "@/context/WorkspaceProvider";
import { workspaceApi, type Lead, type LeadStatus, type Pagination } from "@/lib/api";

const PAGE_SIZE = 20;

/** The pipeline, in the order somebody moves through it. */
const STAGES: { value: LeadStatus; label: string }[] = [
  { value: "pending", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const STAGE_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pending: "neutral",
  contacted: "info",
  qualified: "warning",
  won: "success",
  lost: "danger",
};

/**
 * The lead pipeline.
 *
 * `lead.read` and `lead.write` have been in every employee's permission set
 * and the list, detail and update endpoints have been live, with no screen in
 * this portal reading any of them. An advisor could see a customer's whole
 * protection analysis and not the enquiry that brought them in.
 *
 * Two things it deliberately does not do. It does not count the pipeline from
 * the rows on screen — the server paginates and the totals below are the
 * page's, which is said rather than implied. And it does not offer "assign to
 * me": `assignedToId` exists on the record, PUT would accept it, and the route
 * has no body validation — so writing it from here would be exploiting a gap
 * rather than using a feature.
 */
export default function LeadsPage() {
  const { can } = usePermissions();

  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const ticket = useRef(0);

  const load = useCallback(async (which: number) => {
    const mine = ++ticket.current;
    setError(null);
    try {
      const { data, pagination: meta } = await workspaceApi.leads(which, PAGE_SIZE);
      if (mine !== ticket.current) return;
      setLeads(data.leads);
      setPagination(meta);
    } catch (err) {
      if (mine !== ticket.current) return;
      setError(err instanceof Error ? err.message : "Could not load the pipeline.");
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const move = useCallback(
    async (id: string, status: LeadStatus) => {
      setBusy(id);
      setActionError(null);
      try {
        await workspaceApi.updateLeadStatus(id, status);
        await load(page);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "That did not go through.");
      } finally {
        setBusy(null);
      }
    },
    [load, page]
  );

  // Counted from this page only, and labelled as such below.
  const onThisPage = STAGES.map((stage) => ({
    ...stage,
    count: (leads ?? []).filter((lead) => lead.status === stage.value).length,
  }));

  const editable = can("lead.write");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Leads</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Enquiries that have come in, and where each one has reached.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Leads in total" value={pagination?.total ?? "—"} icon="users" />
        <Stat
          label="Won on this page"
          value={onThisPage.find((s) => s.value === "won")?.count ?? "—"}
          tone="success"
          icon="check"
        />
        <Stat
          label="Waiting on first contact"
          value={onThisPage.find((s) => s.value === "pending")?.count ?? "—"}
          tone={
            (onThisPage.find((s) => s.value === "pending")?.count ?? 0) > 0 ? "warning" : "neutral"
          }
          icon="clock"
        />
      </div>

      {/* Said plainly, because two of the three figures above are page-scoped and
          a conversion rate read off them would be wrong. */}
      <p className="text-caption text-content-muted">
        The stage counts are for the {leads?.length ?? 0} leads on this page. The endpoint paginates
        and takes no stage filter, so a pipeline-wide breakdown is not available without reading
        every page.
      </p>

      {actionError ? (
        <p role="alert" className="text-body-sm text-danger">
          {actionError}
        </p>
      ) : null}

      <Panel title={pagination ? `${pagination.total} leads` : "Pipeline"}>
        {error ? (
          <Empty icon="close">{error}</Empty>
        ) : leads === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <Empty>No enquiries have come in yet.</Empty>
        ) : (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line/50 text-caption text-content-muted">
                    <th scope="col" className="pb-2 pr-4 font-medium uppercase tracking-wide">
                      Who
                    </th>
                    <th scope="col" className="pb-2 pr-4 font-medium uppercase tracking-wide">
                      Wants
                    </th>
                    <th scope="col" className="pb-2 pr-4 font-medium uppercase tracking-wide">
                      Budget
                    </th>
                    <th scope="col" className="pb-2 pr-4 font-medium uppercase tracking-wide">
                      Stage
                    </th>
                    <th scope="col" className="pb-2 font-medium uppercase tracking-wide">
                      {editable ? "Move to" : "Came in"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-line/30 last:border-0">
                      <td className="py-3 pr-4">
                        <p className="text-body-sm text-content">{lead.customerName}</p>
                        {/* The contact details are the point of a lead — an
                            advisor picking this up needs to be able to ring
                            them without opening another screen. */}
                        <p className="break-words text-caption text-content-muted">
                          {lead.email} · {lead.phone}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-body-sm text-content-secondary">
                        {lead.insuranceType}
                      </td>
                      <td className="py-3 pr-4 text-body-sm text-content-secondary">
                        {lead.budget}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={STAGE_TONE[lead.status] ?? "neutral"}>
                          {STAGES.find((s) => s.value === lead.status)?.label ?? lead.status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {editable ? (
                          <StagePicker lead={lead} busy={busy === lead.id} onMove={move} />
                        ) : (
                          <time
                            dateTime={lead.createdAt}
                            className="text-caption text-content-secondary"
                          >
                            {new Date(lead.createdAt).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </time>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-col gap-3 sm:hidden">
              {leads.map((lead) => (
                <li key={lead.id} className="rounded-card border border-line/50 p-4">
                  <p className="text-body-sm font-medium text-content">{lead.customerName}</p>
                  <p className="mt-1 break-words text-caption text-content-muted">
                    {lead.email} · {lead.phone}
                  </p>
                  <p className="mt-2 text-body-sm text-content-secondary">
                    {lead.insuranceType} · {lead.budget}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={STAGE_TONE[lead.status] ?? "neutral"}>
                      {STAGES.find((s) => s.value === lead.status)?.label ?? lead.status}
                    </Badge>
                    {editable ? (
                      <StagePicker lead={lead} busy={busy === lead.id} onMove={move} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {pagination && pagination.pages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="focus-ring rounded-control border border-line/50 px-3 py-1.5 text-body-sm text-content-secondary disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-caption text-content-muted">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="focus-ring rounded-control border border-line/50 px-3 py-1.5 text-body-sm text-content-secondary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

/**
 * Moving a lead to another stage.
 *
 * A `<select>` rather than a row of buttons: five stages times twenty rows is a
 * hundred controls to tab through, and the stage a lead is already in should
 * not be offered as somewhere to move it.
 */
function StagePicker({
  lead,
  busy,
  onMove,
}: {
  lead: Lead;
  busy: boolean;
  onMove: (id: string, status: LeadStatus) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Move {lead.customerName} to another stage</span>
      <select
        value=""
        disabled={busy}
        onChange={(event) => {
          const next = event.target.value as LeadStatus;
          if (next) onMove(lead.id, next);
        }}
        className="focus-ring rounded-control border border-line/50 bg-surface px-2 py-1 text-caption text-content disabled:opacity-50"
      >
        <option value="">{busy ? "Saving…" : "Move to…"}</option>
        {STAGES.filter((stage) => stage.value !== lead.status).map((stage) => (
          <option key={stage.value} value={stage.value}>
            {stage.label}
          </option>
        ))}
      </select>
    </label>
  );
}
