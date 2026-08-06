"use client";

import { useEffect, useState } from "react";
import { Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { platformApi, type BackupPayload } from "@/lib/api";

/**
 * Backup and recovery.
 *
 * The page says plainly that this console cannot take or restore a backup, and
 * why. A backup button that shells out to the database from a web request is
 * how a console becomes the most dangerous thing in an estate.
 */
export default function BackupPage() {
  const [data, setData] = useState<BackupPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    platformApi
      .backup()
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
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Backup &amp; Recovery</h1>
        <p className="mt-1 text-body-sm text-content-secondary">Schema state and data volumes.</p>
      </header>

      <div className="rounded-card border border-warning/40 bg-warning/10 px-4 py-3">
        <p className="text-body-sm font-medium text-content">
          This console cannot take or restore a backup.
        </p>
        <p className="mt-1 text-pretty text-body-sm text-content-secondary">
          {data.capability.reason}
        </p>
        <p className="mt-2 text-pretty text-body-sm text-content-secondary">
          <span className="font-medium">What should exist instead:</span> {data.capability.needs}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Accounts" value={data.volumes.users} icon="users" />
        <Stat label="Organizations" value={data.volumes.organizations} icon="building" />
        <Stat label="Work items" value={data.volumes.workItems} icon="layers" />
        <Stat label="Audit entries" value={data.volumes.auditEntries} icon="search" />
      </div>

      <Panel title="Schema">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-caption uppercase text-content-muted">Migrations applied</dt>
            <dd className="mt-1 text-body font-semibold tabular-nums text-content">
              {data.schema.migrationsApplied}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-caption uppercase text-content-muted">Latest</dt>
            <dd className="mt-1 text-body-sm text-content">{data.schema.latest ?? "—"}</dd>
          </div>
        </dl>
        {data.schema.appliedAt ? (
          <p className="mt-3 text-caption text-content-muted">
            Applied {new Date(data.schema.appliedAt).toLocaleString()}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
