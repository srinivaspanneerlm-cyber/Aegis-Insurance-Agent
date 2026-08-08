"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { workspaceApi, type CataloguePolicy, type Pagination } from "@/lib/api";

const PAGE_SIZE = 20;

/**
 * The product catalogue.
 *
 * Read-only for now, and the reason is worth stating rather than assumed:
 * EMPLOYEE *does* hold `policy.write`, so an edit control would work. It is
 * absent because amending a live product changes what every customer is quoted,
 * and that needs an approval path — which `policy.approve` exists for and this
 * screen does not implement. Shipping an edit button without it would let one
 * advisor reprice the catalogue unreviewed.
 *
 * Paginated by the server. Fetching everything and slicing here would quietly
 * miss anything past the first page the day the catalogue outgrows one.
 */
export default function PolicyManagementPage() {
  const [policies, setPolicies] = useState<CataloguePolicy[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (which: number) => {
    setPolicies(null);
    setError(null);
    try {
      const { data, pagination: meta } = await workspaceApi.policies(which, PAGE_SIZE);
      setPolicies(data.policies);
      setPagination(meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the catalogue.");
      setPolicies([]);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const active = (policies ?? []).filter((p) => p.isActive).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Policy Management</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          What we sell, and at what price. Changing a product is an underwriting decision — this is
          the catalogue as it stands.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Products" value={pagination?.total ?? "—"} icon="briefcase" />
        <Stat label="On this page" value={policies?.length ?? "—"} icon="layers" />
        <Stat
          label="Active"
          value={policies === null ? "—" : active}
          tone={policies !== null && active < (policies?.length ?? 0) ? "warning" : "neutral"}
          icon="check"
        />
      </div>

      <Panel title={pagination ? `${pagination.total} products` : "Catalogue"}>
        {policies === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : policies.length === 0 ? (
          <Empty icon="briefcase">No products are listed.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <caption className="sr-only">
                The insurance products in the catalogue, with premium and cover
              </caption>
              <thead>
                <tr className="border-b border-line/50">
                  <th
                    scope="col"
                    className="pb-2 pr-4 text-caption font-semibold uppercase text-content-muted"
                  >
                    Product
                  </th>
                  <th
                    scope="col"
                    className="pb-2 pr-4 text-caption font-semibold uppercase text-content-muted"
                  >
                    Insurer
                  </th>
                  <th
                    scope="col"
                    className="pb-2 pr-4 text-caption font-semibold uppercase text-content-muted"
                  >
                    Cover
                  </th>
                  <th
                    scope="col"
                    className="pb-2 pr-4 text-caption font-semibold uppercase text-content-muted"
                  >
                    Premium
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-caption font-semibold uppercase text-content-muted"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr key={policy.id} className="border-b border-line/30 align-top">
                    <th scope="row" className="py-3 pr-4 text-body-sm font-medium text-content">
                      {policy.policyName}
                    </th>
                    <td className="py-3 pr-4 text-body-sm text-content-secondary">
                      {/* Named as missing rather than left blank: a product with
                          no insurer recorded is a data problem worth seeing. */}
                      {policy.company?.name ?? (
                        <span className="text-content-muted">Not recorded</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-body-sm text-content-secondary">
                      {policy.coverage}
                    </td>
                    <td className="py-3 pr-4 text-body-sm tabular-nums text-content">
                      ₹{policy.premium.toLocaleString("en-IN")}
                      <span className="text-content-muted"> / mo</span>
                    </td>
                    <td className="py-3">
                      <Badge tone={policy.isActive ? "success" : "neutral"}>
                        {policy.isActive ? "Sellable" : "Withdrawn"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 ? (
          <nav
            aria-label="Catalogue pages"
            className="mt-4 flex items-center justify-between gap-3"
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="focus-ring rounded-control border border-line/60 px-3 py-1.5 text-caption font-medium text-content disabled:opacity-40"
            >
              Previous
            </button>
            <p role="status" aria-live="polite" className="text-caption text-content-muted">
              Page {pagination.page} of {pagination.pages}
            </p>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="focus-ring rounded-control border border-line/60 px-3 py-1.5 text-caption font-medium text-content disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        ) : null}
      </Panel>
    </div>
  );
}
