/**
 * Platform administration — the operator's authority.
 *
 * This is the only console on the platform that may *write* structural things:
 * tenants, licences, configuration. That is why every mutation here is audited
 * with the actor, and why none of them touch a customer's records or a claim's
 * outcome. Highest authority over the platform is not the same as authority
 * over the people using it, and the separation is deliberate.
 */
import AppError from "../utils/appError";
import prisma from "../config/db";
import { auditService } from "./audit.service";
import { componentHealth, missingTelemetry, resourceUsage } from "../platform/telemetry";
import { aiSystemStatuses } from "../admin/aiSystems";
import { REALMS } from "../auth/realms";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLE_NAMES } from "../auth/permissions";

const ORG_STATUSES = ["ACTIVE", "SUSPENDED", "ARCHIVED"] as const;
const PLANS = ["TRIAL", "STANDARD", "ENTERPRISE"] as const;

const MAX_PAGE = 100;
const clampTake = (value: unknown, fallback = 25): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), MAX_PAGE);
};

/** `Acme Insurance Ltd` → `acme-insurance-ltd`. */
const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export const platformService = {
  // ── Platform health ────────────────────────────────────────────────────────

  /**
   * Everything the console's front page needs.
   *
   * Probes and counts together, because an operator opening this during an
   * incident wants both at once — "is the database up" and "how many people
   * does this affect" are the same question asked twice.
   */
  async overview() {
    const [components, byRealm, organizations, licences, ai, security] = await Promise.all([
      componentHealth(),
      prisma.user.groupBy({ by: ["realm"], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.organization.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.license.groupBy({ by: ["plan"], _count: { _all: true } }),
      aiSystemStatuses(),
      securitySnapshot(),
    ]);

    const realmCounts = Object.fromEntries(byRealm.map((r) => [r.realm, r._count._all]));

    return {
      generatedAt: new Date().toISOString(),
      components,
      resources: resourceUsage(),
      missingTelemetry,
      identity: {
        customers: realmCounts.CUSTOMER ?? 0,
        employees: realmCounts.EMPLOYEE ?? 0,
        admins: realmCounts.ENTERPRISE ?? 0,
        operators: realmCounts.PLATFORM ?? 0,
      },
      organizations: Object.fromEntries(organizations.map((o) => [o.status, o._count._all])),
      licences: Object.fromEntries(licences.map((l) => [l.plan, l._count._all])),
      ai: ai.map(({ id, name, health, activity }) => ({ id, name, health, activity })),
      security,
      // The one figure an operator will look for and the platform cannot give.
      revenue: {
        available: false as const,
        reason: "The platform records licence plans but no billing or payments.",
        needs: "A billing integration, or an invoice record per organisation.",
      },
    };
  },

  // ── Organizations ──────────────────────────────────────────────────────────

  async organizations(query: { search?: string; status?: string; take?: unknown }) {
    const take = clampTake(query.take);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { OR: [{ name: { contains: query.search } }, { slug: { contains: query.search } }] }
        : {}),
    };

    const [total, organizations] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        include: {
          license: true,
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
    ]);

    return { total, organizations };
  },

  /**
   * Create a tenant, and give it a licence in the same operation.
   *
   * An organisation without a licence is a record nothing can decide about —
   * how many seats, until when — so the two are created together rather than
   * leaving a window where the answer is undefined.
   */
  async createOrganization(
    input: { name: string; emailDomains?: string; contactEmail?: string; plan?: string; seats?: number },
    actorId: string
  ) {
    const name = input.name?.trim();
    if (!name || name.length < 2) throw new AppError("An organisation needs a name.", 400);

    const plan = (PLANS as readonly string[]).includes(input.plan ?? "")
      ? (input.plan as string)
      : "TRIAL";

    const slug = slugify(name);
    if (!slug) throw new AppError("That name cannot be turned into an identifier.", 400);

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) throw new AppError("An organisation with that name already exists.", 409);

    const organization = await prisma.organization.create({
      data: {
        slug,
        name,
        emailDomains: input.emailDomains?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
        license: {
          create: {
            plan,
            seats: Number.isFinite(input.seats) && (input.seats as number) > 0 ? Math.floor(input.seats as number) : 5,
            // A trial with no end date is a bug, not a gift.
            expiresAt: plan === "TRIAL" ? new Date(Date.now() + 30 * 24 * 60 * 60_000) : null,
          },
        },
      },
      include: { license: true },
    });

    auditService.record({
      actorId,
      action: "platform.organization.created",
      entity: "Organization",
      entityId: organization.id,
      metadata: { slug, plan },
    });

    return organization;
  },

  /**
   * Change a tenant's status.
   *
   * Suspension revokes every live session belonging to that tenant's staff. A
   * suspension that leaves people signed in until their token expires is not a
   * suspension — it is a note in a database.
   */
  async setOrganizationStatus(id: string, status: string, actorId: string) {
    if (!(ORG_STATUSES as readonly string[]).includes(status)) {
      throw new AppError("Unknown status.", 400);
    }

    const organization = await prisma.organization.findUnique({ where: { id } });
    if (!organization) throw new AppError("That organisation does not exist.", 404);

    const updated = await prisma.organization.update({
      where: { id },
      data: {
        status,
        archivedAt: status === "ARCHIVED" ? new Date() : null,
      },
    });

    let endedSessions = 0;
    if (status !== "ACTIVE") {
      const members = await prisma.user.findMany({
        where: { organizationId: id },
        select: { id: true },
      });
      const ids = members.map((m) => m.id);
      if (ids.length > 0) {
        const [sessions] = await Promise.all([
          prisma.authSession.updateMany({
            where: { userId: { in: ids }, revokedAt: null },
            data: { revokedAt: new Date(), revokedReason: "ADMIN" },
          }),
          prisma.refreshToken.updateMany({
            where: { userId: { in: ids }, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
        ]);
        endedSessions = sessions.count;
      }
    }

    auditService.record({
      actorId,
      action: "platform.organization.status_changed",
      entity: "Organization",
      entityId: id,
      metadata: { from: organization.status, to: status, endedSessions },
    });

    return { organization: updated, endedSessions };
  },

  /** Update a tenant's licence. Seats are checked against actual usage. */
  async updateLicense(
    organizationId: string,
    input: { plan?: string; seats?: number; expiresAt?: string | null },
    actorId: string
  ) {
    const license = await prisma.license.findUnique({ where: { organizationId } });
    if (!license) throw new AppError("That organisation has no licence.", 404);

    const seatsInUse = await prisma.user.count({
      where: { organizationId, realm: { in: ["EMPLOYEE", "ENTERPRISE"] }, deletedAt: null },
    });

    const seats = Number.isFinite(input.seats) ? Math.floor(input.seats as number) : license.seats;
    if (seats < seatsInUse) {
      // Refused rather than silently applied. Cutting seats below the accounts
      // that exist would mean somebody is over their limit the moment it is
      // saved, with no indication of who gets locked out.
      throw new AppError(
        `That organisation already has ${seatsInUse} staff account(s). Remove accounts before reducing the seat count.`,
        409,
        "SEATS_IN_USE"
      );
    }

    const updated = await prisma.license.update({
      where: { organizationId },
      data: {
        ...(input.plan && (PLANS as readonly string[]).includes(input.plan) ? { plan: input.plan } : {}),
        seats,
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
          : {}),
      },
    });

    auditService.record({
      actorId,
      action: "platform.license.updated",
      entity: "License",
      entityId: updated.id,
      metadata: { organizationId, plan: updated.plan, seats: updated.seats },
    });

    return { license: updated, seatsInUse };
  },

  /** Licence usage across every tenant, with expiry flagged. */
  async licences() {
    const organizations = await prisma.organization.findMany({
      where: { status: { not: "ARCHIVED" } },
      include: { license: true, _count: { select: { members: true } } },
      orderBy: { name: "asc" },
      take: MAX_PAGE,
    });

    const now = Date.now();
    const soon = now + 30 * 24 * 60 * 60_000;

    return organizations.map((org) => {
      const expiresAt = org.license?.expiresAt ?? null;
      return {
        organizationId: org.id,
        name: org.name,
        status: org.status,
        plan: org.license?.plan ?? null,
        seats: org.license?.seats ?? 0,
        seatsUsed: org._count.members,
        expiresAt,
        expiryState: !expiresAt
          ? ("PERPETUAL" as const)
          : expiresAt.getTime() < now
            ? ("EXPIRED" as const)
            : expiresAt.getTime() < soon
              ? ("EXPIRING" as const)
              : ("CURRENT" as const),
      };
    });
  },

  // ── Identity across the platform ───────────────────────────────────────────

  /**
   * Every account, filterable by realm.
   *
   * This is the one place a person from any realm can be looked at, which is
   * exactly why it returns no credential state beyond whether the account is
   * usable — no password hash, no token, no MFA secret. An operator needs to
   * know an account exists and works, not how to become it.
   */
  async identities(query: { realm?: string; search?: string; take?: unknown }) {
    const take = clampTake(query.take);
    const where = {
      deletedAt: null,
      ...(query.realm && (REALMS as readonly string[]).includes(query.realm)
        ? { realm: query.realm }
        : {}),
      ...(query.search
        ? { OR: [{ name: { contains: query.search } }, { email: { contains: query.search } }] }
        : {}),
    };

    const [total, users, byRealm] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          realm: true,
          role: true,
          isActive: true,
          emailVerifiedAt: true,
          lockedUntil: true,
          mfaEnrolledAt: true,
          lastLoginAt: true,
          createdAt: true,
          organization: { select: { id: true, name: true } },
          _count: { select: { authSessions: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.user.groupBy({ by: ["realm"], where: { deletedAt: null }, _count: { _all: true } }),
    ]);

    return {
      total,
      users,
      byRealm: Object.fromEntries(byRealm.map((r) => [r.realm, r._count._all])),
    };
  },

  /**
   * The role and permission model, as data.
   *
   * Read from the same module the middleware enforces, so this console cannot
   * describe a permission model the platform is not running. There is no write
   * path: roles are code, and changing what a role means is a reviewed change
   * rather than a click.
   */
  roleModel() {
    return {
      realms: REALMS,
      permissions: PERMISSIONS,
      roles: ROLE_NAMES.map((role) => ({
        role,
        permissions: ROLE_PERMISSIONS[role],
        count: ROLE_PERMISSIONS[role].length,
      })),
      note:
        "Roles and permissions are defined in code, not in this database. A typo in a permission name is a compile error rather than a silently missing capability, and changing what a role means is a reviewed change rather than a click.",
    };
  },

  /** Every live session on the platform, for eviction during an incident. */
  async sessions(query: { take?: unknown }) {
    const take = clampTake(query.take, 50);
    const sessions = await prisma.authSession.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        realm: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        user: { select: { id: true, name: true, email: true, realm: true } },
      },
      orderBy: { lastSeenAt: "desc" },
      take,
    });
    return { sessions };
  },

  /** End one session. The bluntest tool an operator has, and sometimes right. */
  async revokeSession(sessionId: string, actorId: string) {
    const session = await prisma.authSession.findUnique({ where: { id: sessionId } });
    if (!session || session.revokedAt) throw new AppError("That session is not live.", 404);

    await prisma.authSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokedReason: "ADMIN" },
    });
    await prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    auditService.record({
      actorId,
      action: "platform.session.revoked",
      entity: "AuthSession",
      entityId: sessionId,
      metadata: { userId: session.userId },
    });

    return { revoked: true };
  },

  // ── Configuration ──────────────────────────────────────────────────────────

  async settings() {
    const stored = await prisma.platformSetting.findMany({ orderBy: { category: "asc" } });
    return {
      settings: stored,
      // What lives in environment and cannot be changed from here. Listed so an
      // operator does not hunt for a control that should never exist.
      environmentOnly: [
        { key: "JWT_SECRET", reason: "A signing key. Rotating it invalidates every session." },
        { key: "DATABASE_URL", reason: "Read before the process can reach a database." },
        { key: "GOOGLE_CLIENT_ID", reason: "Identity provider credential." },
        { key: "REDIS_URL", reason: "Chosen at boot; changing it needs a restart." },
        { key: "CLIENT_URL", reason: "The CORS and CSRF allowlist. A live edit could lock every portal out." },
      ],
    };
  },

  /**
   * Change a setting.
   *
   * Type-checked against the declared type, so a boolean flag cannot silently
   * become the string "false" — which is truthy, and is how a feature flag ends
   * up meaning the opposite of what it says.
   */
  async updateSetting(key: string, value: string, actorId: string) {
    const setting = await prisma.platformSetting.findUnique({ where: { key } });
    if (!setting) throw new AppError("Unknown setting.", 404);

    if (setting.type === "boolean" && !["true", "false"].includes(value)) {
      throw new AppError('A boolean setting must be exactly "true" or "false".', 400);
    }
    if (setting.type === "number" && !Number.isFinite(Number(value))) {
      throw new AppError("That is not a number.", 400);
    }
    if (setting.type === "json") {
      try {
        JSON.parse(value);
      } catch {
        throw new AppError("That is not valid JSON.", 400);
      }
    }

    const updated = await prisma.platformSetting.update({
      where: { key },
      data: { value, updatedBy: actorId },
    });

    auditService.record({
      actorId,
      action: "platform.setting.updated",
      entity: "PlatformSetting",
      entityId: key,
      // The previous value is recorded because "what did this used to be" is
      // the first question after a configuration change breaks something.
      metadata: { key, from: setting.sensitive ? "[hidden]" : setting.value, to: setting.sensitive ? "[hidden]" : value },
    });

    return updated;
  },

  // ── Security ───────────────────────────────────────────────────────────────

  async security(query: { take?: unknown }) {
    const take = clampTake(query.take, 50);
    const snapshot = await securitySnapshot();

    const [recentFailures, permissionDenials, lockedAccounts] = await Promise.all([
      prisma.loginEvent.findMany({
        where: { outcome: { not: "SUCCESS" } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.auditLog.findMany({
        where: { action: { contains: "denied" } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.user.findMany({
        where: { lockedUntil: { gt: new Date() } },
        select: { id: true, email: true, realm: true, failedLoginAttempts: true, lockedUntil: true },
        take: 25,
      }),
    ]);

    return { ...snapshot, recentFailures, permissionDenials, lockedAccounts };
  },

  // ── AI governance ──────────────────────────────────────────────────────────

  /**
   * Every AI system, with what governance needs and what is missing.
   *
   * The health figures come from the same source the enterprise console reads —
   * one truth about the estate — and the governance-specific fields (version,
   * deployment, token usage, knowledge source) are declared rather than
   * invented, because none of them is reported back to this API today.
   */
  async aiGovernance() {
    const systems = await aiSystemStatuses();
    return {
      systems: systems.map((system) => ({
        ...system,
        governance: {
          version: null,
          deploymentStatus: null,
          tokenUsage: null,
          knowledgeSource: null,
        },
      })),
      notInstrumented: [
        {
          field: "version",
          reason: "The AI engine does not report a build or model version to this API.",
          needs: "A version string returned on each call, or a registry the engine publishes to.",
        },
        {
          field: "tokenUsage",
          reason: "Completions do not return usage counts.",
          needs: "Token counts returned per call and persisted per request.",
        },
        {
          field: "knowledgeSource",
          reason: "Which documents informed an answer is not recorded.",
          needs: "Retrieved-source ids stored alongside each response.",
        },
        {
          field: "deploymentStatus",
          reason: "There is no deployment registry for AI components.",
          needs: "A release record per agent with its rollout state.",
        },
      ],
      // Said explicitly on the governance console, because this is the console
      // where somebody would most expect to be able to change it.
      changeControl:
        "Model logic, prompts and routing are changed through code review and deployment, never from this console. Governance here means seeing what is running and what it has done.",
    };
  },

  // ── Backup and recovery ────────────────────────────────────────────────────

  /**
   * What an operator needs to know before a restore, and an honest statement
   * that this console cannot perform one.
   *
   * A backup button that shells out to the database from a web request is how a
   * console becomes the most dangerous thing in an estate. Showing state and
   * naming the command an operator should run is the responsible version.
   */
  async backupState() {
    const migrations = await prisma
      .$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
        SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5
      `
      .catch(() => []);

    const [users, organizations, workItems, auditEntries] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.workItem.count(),
      prisma.auditLog.count(),
    ]);

    return {
      schema: {
        migrationsApplied: migrations.length,
        latest: migrations[0]?.migration_name ?? null,
        appliedAt: migrations[0]?.finished_at ?? null,
      },
      volumes: { users, organizations, workItems, auditEntries },
      capability: {
        available: false as const,
        reason:
          "This console cannot take or restore a backup. Doing so from a web request would put the whole estate one mis-click from a restore, and would need database credentials in the API process.",
        needs:
          "Backups belong in the deployment: a scheduled dump to object storage, restored by an operator with a runbook. The console can then show the schedule and the last successful run.",
      },
    };
  },

  // ── Integrations ───────────────────────────────────────────────────────────

  /** Which external services are wired, read from configuration. */
  integrations() {
    const configured = (value: string | undefined) => Boolean(value && value.trim() !== "");

    return [
      {
        id: "auth-mail",
        name: "Authentication email",
        purpose: "Verification and password-reset links.",
        configured: configured(process.env.AUTH_MAIL_WEBHOOK_URL),
        envKey: "AUTH_MAIL_WEBHOOK_URL",
        impact: "Unset, links are written to the server log and nobody receives them.",
      },
      {
        id: "enquiry",
        name: "Website enquiries",
        purpose: "Contact and demo requests from the public site.",
        configured: configured(process.env.ENQUIRY_WEBHOOK_URL),
        envKey: "ENQUIRY_WEBHOOK_URL",
        impact: "Unset, enquiries reach a log rather than a person.",
      },
      {
        id: "google",
        name: "Google identity",
        purpose: "Provider sign-in for customers and staff.",
        configured: configured(process.env.GOOGLE_CLIENT_ID),
        envKey: "GOOGLE_CLIENT_ID",
        impact: "Unset, the Google button is not offered at all.",
      },
      {
        id: "redis",
        name: "Redis",
        purpose: "Shared cache and durable job queue.",
        configured: configured(process.env.REDIS_URL),
        envKey: "REDIS_URL",
        impact: "Unset, both fall back in-process and do not survive a restart.",
      },
      {
        id: "sms",
        name: "SMS",
        purpose: "Reminders and one-time codes.",
        configured: false,
        envKey: null,
        impact: "Not implemented. No SMS is sent by any part of the platform.",
      },
      {
        id: "payments",
        name: "Payment gateway",
        purpose: "Premium collection and billing.",
        configured: false,
        envKey: null,
        impact:
          "Not implemented. This is why the platform reports no revenue — there are no transactions to report.",
      },
      {
        id: "object-storage",
        name: "Cloud object storage",
        purpose: "Customer documents.",
        configured: false,
        envKey: null,
        impact: "Not implemented. Documents are on local disk and do not survive a container restart.",
      },
    ];
  },
};

/** Sign-in and authorisation failures over the last day and week. */
async function securitySnapshot() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000);

  const [failedDay, failedWeek, denialsDay, lockedNow, byOutcome] = await Promise.all([
    prisma.loginEvent.count({ where: { createdAt: { gte: dayAgo }, outcome: { not: "SUCCESS" } } }),
    prisma.loginEvent.count({ where: { createdAt: { gte: weekAgo }, outcome: { not: "SUCCESS" } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: dayAgo }, action: { contains: "denied" } } }),
    prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }),
    prisma.loginEvent.groupBy({
      by: ["outcome"],
      where: { createdAt: { gte: weekAgo } },
      _count: { _all: true },
    }),
  ]);

  return {
    failedLoginsToday: failedDay,
    failedLoginsThisWeek: failedWeek,
    permissionDenialsToday: denialsDay,
    accountsLockedNow: lockedNow,
    outcomes: Object.fromEntries(byOutcome.map((o) => [o.outcome, o._count._all])),
  };
}
