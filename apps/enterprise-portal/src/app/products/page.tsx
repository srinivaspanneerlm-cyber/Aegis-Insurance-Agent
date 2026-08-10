"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { consoleApi, type ProductsPayload } from "@/lib/api";

/** The product catalogue: insurers, their policies, and what each costs. */
export default function ProductsPage() {
  const [data, setData] = useState<ProductsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .products()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Products</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Insurers and the cover they offer.
        </p>
      </header>

      <p className="-mt-3 text-body-sm text-content-secondary">
        What customers actually hold is in{" "}
        <a href="/policies" className="focus-ring rounded text-brand underline underline-offset-4">
          Policy Management
        </a>
        .
      </p>

      {error ? <Empty icon="close">{error}</Empty> : null}

      {data ? (
        <>
          <Panel title={`${data.companies.length} insurer(s)`}>
            {data.companies.length === 0 ? (
              <Empty icon="building">No insurers on the catalogue yet.</Empty>
            ) : (
              <>
                <ul className="flex flex-wrap gap-2">
                  {data.companies.map((c) => (
                    <li key={c.id}>
                      <Badge tone={c.isActive ? "success" : "neutral"}>
                        {c.companyName} · {c._count.policies}
                      </Badge>
                    </li>
                  ))}
                </ul>
                {/* Says whose products the number counts. A bare figure beside a
                    shared insurer name reads as that insurer's whole book. */}
                <p className="mt-3 text-caption text-content-muted">
                  Each figure is your own products from that insurer. Insurers are shared across the
                  platform; your catalogue is not.
                </p>
              </>
            )}
          </Panel>

          <Panel title={`${data.policies.length} product(s)`}>
            {data.policies.length === 0 ? (
              <Empty icon="shield">No products on the catalogue yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Product
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Insurer
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Premium
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Coverage
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.policies.map((p) => (
                      <tr key={p.id} className="border-b border-line/30 last:border-0">
                        <td className="py-3 pr-4 text-body-sm text-content">{p.policyName}</td>
                        <td className="py-3 pr-4 text-body-sm text-content-secondary">
                          {p.company.companyName}
                        </td>
                        <td className="py-3 pr-4 text-body-sm tabular-nums text-content-secondary">
                          {p.premium.toLocaleString("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="py-3 pr-4 text-body-sm text-content-secondary">
                          {p.coverage}
                        </td>
                        <td className="py-3">
                          <Badge tone={p.isActive ? "success" : "neutral"}>
                            {p.isActive ? "Active" : "Retired"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="rounded-card border border-dashed border-line/50 bg-surface-raised/20 p-5">
            <p className="text-body-sm font-semibold text-content-secondary">
              Version history — not retained
            </p>
            <p className="mt-1 text-pretty text-caption text-content-muted">
              {data.versionHistory.reason}
            </p>
            <p className="mt-2 text-pretty text-caption text-content-muted">
              <span className="font-medium">Needs:</span> {data.versionHistory.needs}
            </p>
          </div>
        </>
      ) : error ? null : (
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
