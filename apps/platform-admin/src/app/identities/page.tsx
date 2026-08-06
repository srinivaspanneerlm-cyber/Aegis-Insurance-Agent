"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { platformApi, type IdentitiesPayload } from "@/lib/api";

const REALMS = ["", "CUSTOMER", "EMPLOYEE", "ENTERPRISE", "PLATFORM"];

/**
 * Every account on the platform.
 *
 * The one place a person from any realm can be looked at — which is exactly why
 * it returns no credential material. An operator needs to know an account
 * exists and works, not how to become it.
 */
export default function IdentitiesPage() {
  const [realm, setRealm] = useState("");
  const [term, setTerm] = useState("");
  const [data, setData] = useState<IdentitiesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: string, search: string) => {
    setData(null);
    setError(null);
    try {
      setData(await platformApi.identities(r, search));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }, []);

  useEffect(() => {
    void load("", "");
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Identity Management</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Accounts across every realm. No credential material is shown or returned.
        </p>
      </header>

      {data ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.byRealm).map(([r, count]) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRealm(r);
                void load(r, term);
              }}
              className={`focus-ring rounded-pill border px-3 py-1 text-caption transition-colors ${realm === r ? "border-brand text-brand" : "border-line/60 text-content-secondary hover:text-content"}`}
            >
              {r} · {count}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load(realm, term);
        }}
        className="flex flex-wrap gap-3"
      >
        <label htmlFor="id-realm" className="sr-only">
          Realm
        </label>
        <select
          id="id-realm"
          value={realm}
          onChange={(e) => {
            setRealm(e.target.value);
            void load(e.target.value, term);
          }}
          className="h-11 rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          {REALMS.map((r) => (
            <option key={r} value={r}>
              {r || "Every realm"}
            </option>
          ))}
        </select>
        <label htmlFor="id-search" className="sr-only">
          Search accounts
        </label>
        <input
          id="id-search"
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Name or email"
          className="h-11 flex-1 rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
        <button
          type="submit"
          className="focus-ring h-11 rounded-control border border-line px-5 text-body-sm font-medium text-content transition-colors hover:border-line-strong"
        >
          Search
        </button>
      </form>

      {error ? <Empty icon="close">{error}</Empty> : null}

      <Panel title={data ? `${data.users.length} of ${data.total}` : "Loading"}>
        {data === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data.users.length === 0 ? (
          <Empty icon="users">Nothing matched.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.users.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line/30 pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-body-sm text-content">{u.name}</p>
                  <p className="text-caption text-content-muted">
                    {u.email}
                    {u.organization ? ` · ${u.organization.name}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="info">{u.realm}</Badge>
                  <Badge>{u.role}</Badge>
                  {!u.isActive ? <Badge tone="danger">Inactive</Badge> : null}
                  {!u.emailVerifiedAt ? <Badge tone="warning">Unverified</Badge> : null}
                  {u.lockedUntil && new Date(u.lockedUntil) > new Date() ? (
                    <Badge tone="warning">Locked</Badge>
                  ) : null}
                  {u.mfaEnrolledAt ? <Badge tone="success">MFA</Badge> : null}
                  <span className="text-caption tabular-nums text-content-muted">
                    {u._count.authSessions} session(s)
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
