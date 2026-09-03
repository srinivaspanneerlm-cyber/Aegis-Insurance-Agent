"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { usePermissions } from "@/context/WorkspaceProvider";
import {
  workspaceApi,
  type ClosedReason,
  type ContactChannel,
  type Pagination,
  type RenewalRequest,
  type RenewalStatus,
} from "@/lib/api";

const PAGE_SIZE = 20;

/**
 * Renewal requests.
 *
 * Customers who already hold cover and have asked a person for help renewing
 * it. A different queue from Leads, and deliberately not merged with it: that
 * one is a sales enquiry the platform raised about a prospect and is worked
 * pending → won/lost, and this is somebody's own policy running out. Sharing a
 * status vocabulary between the two would have meant one that is wrong for both.
 *
 * The screen is built around one question — *who needs ringing next* — so the
 * order is the API's, urgency first and oldest first within a band, and the
 * things an operator needs to act are on the row rather than behind it: the
 * number, the channel they asked for, and whether the permission still stands.
 *
 * Two things it will not do. It does not offer a move the workflow forbids, so
 * a request cannot be closed straight from New. And it does not hide that a
 * customer has withdrawn their consent — a row with no live permission is
 * marked and stays visible, because deleting it would erase the fact that they
 * once asked.
 */

const STAGES: { value: RenewalStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUOTE_REQUESTED", label: "Quote requested" },
  { value: "PARTNER_HANDOFF", label: "Partner handoff" },
  { value: "CLOSED", label: "Closed" },
];

/** Mirrors the API's transition table. A move it forbids is not offered here. */
const NEXT: Record<RenewalStatus, RenewalStatus[]> = {
  NEW: ["CONTACTED"],
  CONTACTED: ["QUOTE_REQUESTED", "PARTNER_HANDOFF", "CLOSED"],
  QUOTE_REQUESTED: ["PARTNER_HANDOFF", "CLOSED"],
  PARTNER_HANDOFF: ["CLOSED"],
  CLOSED: [],
};

const CLOSED_REASONS: { value: ClosedReason; label: string }[] = [
  { value: "RENEWED_WITH_PARTNER", label: "Renewed with partner" },
  { value: "RENEWED_ELSEWHERE", label: "Renewed elsewhere" },
  { value: "CUSTOMER_DECLINED", label: "Customer declined" },
  { value: "UNREACHABLE", label: "Could not reach them" },
  { value: "DUPLICATE_REQUEST", label: "Duplicate request" },
  { value: "NOT_ELIGIBLE", label: "Not eligible" },
];

const STAGE_TONE: Record<RenewalStatus, "neutral" | "info" | "warning" | "success"> = {
  NEW: "warning",
  CONTACTED: "info",
  QUOTE_REQUESTED: "info",
  PARTNER_HANDOFF: "info",
  CLOSED: "success",
};

const URGENCY_TONE: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  NONE: "neutral",
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  CRITICAL: "danger",
};

const CHANNEL_LABEL: Record<ContactChannel, string> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

export default function RenewalRequestsPage() {
  const { can } = usePermissions();

  const [requests, setRequests] = useState<RenewalRequest[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RenewalStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Which row is being closed, so the reason is asked for before it happens. */
  const [closing, setClosing] = useState<string | null>(null);

  const ticket = useRef(0);

  const load = useCallback(async (which: number, filter: RenewalStatus | "") => {
    const mine = ++ticket.current;
    setError(null);
    try {
      const { data, pagination: meta } = await workspaceApi.renewalRequests(
        { status: filter },
        which,
        PAGE_SIZE
      );
      if (mine !== ticket.current) return;
      setRequests(data.leads);
      setPagination(meta);
    } catch (err) {
      if (mine !== ticket.current) return;
      setError(err instanceof Error ? err.message : "Could not load the queue.");
    }
  }, []);

  useEffect(() => {
    void load(page, status);
  }, [load, page, status]);

  const move = useCallback(
    async (id: string, next: RenewalStatus, closedReason?: ClosedReason) => {
      setBusy(id);
      setActionError(null);
      try {
        await workspaceApi.advanceRenewalRequest(id, {
          status: next,
          ...(closedReason ? { closedReason } : {}),
        });
        setClosing(null);
        await load(page, status);
      } catch (err) {
        // The API explains a refused move in terms of what the request *can* do
        // next. Showing its own sentence is more useful than any we could write.
        setActionError(err instanceof Error ? err.message : "That did not go through.");
      } finally {
        setBusy(null);
      }
    },
    [load, page, status]
  );

  const editable = can("lead.write");

  // Counted from this page only, and said so below.
  const onThisPage = (value: RenewalStatus) =>
    (requests ?? []).filter((request) => request.status === value).length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-content">Renewal requests</h1>
          <p className="mt-1 text-body-sm text-content-secondary">
            Customers who asked for help renewing a policy they already hold. Nothing is sent
            automatically — every one of these is somebody waiting for a person.
          </p>
        </div>

        {/* A plain link, so the browser downloads it with the session cookie
            attached. The API decides what a row contains and neutralises any
            value a spreadsheet would try to evaluate. */}
        <a
          href={workspaceApi.renewalRequestsCsvUrl({ status })}
          data-testid="export-csv"
          className="inline-flex min-h-[40px] items-center rounded-pill border border-line/60 px-4 text-body-sm font-semibold text-content transition-colors hover:border-brand/50"
        >
          Export CSV
        </a>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Requests in total" value={pagination?.total ?? "—"} icon="users" />
        <Stat
          label="Waiting on first contact"
          value={onThisPage("NEW")}
          tone={onThisPage("NEW") > 0 ? "warning" : "neutral"}
          icon="clock"
        />
        <Stat
          label="Closed on this page"
          value={onThisPage("CLOSED")}
          tone="success"
          icon="check"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="status-filter" className="text-caption text-content-muted">
          Show
        </label>
        <select
          id="status-filter"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as RenewalStatus | "");
          }}
          className="rounded-pill border border-line/60 bg-surface-raised/40 px-3 py-1.5 text-body-sm text-content"
        >
          <option value="">Everything</option>
          {STAGES.map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </select>

        <p className="text-caption text-content-muted">
          The two figures above marked &ldquo;on this page&rdquo; count the {requests?.length ?? 0}{" "}
          requests shown, not the whole queue.
        </p>
      </div>

      {actionError ? (
        <p role="alert" className="text-body-sm text-danger">
          {actionError}
        </p>
      ) : null}

      <Panel title={pagination ? `${pagination.total} requests` : "Queue"}>
        {error ? (
          <Empty icon="close">{error}</Empty>
        ) : requests === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <Empty>Nobody is waiting for a call right now.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => (
              <li
                key={request.id}
                data-testid={`request-${request.id}`}
                className="flex flex-col gap-3 rounded-card border border-line/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-content">
                      {request.customer.name}
                    </p>
                    {/* The point of the queue: an operator has to be able to
                        reach them without opening another screen. */}
                    <p className="break-words text-caption text-content-muted">
                      {request.customer.phone ? `${request.customer.phone} · ` : ""}
                      {request.customer.email}
                    </p>
                    <p className="mt-1 text-caption text-content-muted">
                      {[
                        request.policy?.registrationNumber,
                        request.policy?.insurer,
                        request.policy?.expiryDate ? `expires ${request.policy.expiryDate}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Policy no longer on file"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={URGENCY_TONE[request.urgencyAtCreation] ?? "neutral"}>
                      {request.urgencyAtCreation}
                    </Badge>
                    <Badge tone="neutral">
                      {CHANNEL_LABEL[request.preferredChannel] ?? request.preferredChannel}
                    </Badge>
                    <Badge tone={STAGE_TONE[request.status]}>{request.statusLabel}</Badge>
                    {/* Marked rather than hidden. A withdrawn permission is a
                        reason not to ring somebody, not a reason to lose the
                        record that they asked. */}
                    {!request.consentActive ? (
                      <Badge tone="danger">Consent withdrawn — do not contact</Badge>
                    ) : null}
                  </div>
                </div>

                {editable && NEXT[request.status].length > 0 ? (
                  closing === request.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-caption text-content-muted">Closing because</span>
                      {CLOSED_REASONS.map((reason) => (
                        <button
                          key={reason.value}
                          type="button"
                          disabled={busy === request.id}
                          onClick={() => void move(request.id, "CLOSED", reason.value)}
                          className="rounded-pill border border-line/60 px-3 py-1 text-caption font-semibold text-content transition-colors hover:border-brand/50 disabled:opacity-50"
                        >
                          {reason.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setClosing(null)}
                        className="rounded-pill px-3 py-1 text-caption font-semibold text-content-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-caption text-content-muted">Move to</span>
                      {NEXT[request.status].map((next) => (
                        <button
                          key={next}
                          type="button"
                          data-testid={`move-${request.id}-${next}`}
                          disabled={busy === request.id}
                          onClick={() =>
                            next === "CLOSED" ? setClosing(request.id) : void move(request.id, next)
                          }
                          className="rounded-pill border border-line/60 px-3 py-1 text-caption font-semibold text-content transition-colors hover:border-brand/50 disabled:opacity-50"
                        >
                          {STAGES.find((s) => s.value === next)?.label ?? next}
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  <p className="text-caption text-content-muted">
                    {request.status === "CLOSED"
                      ? `Closed${request.closedReason ? ` — ${request.closedReason.toLowerCase().replace(/_/g, " ")}` : ""}`
                      : `Raised ${request.createdAt.slice(0, 10)}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {pagination && pagination.pages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            className="rounded-pill border border-line/60 px-4 py-1.5 text-body-sm font-semibold text-content disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-caption text-content-muted">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            type="button"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-pill border border-line/60 px-4 py-1.5 text-body-sm font-semibold text-content disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
