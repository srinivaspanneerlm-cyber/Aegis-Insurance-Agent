"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MemoryCard,
  MemoryTimeline,
  useMemory,
  useMemoryHistory,
  type MemoryFact,
} from "@aegis/knowledge";
import { Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { knowledgeClient } from "@/lib/knowledgeClient";
import { API_URL } from "@/lib/workspace";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
}

/**
 * The memory centre.
 *
 * What the platform believes about a customer, and where each belief came
 * from. The provenance is the point — an advisor about to repeat something back
 * to a customer needs to know whether they said it or whether Aegis guessed.
 *
 * Selecting a fact shows how it changed over time, including values that have
 * been superseded. A decision made last March is explained by what was true
 * then, not by what is true now.
 */
export default function MemoryCenterPage() {
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const facts = useMemory(knowledgeClient, "CUSTOMER", selected?.id ?? null);
  const history = useMemoryHistory(knowledgeClient, "CUSTOMER", selected?.id ?? null, selectedKey);

  const load = useCallback(async (term: string) => {
    setError(null);
    try {
      const url = new URL(`${API_URL}/intelligence/customers`);
      if (term) url.searchParams.set("search", term);
      const res = await fetch(url.toString(), { credentials: "include" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Could not load customers.");
      setCustomers(body.data.customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load customers.");
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  const grouped = (facts.data ?? []).reduce<Record<string, MemoryFact[]>>((acc, fact) => {
    const family = fact.key.split(".")[0] ?? "other";
    acc[family] = [...(acc[family] ?? []), fact];
    return acc;
  }, {});

  const inferred = (facts.data ?? []).filter((f) => f.source === "AI_INFERRED").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Memory</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          What we believe about a customer, and where each belief came from.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Panel title="Customers">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(search);
            }}
            className="mb-4 flex gap-2"
          >
            <label htmlFor="memory-search" className="sr-only">
              Search customers
            </label>
            <input
              id="memory-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
              className="h-9 flex-1 rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            <button
              type="submit"
              className="focus-ring rounded-control border border-line/60 px-3 text-caption font-medium text-content"
            >
              Search
            </button>
          </form>

          {customers === null ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <Empty icon="users">No customers match that.</Empty>
          ) : (
            <ul className="flex flex-col gap-1">
              {customers.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(customer);
                      setSelectedKey(null);
                    }}
                    aria-current={selected?.id === customer.id ? "true" : undefined}
                    className={`focus-ring w-full rounded-control px-3 py-2 text-left transition-colors ${
                      selected?.id === customer.id
                        ? "bg-brand/10 text-content"
                        : "text-content-secondary hover:bg-surface-raised/50"
                    }`}
                  >
                    <span className="block text-body-sm font-medium text-content">
                      {customer.name}
                    </span>
                    <span className="block text-caption text-content-muted">{customer.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          {!selected ? (
            <Panel title="Pick a customer">
              <Empty icon="spark">
                Choose somebody on the left to see what the platform knows about them.
              </Empty>
            </Panel>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Things we know" value={facts.data?.length ?? 0} icon="book" />
                <Stat
                  label="Inferred, not confirmed"
                  value={inferred}
                  icon="spark"
                  tone={inferred > 0 ? "warning" : "neutral"}
                />
                <Stat label="Groups" value={Object.keys(grouped).length} icon="layers" />
              </div>

              <Panel title={`What we know about ${selected.name}`}>
                {facts.loading ? (
                  <Skeleton className="h-40 w-full" />
                ) : facts.error ? (
                  <p role="alert" className="text-body-sm text-danger">
                    {facts.error}
                  </p>
                ) : (facts.data ?? []).length === 0 ? (
                  <Empty icon="book">
                    Nothing recorded yet. Facts appear here as advisors and the platform learn them.
                  </Empty>
                ) : (
                  <div className="flex flex-col gap-5">
                    {Object.entries(grouped).map(([family, items]) => (
                      <section key={family}>
                        <h3 className="mb-2 text-caption font-semibold uppercase tracking-wide text-content-muted">
                          {family}
                        </h3>
                        <ul className="flex flex-col gap-2">
                          {items.map((fact) => (
                            <li key={fact.id}>
                              <MemoryCard fact={fact} onHistory={setSelectedKey} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </Panel>

              {selectedKey ? (
                <Panel title="How this changed">
                  {history.loading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <MemoryTimeline entries={history.data ?? []} forKey={selectedKey} />
                  )}
                </Panel>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
