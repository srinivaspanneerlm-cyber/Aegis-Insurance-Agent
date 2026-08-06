"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { platformApi, type RolesPayload } from "@/lib/api";

/**
 * The role model, served from the code the middleware enforces.
 *
 * Read-only, and the page says why: roles are code, so a typo is a compile
 * error rather than a silently missing capability, and changing what a role
 * means is a reviewed change rather than a click.
 */
export default function RolesPage() {
  const [data, setData] = useState<RolesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    platformApi
      .roles()
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

  if (error) return <Empty icon="close">{error}</Empty>;
  if (!data)
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Role Management</h1>
        <p className="mt-1 max-w-2xl text-pretty text-body-sm text-content-secondary">
          {data.note}
        </p>
      </header>

      <Panel title={`${data.realms.length} realms`}>
        <ul className="flex flex-wrap gap-2">
          {data.realms.map((r) => (
            <li key={r}>
              <Badge tone="info">{r}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-pretty text-caption text-content-muted">
          A realm decides which portal somebody enters. A role decides what they may do once inside.
          Neither is ever branched on directly — code asks for a permission.
        </p>
      </Panel>

      {data.roles.map((role) => (
        <Panel
          key={role.role}
          title={role.role}
          action={
            <span className="text-caption text-content-muted">{role.count} capability(ies)</span>
          }
        >
          {role.permissions.length === 0 ? (
            <p className="text-pretty text-body-sm text-content-secondary">
              Deliberately empty. A customer&rsquo;s authority over their own records comes from
              every query being scoped by their id, not from a capability — and granting one here
              would make that scoping look optional.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {role.permissions.map((p) => (
                <li key={p}>
                  <Badge>{p}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ))}

      <Panel title={`${data.permissions.length} permissions in total`}>
        <ul className="flex flex-wrap gap-1.5">
          {data.permissions.map((p) => (
            <li key={p}>
              <Badge>{p}</Badge>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
