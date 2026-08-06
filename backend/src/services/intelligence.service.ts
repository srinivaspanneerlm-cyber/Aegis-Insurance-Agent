/**
 * The application service around the Intelligence Engine.
 *
 * Owns three things the engine deliberately does not: persistence, scope, and
 * caching.
 *
 * **Scope** works the same way it does for documents — decided by who is
 * asking, never by what they ask for. A customer reads their own profile. An
 * employee with `customer.read` reads a customer's, because advising somebody
 * without seeing their cover is the problem this sprint exists to fix. Nobody
 * reads a profile by passing a different id than their permissions allow.
 *
 * **Caching** is keyed on the profile hash. Re-running the engine is cheap, but
 * a stored run is what lets a customer ask why they were told something last
 * month — so runs are kept, and a run whose hash still matches is reused rather
 * than duplicated.
 */
import prisma from "../config/db";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { roleHasPermission } from "../auth/permissions";
import { intelligenceEngine, hashProfile } from "../intelligence/engine";
import { profileCompleteness } from "../intelligence/explain";
import {
  isInsuranceDomain,
  type FinancialGoal,
  type IncomeRange,
  type InsuranceDomain,
  type InsuranceProfileFacts,
  type IntelligenceReport,
  type PropertyHolding,
  type RiskPreference,
  type TravelFrequency,
  type VehicleHolding,
} from "../intelligence/types";

interface Actor {
  readonly id: string;
  readonly role: string;
}

/** Parses a JSON column, returning the fallback rather than throwing. */
function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw) as T;
    return value ?? fallback;
  } catch {
    // A malformed column is a data problem, not a reason to deny somebody their
    // whole analysis. The field reads as absent, which the engine handles.
    return fallback;
  }
}

export interface ProfileInput {
  age?: number | null;
  occupation?: string | null;
  incomeRange?: IncomeRange | null;
  city?: string | null;
  state?: string | null;
  maritalStatus?: string | null;
  familyMembers?: number | null;
  dependents?: number | null;
  parentsDependent?: boolean | null;
  vehicles?: VehicleHolding[] | null;
  properties?: PropertyHolding[] | null;
  travelFrequency?: TravelFrequency | null;
  healthConditions?: string[] | null;
  smoker?: boolean | null;
  financialGoals?: FinancialGoal[] | null;
  riskPreference?: RiskPreference | null;
  insuranceHistory?: { yearsHeld?: number; priorClaims?: number; lapses?: number } | null;
}

export interface HeldPolicyInput {
  domain: InsuranceDomain;
  insurer?: string | null;
  productName?: string | null;
  policyNumber?: string | null;
  sumInsured?: number | null;
  premium?: number | null;
  startDate?: string | null;
  renewalDate?: string | null;
  external?: boolean;
  status?: string;
  notes?: string | null;
}

export const intelligenceService = {
  /**
   * Resolves whose profile the actor may read.
   *
   * Returns the target user id, or throws. Deliberately the only place that
   * decides this — every entry point below goes through it, so a new endpoint
   * cannot accidentally skip the check.
   */
  authoriseFor(actor: Actor, requestedUserId?: string): string {
    if (!requestedUserId || requestedUserId === actor.id) return actor.id;

    if (!roleHasPermission(actor.role, "customer.read")) {
      auditService.record({
        actorId: actor.id,
        action: "authz.intelligence.denied",
        metadata: { requestedUserId },
      });
      throw new AppError("You do not have access to that customer.", 403, "FORBIDDEN");
    }
    return requestedUserId;
  },

  /** Creates or updates a profile. Partial by design — see the schema comment. */
  async saveProfile(actor: Actor, input: ProfileInput, targetUserId?: string) {
    const userId = this.authoriseFor(actor, targetUserId);

    const data = {
      age: input.age ?? null,
      occupation: input.occupation ?? null,
      incomeRange: input.incomeRange ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      maritalStatus: input.maritalStatus ?? null,
      familyMembers: input.familyMembers ?? null,
      dependents: input.dependents ?? null,
      parentsDependent: input.parentsDependent ?? null,
      vehicleOwnership: input.vehicles ? JSON.stringify(input.vehicles) : null,
      propertyOwnership: input.properties ? JSON.stringify(input.properties) : null,
      travelFrequency: input.travelFrequency ?? null,
      healthConditions: input.healthConditions ? JSON.stringify(input.healthConditions) : null,
      smoker: input.smoker ?? null,
      financialGoals: input.financialGoals ? JSON.stringify(input.financialGoals) : null,
      riskPreference: input.riskPreference ?? null,
      insuranceHistory: input.insuranceHistory ? JSON.stringify(input.insuranceHistory) : null,
      source: actor.id === userId ? "SELF" : "ADVISOR",
    };

    const existing = await prisma.insuranceProfile.findUnique({ where: { userId } });

    // Merge rather than replace. A partial update from the AI mid-conversation
    // must not erase what a customer typed into the form earlier — that data
    // loss is invisible and permanent.
    const merged = existing
      ? Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            value === null ? (existing as Record<string, unknown>)[key] : value,
          ])
        )
      : data;

    const saved = await prisma.insuranceProfile.upsert({
      where: { userId },
      create: { userId, ...(merged as typeof data) },
      update: merged as typeof data,
    });

    // Completeness is computed from the facts as the engine sees them, so the
    // number on the profile and the number in a report can never disagree.
    const facts = await this.facts(userId);
    const completeness = profileCompleteness(facts);
    await prisma.insuranceProfile.update({
      where: { id: saved.id },
      data: { completeness, profileHash: hashProfile(facts) },
    });

    auditService.record({
      actorId: actor.id,
      action: "intelligence.profile.saved",
      metadata: { userId, completeness, bySelf: actor.id === userId },
    });

    return this.getProfile(actor, userId);
  },

  async getProfile(actor: Actor, targetUserId?: string) {
    const userId = this.authoriseFor(actor, targetUserId);
    const profile = await prisma.insuranceProfile.findUnique({
      where: { userId },
      include: { heldPolicies: { orderBy: { renewalDate: "asc" } } },
    });

    if (!profile) {
      // Not an error. Everybody starts without a profile, and a 404 here would
      // make the first-run experience an error state.
      return { exists: false as const, userId, completeness: 0, profile: null, heldPolicies: [] };
    }

    return {
      exists: true as const,
      userId,
      completeness: profile.completeness,
      profile: {
        age: profile.age,
        occupation: profile.occupation,
        incomeRange: profile.incomeRange,
        city: profile.city,
        state: profile.state,
        maritalStatus: profile.maritalStatus,
        familyMembers: profile.familyMembers,
        dependents: profile.dependents,
        parentsDependent: profile.parentsDependent,
        vehicles: parseJson<VehicleHolding[]>(profile.vehicleOwnership, []),
        properties: parseJson<PropertyHolding[]>(profile.propertyOwnership, []),
        travelFrequency: profile.travelFrequency,
        healthConditions: parseJson<string[]>(profile.healthConditions, []),
        smoker: profile.smoker,
        financialGoals: parseJson<FinancialGoal[]>(profile.financialGoals, []),
        riskPreference: profile.riskPreference,
        insuranceHistory: parseJson(profile.insuranceHistory, null),
        source: profile.source,
        updatedAt: profile.updatedAt,
      },
      heldPolicies: profile.heldPolicies,
    };
  },

  /** The profile as the engine consumes it. */
  async facts(userId: string): Promise<InsuranceProfileFacts> {
    const profile = await prisma.insuranceProfile.findUnique({
      where: { userId },
      include: { heldPolicies: true },
    });

    if (!profile) return { userId };

    return {
      userId,
      age: profile.age,
      occupation: profile.occupation,
      incomeRange: (profile.incomeRange as IncomeRange | null) ?? null,
      city: profile.city,
      state: profile.state,
      maritalStatus: profile.maritalStatus,
      familyMembers: profile.familyMembers,
      dependents: profile.dependents,
      parentsDependent: profile.parentsDependent,
      vehicles: parseJson<VehicleHolding[]>(profile.vehicleOwnership, []),
      properties: parseJson<PropertyHolding[]>(profile.propertyOwnership, []),
      travelFrequency: (profile.travelFrequency as TravelFrequency | null) ?? null,
      healthConditions: parseJson<string[]>(profile.healthConditions, []),
      smoker: profile.smoker,
      financialGoals: parseJson<FinancialGoal[]>(profile.financialGoals, []),
      riskPreference: (profile.riskPreference as RiskPreference | null) ?? null,
      insuranceHistory: parseJson(profile.insuranceHistory, null),
      heldPolicies: profile.heldPolicies
        .filter((p) => isInsuranceDomain(p.domain))
        .map((p) => ({
          id: p.id,
          domain: p.domain as InsuranceDomain,
          insurer: p.insurer,
          productName: p.productName,
          sumInsured: p.sumInsured,
          premium: p.premium,
          renewalDate: p.renewalDate,
          status: p.status,
          external: p.external,
        })),
    };
  },

  async addHeldPolicy(actor: Actor, input: HeldPolicyInput, targetUserId?: string) {
    const userId = this.authoriseFor(actor, targetUserId);
    if (!isInsuranceDomain(input.domain)) {
      throw new AppError("That is not an insurance type we recognise.", 400, "UNKNOWN_DOMAIN");
    }

    const profile = await prisma.insuranceProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const created = await prisma.heldPolicy.create({
      data: {
        profileId: profile.id,
        domain: input.domain,
        insurer: input.insurer ?? null,
        productName: input.productName ?? null,
        policyNumber: input.policyNumber ?? null,
        sumInsured: input.sumInsured ?? null,
        premium: input.premium ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        renewalDate: input.renewalDate ? new Date(input.renewalDate) : null,
        external: input.external ?? true,
        status: input.status ?? "ACTIVE",
        notes: input.notes ?? null,
      },
    });

    await this.refreshCompleteness(userId);
    auditService.record({
      actorId: actor.id,
      action: "intelligence.policy.added",
      metadata: { userId, domain: input.domain, external: created.external },
    });
    return created;
  },

  async removeHeldPolicy(actor: Actor, policyId: string, targetUserId?: string) {
    const userId = this.authoriseFor(actor, targetUserId);
    const profile = await prisma.insuranceProfile.findUnique({ where: { userId } });
    if (!profile) throw new AppError("That policy does not exist.", 404, "NOT_FOUND");

    // Scoped by profileId, so a policy id belonging to somebody else reads as
    // absent rather than as forbidden — the same non-disclosure rule the
    // document platform uses.
    const deleted = await prisma.heldPolicy.deleteMany({
      where: { id: policyId, profileId: profile.id },
    });
    if (deleted.count === 0) throw new AppError("That policy does not exist.", 404, "NOT_FOUND");

    await this.refreshCompleteness(userId);
    auditService.record({
      actorId: actor.id,
      action: "intelligence.policy.removed",
      metadata: { userId, policyId },
    });
    return { removed: true };
  },

  async refreshCompleteness(userId: string) {
    const facts = await this.facts(userId);
    await prisma.insuranceProfile.updateMany({
      where: { userId },
      data: { completeness: profileCompleteness(facts), profileHash: hashProfile(facts) },
    });
  },

  /**
   * The full report.
   *
   * `fresh` forces a recompute. Without it a run whose profile hash still
   * matches is returned from storage — the advice has not changed because the
   * facts have not, and re-deriving it would only produce a new timestamp.
   */
  async report(
    actor: Actor,
    options: { targetUserId?: string; fresh?: boolean } = {}
  ): Promise<IntelligenceReport & { cached: boolean }> {
    const userId = this.authoriseFor(actor, options.targetUserId);
    const facts = await this.facts(userId);
    const hash = hashProfile(facts);

    if (!options.fresh) {
      const stored = await prisma.intelligenceRun.findFirst({
        where: { userId, kind: "FULL", profileHash: hash },
        orderBy: { createdAt: "desc" },
      });
      if (stored) {
        try {
          const payload = JSON.parse(stored.payload) as IntelligenceReport;
          return { ...revive(payload), cached: true };
        } catch {
          // Fall through and recompute. A corrupt cache row must never be the
          // reason somebody cannot get advice.
        }
      }
    }

    const report = await intelligenceEngine().report(facts);

    const profile = await prisma.insuranceProfile.findUnique({ where: { userId } });
    if (profile) {
      await prisma.intelligenceRun.create({
        data: {
          profileId: profile.id,
          userId,
          kind: "FULL",
          profileHash: hash,
          payload: JSON.stringify(report),
          confidence: report.need.explanation.confidence.score,
          engineVersion: report.engineVersion,
        },
      });
    }

    auditService.record({
      actorId: actor.id,
      action: "intelligence.report.generated",
      metadata: {
        userId,
        recommendations: report.recommendations.length,
        gaps: report.gaps.length,
        completeness: report.profileCompleteness,
      },
    });

    return { ...report, cached: false };
  },

  /** Past runs, so "why was I told that?" has an answer. */
  async history(actor: Actor, targetUserId?: string, limit = 20) {
    const userId = this.authoriseFor(actor, targetUserId);
    const runs = await prisma.intelligenceRun.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 50),
      select: {
        id: true,
        kind: true,
        profileHash: true,
        confidence: true,
        engineVersion: true,
        createdAt: true,
      },
    });
    return runs;
  },
};

/** JSON round-trips turn Dates into strings. Puts them back. */
function revive(report: IntelligenceReport): IntelligenceReport {
  return {
    ...report,
    generatedAt: new Date(report.generatedAt),
    renewals: report.renewals.map((r) => ({
      ...r,
      renewalDate: new Date(r.renewalDate),
      reminderOn: new Date(r.reminderOn),
    })),
  };
}
