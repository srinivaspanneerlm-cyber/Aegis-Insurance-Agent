"use client";

import Link from "next/link";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, Panel, ShowMore, Skeleton } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { consoleApi, MAX_ROWS, type CustomerRow } from "@/lib/api";

/**
 * Customer management.
 *
 * Deliberately shows no conversation content. An administrator has a legitimate
 * need to see that a customer exists, what is open for them and whether their
 * account is healthy — and no need at all to read what they told an advisor in
 * confidence. The API never selects those columns, so this cannot show them
 * even by accident.
 */
export default function CustomersPage() {
  const [term, setTerm] = useState("");
  const [data, setData] = useState<{ total: number; customers: CustomerRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [expanding, setExpanding] = useState(false);
  // What the table is actually showing, which is not what is in the box: a
  // half-typed term must not become the query when somebody asks for more rows.
  const [applied, setApplied] = useState("");

  const run = useCallback(async (search: string, take?: number) => {
    // Only a fresh search blanks the table. Asking for more rows keeps what is
    // already on screen, so the list grows rather than flickering back to
    // skeletons and losing the reader's place.
    if (take === undefined) {
      setData(null);
      setApplied(search);
    }
    setError(null);
    try {
      setData(await consoleApi.customers(search, take));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    }
  }, []);

  useEffect(() => {
    void run("");
  }, [run]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Customer Management</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Accounts, their open work and their documents. Conversations are not shown here.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(term);
        }}
        className="flex gap-3"
      >
        <div className="relative flex-1">
          <label htmlFor="cust-search" className="sr-only">
            Search customers
          </label>
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
          />
          <input
            id="cust-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Name or email address"
            className="h-11 w-full rounded-control border border-line/60 bg-surface-raised/40 pl-9 pr-3 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <button
          type="submit"
          className="focus-ring h-11 rounded-control bg-brand px-5 text-body-sm font-semibold text-brand-fg transition-colors hover:bg-brand-hover"
        >
          Search
        </button>
      </form>

      {error ? <Empty icon="close">{error}</Empty> : null}

      <Panel title={data ? `${data.customers.length} of ${data.total}` : "Loading"}>
        {data === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data.customers.length === 0 ? (
          <Empty icon="users">No customers matched.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Status
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Open work
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Documents
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Last seen
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.id} className="border-b border-line/30 last:border-0">
                    <td className="py-3 pr-4">
                      {/* The detail endpoint has been live since this console was
                          built and these rows linked nowhere. */}
                      <Link
                        href={`/customers/${c.id}`}
                        className="focus-ring rounded text-body-sm font-medium text-brand"
                      >
                        {c.name}
                      </Link>
                      <p className="break-words text-caption text-content-muted">{c.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={c.isActive ? "success" : "danger"}>
                          {c.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {!c.emailVerifiedAt ? <Badge tone="warning">Unverified</Badge> : null}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-body-sm tabular-nums text-content-secondary">
                      {c._count.customerWork}
                    </td>
                    <td className="py-3 pr-4 text-body-sm tabular-nums text-content-secondary">
                      {c._count.uploadedDocuments}
                    </td>
                    <td className="py-3 text-caption text-content-muted">
                      {c.lastLoginAt
                        ? new Date(c.lastLoginAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                          })
                        : "never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data ? (
          <ShowMore
            shown={data.customers.length}
            total={data.total}
            max={MAX_ROWS}
            busy={expanding}
            noun="customers"
            onMore={() => {
              setExpanding(true);
              void run(applied, MAX_ROWS).finally(() => setExpanding(false));
            }}
          />
        ) : null}
      </Panel>
    </div>
  );
}
