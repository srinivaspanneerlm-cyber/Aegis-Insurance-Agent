"use client";

import Link from "next/link";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { useWorkspace } from "@/context/WorkspaceProvider";

const VERDICT_LABELS: Record<string, string> = {
  HEALTHY: "Capacity available",
  BUSY: "Busy",
  AT_CAPACITY: "At capacity",
  OVERLOADED: "Overloaded",
};

const VERDICT_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  HEALTHY: "success",
  BUSY: "warning",
  AT_CAPACITY: "warning",
  OVERLOADED: "danger",
};

/**
 * What each capability actually lets somebody do.
 *
 * The permission strings are the platform's vocabulary, not a person's. A
 * screen that lists `work.read.all` and stops has explained nothing.
 */
const PERMISSION_LABELS: Record<string, string> = {
  "work.read": "See work assigned to you",
  "work.read.all": "See the whole team's work, and its escalations",
  "work.write": "Raise new work",
  "workflow.advance": "Move a case through its process, including decisions",
  "customer.read": "Open customer records and their analysis",
  "customer.write": "Change customer records",
  "policy.read": "Read the policy catalogue",
  "policy.write": "Change the policy catalogue",
  "policy.approve": "Approve policy changes",
  "lead.read": "See the lead pipeline",
  "lead.write": "Move leads along the pipeline",
  "lead.delete": "Remove leads",
  "knowledge.read": "Search the knowledge base",
  "knowledge.write": "Write and publish knowledge articles",
  "analytics.read": "See reporting",
  "audit.read": "Read the audit log",
  "claim.read": "Read claims",
  "claim.assess": "Assess a claim",
  "claim.settle": "Settle a claim",
  "workflow.approve": "Approve the steps a workflow marks as needing approval",
  "work.assign": "Assign work to somebody else",
  "staff.manage": "Manage staff records",
  "company.write": "Change company details",
  "organization.manage": "Manage the organisation, including its stored memory",
  "platform.configure": "Configure the platform, including its health reporting",
};

/**
 * Your staff record, your capacity, and what you are allowed to do.
 *
 * Every figure comes from the session the shell already loaded — there is no
 * fetch on this page. The dashboard shows the same identity as a header; this
 * is the record itself, and it carries the three things nothing else displays:
 * the workload numbers behind the verdict, the date you joined, and your
 * capabilities.
 *
 * The capability list is the point. An employee who finds a screen missing from
 * their nav has, until now, had no way to learn why. Permissions decide that,
 * they are already in the session, and no page showed them.
 */
export default function ProfilePage() {
  const { session, profile, workload } = useWorkspace();

  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const permissions = [...session.permissions].sort();
  const openCount =
    workload && profile ? Math.round(workload.utilisation * profile.workloadLimit) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">{session.user.name}</h1>
        <p className="mt-1 break-words text-body-sm text-content-secondary">{session.user.email}</p>
      </header>

      <Panel title="Your staff record">
        {!profile ? (
          <Empty icon="close">
            No staff record is attached to this account, so your queue and capacity cannot be worked
            out. Whoever administers your account needs to create one.
          </Empty>
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-caption text-content-muted">Employee code</dt>
                <dd className="text-body-sm tabular-nums text-content">{profile.employeeCode}</dd>
              </div>
              <div>
                <dt className="text-caption text-content-muted">Role</dt>
                <dd className="text-body-sm text-content">{profile.designation}</dd>
              </div>
              <div>
                <dt className="text-caption text-content-muted">Department</dt>
                <dd className="text-body-sm text-content">{profile.department}</dd>
              </div>
              <div>
                <dt className="text-caption text-content-muted">Branch</dt>
                <dd className="text-body-sm text-content">{profile.branch}</dd>
              </div>
              <div>
                <dt className="text-caption text-content-muted">Joined</dt>
                <dd className="text-body-sm text-content">
                  {new Date(profile.joinedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-content-muted">Status</dt>
                <dd>
                  <Badge tone={profile.status === "ACTIVE" ? "success" : "warning"}>
                    {profile.status}
                  </Badge>
                </dd>
              </div>
            </dl>

            <p className="mt-5 text-pretty text-caption text-content-muted">
              These come from your staff record. Changing any of them — including which department
              routes work to you — is done by whoever administers your account.
            </p>
          </>
        )}
      </Panel>

      {profile && workload ? (
        <Panel title="Your capacity">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* The numbers behind the verdict. The dashboard shows the verdict
                and the advice; neither says how full you actually are, and
                "busy" without a figure is not something you can plan against. */}
            <Stat
              label="Open work"
              value={openCount === null ? "—" : `${openCount} of ${profile.workloadLimit}`}
              icon="layers"
            />
            <Stat
              label="Capacity used"
              value={`${Math.round(workload.utilisation * 100)}%`}
              tone={VERDICT_TONE[workload.verdict] ?? "neutral"}
              icon="chart"
            />
            <Stat
              label="Verdict"
              value={VERDICT_LABELS[workload.verdict] ?? workload.verdict}
              tone={VERDICT_TONE[workload.verdict] ?? "neutral"}
              icon={workload.verdict === "HEALTHY" ? "check" : "bolt"}
            />
          </div>

          <p className="mt-4 text-pretty text-body-sm text-content-secondary">{workload.advice}</p>

          {/* Routing reads this figure, so it is worth saying that it does. */}
          <p className="mt-3 text-pretty text-caption text-content-muted">
            Your limit is {profile.workloadLimit} open items. Routing stops sending you new work
            once you reach it — it does not push one more onto whoever is least buried.{" "}
            <Link
              href="/tasks"
              className="focus-ring rounded text-brand underline underline-offset-4"
            >
              See what is open
            </Link>
            .
          </p>
        </Panel>
      ) : null}

      <Panel title="What you may do">
        {permissions.length === 0 ? (
          <Empty>
            No capabilities are attached to this account, which is why most of the portal is not in
            your navigation.
          </Empty>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {permissions.map((permission) => (
                <li key={permission} className="flex items-start gap-3">
                  <Icon
                    name="check"
                    size={14}
                    aria-hidden="true"
                    className="mt-1 shrink-0 text-success"
                  />
                  <div className="min-w-0">
                    <p className="text-body-sm text-content">
                      {PERMISSION_LABELS[permission] ?? permission}
                    </p>
                    {/* The raw string too: it is what an administrator will ask
                        for by name when somebody requests access. */}
                    <p className="text-caption tabular-nums text-content-muted">{permission}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-pretty text-caption text-content-muted">
              These come from your role, not from you. A screen missing from your navigation is
              missing because one of these is — ask whoever administers your account for the named
              capability rather than for the screen.
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
