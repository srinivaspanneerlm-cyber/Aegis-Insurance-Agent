"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { consoleApi, type RolesPayload } from "@/lib/api";

/**
 * Roles and permissions.
 *
 * Read-only, deliberately. This reports the shape of access — which roles your
 * people hold and what each one may do — and has no route that could change it.
 * Granting a role is account administration with its own audit trail; a console
 * that could do it quietly from a summary screen would be the wrong place for
 * that decision.
 *
 * Permissions are shown by their real names because those are what somebody
 * requests by name when they need access.
 */
export default function RolesPage() {
  const [data, setData] = useState<RolesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .roles()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load roles.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Empty icon="close">{error}</Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Roles &amp; Permissions</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Who holds what across your staff.
        </p>
      </header>

      {!data ? (
        <Skeleton className="h-48 w-full" />
      ) : data.roles.length === 0 ? (
        <Empty icon="users">
          No staff accounts belong to this organisation yet, so no roles are in use.
        </Empty>
      ) : (
        <>
          {data.roles.map((r) => (
            <Panel
              key={r.role}
              title={r.role}
              action={
                <span className="text-caption text-content-muted">
                  {r.holders} {r.holders === 1 ? "person" : "people"}
                </span>
              }
            >
              {r.permissions.length === 0 ? (
                <p className="text-body-sm text-content-secondary">
                  This role carries no permissions, so its holders can reach nothing beyond signing
                  in.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {[...r.permissions].sort().map((p) => (
                    <Badge key={p}>{p}</Badge>
                  ))}
                </div>
              )}
            </Panel>
          ))}

          <p className="text-pretty text-caption text-content-muted">
            {data.assignable.reason} The platform defines {data.allPermissions.length} permissions
            in total; a role holds a subset of them.
          </p>
        </>
      )}
    </div>
  );
}
