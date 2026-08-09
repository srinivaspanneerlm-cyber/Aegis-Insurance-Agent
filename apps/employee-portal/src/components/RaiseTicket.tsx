"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Panel } from "@/components/Cards";
import { usePermissions } from "@/context/WorkspaceProvider";
import { workspaceApi, type CustomerRow } from "@/lib/api";

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

/**
 * Raise a piece of work.
 *
 * `POST /employee/work` has existed since the work system was built and nothing
 * in this portal called it, so an advisor taking a complaint on the phone had
 * no way to record it — the queue could only be read, never added to.
 *
 * What the form deliberately does not offer: an assignee, a due time or an SLA.
 * The server decides all three, and it says why — a caller that could set its
 * own due time could opt out of the measurement. Drawing those fields and
 * discarding them would be worse than leaving them out, so the form says who
 * decides instead.
 */
export function RaiseTicket({
  kinds,
  onCreated,
}: {
  /** The kinds this screen is about, so /support cannot raise a claim. */
  kinds: readonly { value: string; label: string }[];
  onCreated: () => void;
}) {
  const { can } = usePermissions();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(kinds[0]?.value ?? "");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState<string>("NORMAL");

  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<CustomerRow[]>([]);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  // A slow earlier search must not overwrite a later one.
  const ticket = useRef(0);

  useEffect(() => {
    if (!open || search.trim().length < 2) {
      setMatches([]);
      return;
    }
    const mine = ++ticket.current;
    const timer = setTimeout(() => {
      workspaceApi
        .customers(search.trim())
        .then(({ customers }) => {
          if (mine === ticket.current) setMatches(customers.slice(0, 5));
        })
        .catch(() => {
          // Attaching a customer is optional, so a failed lookup must not stop
          // somebody recording the complaint they are on the phone about.
          if (mine === ticket.current) setMatches([]);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [open, search]);

  const submit = useCallback(async () => {
    if (!title.trim() || !kind) return;
    setBusy(true);
    setError(null);
    try {
      const { item } = await workspaceApi.createWork({
        kind,
        title: title.trim(),
        ...(summary.trim() ? { summary: summary.trim() } : {}),
        priority,
        customerId: customer?.id ?? null,
      });
      setCreated(item.reference);
      setTitle("");
      setSummary("");
      setPriority("NORMAL");
      setCustomer(null);
      setSearch("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  }, [customer, kind, onCreated, priority, summary, title]);

  // Rendered on capability, not on role name. Without `work.write` the endpoint
  // refuses anyway; a form that always fails is worse than no form.
  if (!can("work.write")) return null;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="focus-ring rounded-control border border-brand/40 bg-brand/10 px-3 py-1.5 text-body-sm font-medium text-content"
        >
          Raise a ticket
        </button>
        {created ? (
          <p role="status" className="text-body-sm text-content-secondary">
            Raised as <span className="font-medium tabular-nums text-content">{created}</span>. It
            has been routed and appears below once it lands in your queue.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Panel title="Raise a ticket">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-content-secondary">Kind</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="focus-ring rounded-control border border-line/50 bg-surface px-3 py-2 text-body-sm text-content"
            >
              {kinds.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-content-secondary">Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="focus-ring rounded-control border border-line/50 bg-surface px-3 py-2 text-body-sm text-content"
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0) + value.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-medium text-content-secondary">
            What happened, in one line
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder="Premium debited twice in August"
            className="focus-ring rounded-control border border-line/50 bg-surface px-3 py-2 text-body-sm text-content"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-medium text-content-secondary">Detail (optional)</span>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            maxLength={2000}
            className="focus-ring rounded-control border border-line/50 bg-surface px-3 py-2 text-body-sm text-content"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption font-medium text-content-secondary">
            Customer (optional)
          </span>
          {customer ? (
            <div className="flex flex-wrap items-center gap-3 rounded-control border border-line/50 px-3 py-2">
              <span className="text-body-sm text-content">{customer.name}</span>
              <span className="text-caption text-content-muted">{customer.email}</span>
              <button
                type="button"
                onClick={() => setCustomer(null)}
                className="focus-ring ml-auto rounded text-caption text-content-secondary"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or email"
                className="focus-ring rounded-control border border-line/50 bg-surface px-3 py-2 text-body-sm text-content"
              />
              {matches.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {matches.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setCustomer(row)}
                        className="focus-ring w-full rounded-control px-3 py-2 text-left text-body-sm text-content-secondary hover:bg-surface-raised/40"
                      >
                        {row.name}{" "}
                        <span className="text-caption text-content-muted">{row.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>

        {/* Said rather than drawn. These three fields are the server's to set,
            and showing them as inputs would imply an authority the caller does
            not have. */}
        <p className="text-pretty text-caption text-content-muted">
          Who it goes to and when it is due are decided on routing — by workload and department,
          against the promise for this kind of work. You cannot set either here.
        </p>

        {error ? (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !title.trim()}
            className="focus-ring rounded-control border border-brand/40 bg-brand/10 px-3 py-1.5 text-body-sm font-medium text-content disabled:opacity-50"
          >
            {busy ? "Raising…" : "Raise it"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={busy}
            className="focus-ring rounded-control border border-line/50 px-3 py-1.5 text-body-sm text-content-secondary disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </Panel>
  );
}
