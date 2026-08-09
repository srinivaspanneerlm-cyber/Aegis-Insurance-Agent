"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { consoleApi, type OrganizationPayload } from "@/lib/api";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  SUSPENDED: "danger",
  ARCHIVED: "neutral",
};

const PLAN_LABELS: Record<string, string> = {
  TRIAL: "Trial",
  STARTER: "Starter",
  GROWTH: "Growth",
  ENTERPRISE: "Enterprise",
};

/**
 * The organisation, as its own administrator sees it.
 *
 * Read-only throughout, and that is the design rather than a shortfall: plan,
 * seats, status and archival belong to whoever operates the platform, not to
 * the tenant subject to them. A console where an organisation could grant
 * itself seats or lift its own suspension would make the licence decorative.
 * The page says who owns those fields instead of drawing inputs that refuse.
 */
export default function OrganisationPage() {
  const [data, setData] = useState<OrganizationPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .organization()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not load your organisation.");
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

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
        <p role="status" className="sr-only">
          Loading your organisation.
        </p>
      </div>
    );
  }

  const { organization: org, seats, customers } = data;
  const licensed = org.license;
  const seatsKnown = !("available" in seats);
  const expiring =
    licensed?.expiresAt && new Date(licensed.expiresAt).getTime() - Date.now() < 30 * 86_400_000;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">{org.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-body-sm text-content-secondary">
          <span className="tabular-nums">{org.slug}</span>
          <Badge tone={STATUS_TONE[org.status] ?? "neutral"}>{org.status}</Badge>
        </p>
      </header>

      {/* Suspension changes what everyone in the tenant can do, so it is stated
          before anything else rather than left as a badge in the header. */}
      {org.status !== "ACTIVE" ? (
        <div className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger/10 px-4 py-3">
          <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="text-body-sm font-medium text-content">
              This organisation is {org.status.toLowerCase()}.
            </p>
            <p className="mt-0.5 text-caption text-content-secondary">
              {org.archivedAt
                ? `Archived on ${new Date(org.archivedAt).toLocaleDateString()}.`
                : "Your people may find they cannot sign in."}{" "}
              Only the platform operator can change this.
            </p>
          </div>
        </div>
      ) : null}

      <Panel title="Licence">
        {!licensed ? (
          <Empty icon="close">
            No licence has been issued to this organisation. Seats and plan are unset until the
            platform operator issues one.
          </Empty>
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-caption text-content-muted">Plan</dt>
                <dd className="text-body-sm text-content">
                  {PLAN_LABELS[licensed.plan] ?? licensed.plan}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-content-muted">Staff seats</dt>
                <dd className="text-body-sm tabular-nums text-content">
                  {seatsKnown ? `${seats.used} of ${seats.total} in use` : `${seats.used} in use`}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-content-muted">Started</dt>
                <dd className="text-body-sm text-content">
                  {new Date(licensed.startsAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-content-muted">Expires</dt>
                <dd
                  className={
                    expiring ? "text-body-sm font-medium text-warning" : "text-body-sm text-content"
                  }
                >
                  {licensed.expiresAt
                    ? new Date(licensed.expiresAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "No end date"}
                </dd>
              </div>
            </dl>

            {/* Seats count staff only. Saying which is the difference between a
                figure somebody can plan against and one they will misread. */}
            {seatsKnown ? (
              <>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className={
                      seats.used >= seats.total ? "h-full bg-danger" : "h-full bg-brand/70"
                    }
                    style={{
                      width: `${Math.min(100, seats.total ? (seats.used / seats.total) * 100 : 0)}%`,
                    }}
                    role="img"
                    aria-label={`${seats.used} of ${seats.total} staff seats in use`}
                  />
                </div>
                {seats.used >= seats.total ? (
                  <p className="mt-2 text-caption text-danger">
                    Every seat is taken. New staff accounts need more seats from the platform
                    operator.
                  </p>
                ) : null}
              </>
            ) : null}

            <p className="mt-4 text-pretty text-caption text-content-muted">
              Seats count staff accounts — employees and administrators. Your {customers} customer
              record{customers === 1 ? "" : "s"} do not consume a seat.
            </p>
          </>
        )}
      </Panel>

      <Panel title="Details">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-caption text-content-muted">Sign-in domains</dt>
            <dd className="break-words text-body-sm text-content">
              {org.emailDomains ? (
                org.emailDomains.split(",").join(", ")
              ) : (
                <span className="text-content-muted">None set</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-content-muted">Created</dt>
            <dd className="text-body-sm text-content">
              {new Date(org.createdAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-content-muted">Contact email</dt>
            <dd className="break-words text-body-sm text-content">
              {org.contactEmail ?? <span className="text-content-muted">None set</span>}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-content-muted">Contact phone</dt>
            <dd className="text-body-sm text-content">
              {org.contactPhone ?? <span className="text-content-muted">None set</span>}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-pretty text-caption text-content-muted">{data.editable.reason}</p>
      </Panel>
    </div>
  );
}
