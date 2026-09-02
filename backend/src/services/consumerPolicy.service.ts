/**
 * The Aegis Consumer policy flow.
 *
 * Scope is the whole point of this file. Every read and every write is built
 * from the verified session and nothing else — there is no `userId` parameter
 * on any method, and no route below it accepts one. That is a deliberate
 * difference from `intelligence.service`, which does let an employee read a
 * customer's file: nothing in this flow has a reason to reach another person's
 * policy, so the safest shape is one where it cannot be expressed.
 *
 * A row belonging to somebody else reads as **absent**, not as forbidden. A 403
 * confirms the id exists, which turns a list of guesses into a census of the
 * platform's policies; a 404 says only that this person has no such policy,
 * which is true. The document platform already answers this way and this
 * matches it.
 *
 * Deletion is soft, always. A customer removing a policy must not remove the
 * record that they were advised about it — the audit trail outlives the row.
 */
import type { HeldPolicy, Vehicle } from "@prisma/client";
import prisma from "../config/db";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { CONSUMER } from "../config/constants";
import { assessRenewal, type RenewalAssessment } from "../consumer/renewalStatus";
import { assessTrust, type TrustAssessment } from "../consumer/trustStatus";
import { isConsumerMime } from "../consumer/documents";
import {
  GUIDANCE_DISCLAIMER,
  TRUST_REASON_COPY,
  localise,
  resolveRenewalCopy,
  resolveTrustCopy,
  type ConsumerLocale,
  type ResolvedRenewalCopy,
  type ResolvedTrustCopy,
} from "../consumer/messages";
import { normalizePolicyNumber, normalizeRegistration } from "../consumer/normalize";
import type { PolicyType, VehicleType } from "../consumer/vocabulary";

/** The only identity this service works from. */
export interface ConsumerActor {
  readonly id: string;
  readonly preferredLanguage?: string | null;
}

export interface VehicleInput {
  registrationNumber: string;
  vehicleType: VehicleType;
  make?: string | null;
  model?: string | null;
}

export interface PolicyInput {
  insurer?: string;
  policyNumber?: string;
  policyType?: PolicyType;
  startDate?: string | null;
  expiryDate?: string;
  idv?: number | string | null;
  ncbPercent?: number | string | null;
  vehicle?: VehicleInput;
  vehicleId?: string;
}

/** The motor domain, spelled once. */
const DOMAIN = "motor";

/**
 * A calendar date to the instant this platform stores it at.
 *
 * UTC midnight, matching the contract the renewal engine reads by. Written in
 * one place so a policy created through the form and one created any later way
 * cannot end up a day apart.
 */
function toStoredDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** A number from a form field, which may arrive as a string or an empty one. */
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

const trim = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

// ── What a caller sees ───────────────────────────────────────────────────────

export interface PolicyView {
  id: string;
  insurer: string | null;
  /** Masked. The full number is never sent back — see `maskPolicyNumber`. */
  policyNumberMasked: string | null;
  policyType: PolicyType | null;
  startDate: string | null;
  expiryDate: string | null;
  idv: number | null;
  ncbPercent: number | null;
  verificationState: string;
  verificationNote: string | null;
  enteredVia: string;
  vehicle: {
    id: string;
    registrationNumber: string;
    vehicleType: string;
    make: string | null;
    model: string | null;
  } | null;
  renewal: RenewalAssessment;
  copy: ResolvedRenewalCopy;
  /**
   * What Aegis can currently say about these details — see `trustStatus.ts`.
   *
   * Recomputed on every read rather than read back from `verificationState`,
   * for the same reason the renewal status is: the answer depends on today's
   * date and on the customer's other policies, so a stored value starts going
   * stale the moment it is written. The column is still updated on every write,
   * because an operations queue and the audit trail need a snapshot of what the
   * customer was actually shown.
   */
  trust: TrustAssessment;
  trustCopy: ResolvedTrustCopy;
  createdAt: string;
  updatedAt: string;
}

/**
 * Show the last four characters and nothing else.
 *
 * A policy number is the reference an insurer uses to identify an account over
 * the phone. It goes into this record because the customer needs it later, and
 * it comes back masked because a screen left open on a bus, or a screenshot
 * sent to a family member, should not be enough to impersonate them. Four is
 * what a person recognises their own policy by.
 */
export function maskPolicyNumber(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "•".repeat(trimmed.length);
  return `${"•".repeat(Math.min(trimmed.length - 4, 8))}${trimmed.slice(-4)}`;
}

/** `YYYY-MM-DD` from a stored instant, read in UTC per the storage contract. */
const toDateString = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

type PolicyWithVehicle = HeldPolicy & { vehicle: Vehicle | null };

/**
 * Which language to answer in.
 *
 * The customer's stored preference, overridable per request. Anything
 * unrecognised falls back to English rather than failing — a language we cannot
 * render is a reason to render something, not to withhold the answer.
 */
export function localeFor(actor: ConsumerActor, requested?: string): ConsumerLocale {
  const candidate = requested ?? actor.preferredLanguage ?? "en";
  return candidate === "ta" || candidate === "taEn" ? candidate : "en";
}

function toView(
  policy: PolicyWithVehicle,
  locale: ConsumerLocale,
  now?: Date,
  trust?: TrustAssessment
): PolicyView {
  const renewal = assessRenewal(policy.renewalDate, {
    timeZone: CONSUMER.TIMEZONE,
    ...(now ? { now } : {}),
  });

  // A policy read outside a trust context — nothing does this today, and the
  // fallback exists so adding such a caller cannot produce a view with a
  // missing badge. It assesses the policy alone, which is correct except that
  // it cannot see the customer's other policies.
  const assessment =
    trust ??
    assessTrust(
      {
        insurer: policy.insurer,
        policyNumber: policy.policyNumber,
        policyType: policy.policyType,
        expiryDate: policy.renewalDate,
        document: null,
        policyNumberOnAnotherPolicy: false,
      },
      now ? { now } : {}
    );

  return {
    id: policy.id,
    insurer: policy.insurer,
    policyNumberMasked: maskPolicyNumber(policy.policyNumber),
    policyType: (policy.policyType as PolicyType | null) ?? null,
    startDate: toDateString(policy.startDate),
    expiryDate: toDateString(policy.renewalDate),
    idv: policy.idv,
    ncbPercent: policy.ncbPercent,
    // The derived state, not the stored column. The two agree after every
    // write — `persistTrust` sees to that — but a read can legitimately reach a
    // different answer than the last write did, because a policy expires
    // without anybody touching it. Returning the column here would let one
    // response carry two different verdicts about the same policy.
    verificationState: assessment.state,
    verificationNote: localise(TRUST_REASON_COPY[assessment.reasonKey], locale),
    enteredVia: policy.enteredVia,
    vehicle: policy.vehicle
      ? {
          id: policy.vehicle.id,
          registrationNumber: policy.vehicle.registrationNumber,
          vehicleType: policy.vehicle.vehicleType,
          make: policy.vehicle.make,
          model: policy.vehicle.model,
        }
      : null,
    renewal,
    // Resolved here rather than left to the caller, so a screen cannot render a
    // status without the disclaimer that the specification requires beside it.
    copy: resolveRenewalCopy(renewal.messageKey, renewal.nextActionKey, locale),
    trust: assessment,
    // Same rule as the disclaimer: the scope note travels with the badge, so no
    // screen can show "Details check out" without saying what was checked.
    trustCopy: resolveTrustCopy(
      assessment.state,
      assessment.reasonKey,
      assessment.actionKey,
      locale
    ),
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

// ── The trust gate ───────────────────────────────────────────────────────────

/**
 * Assess every policy this customer holds, in one pass.
 *
 * Together rather than one at a time, because two of the checks are questions
 * about the *set*: whether the same certificate is attached to more than one
 * policy, and whether the same policy number appears on more than one. Assessed
 * per policy, each would have to re-read the others, and a list of ten policies
 * would become a hundred queries.
 *
 * The document is looked up by owner as well as by id. `HeldPolicy.documentId`
 * is not a foreign key, so a row could in principle name a document belonging
 * to somebody else; scoping the lookup means such a policy reads as having no
 * document rather than borrowing a stranger's.
 */
async function buildTrustContext(
  userId: string,
  now?: Date
): Promise<Map<string, TrustAssessment>> {
  const policies = await prisma.heldPolicy.findMany({
    where: { profile: { userId }, domain: DOMAIN, deletedAt: null },
    select: {
      id: true,
      insurer: true,
      policyNumber: true,
      policyNumberNorm: true,
      policyType: true,
      renewalDate: true,
      documentId: true,
    },
  });

  const documentIds = [
    ...new Set(policies.map((p) => p.documentId).filter((id): id is string => Boolean(id))),
  ];
  const documents = documentIds.length
    ? await prisma.uploadedDocument.findMany({
        where: { id: { in: documentIds }, ownerId: userId, deletedAt: null },
        select: { id: true, contentHash: true, mimeType: true },
      })
    : [];
  const documentById = new Map(documents.map((d) => [d.id, d]));

  // How many of this customer's policies each certificate and each policy
  // number is used by. More than one is the signal — never a finding.
  const hashUses = new Map<string, number>();
  const numberUses = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string | null | undefined) => {
    if (key) map.set(key, (map.get(key) ?? 0) + 1);
  };

  for (const policy of policies) {
    bump(hashUses, policy.documentId ? documentById.get(policy.documentId)?.contentHash : null);
    bump(numberUses, policy.policyNumberNorm);
  }

  const assessments = new Map<string, TrustAssessment>();
  for (const policy of policies) {
    const document = policy.documentId ? documentById.get(policy.documentId) : undefined;
    assessments.set(
      policy.id,
      assessTrust(
        {
          insurer: policy.insurer,
          policyNumber: policy.policyNumber,
          policyType: policy.policyType,
          expiryDate: policy.renewalDate,
          document: document
            ? {
                formatAccepted: isConsumerMime(document.mimeType),
                matchesAnotherPolicy: (hashUses.get(document.contentHash ?? "") ?? 0) > 1,
              }
            : null,
          policyNumberOnAnotherPolicy: (numberUses.get(policy.policyNumberNorm ?? "") ?? 0) > 1,
        },
        now ? { now } : {}
      )
    );
  }

  return assessments;
}

/**
 * Write the assessment onto the policy row.
 *
 * A snapshot of what the customer was last shown, not the value any read
 * returns — reads recompute. It is stored because the two things that outlive
 * the request need it: an operations queue that has to find the policies
 * somebody should look at, and an audit trail that has to answer what state a
 * policy was in on the day a customer says they were told something.
 *
 * The note is stored in English. It is an internal record; the customer's own
 * language is resolved per request from the same key.
 */
async function persistTrust(policyId: string, assessment: TrustAssessment): Promise<void> {
  await prisma.heldPolicy.update({
    where: { id: policyId },
    data: {
      verificationState: assessment.state,
      verificationNote: TRUST_REASON_COPY[assessment.reasonKey].en,
    },
  });
}

// ── The service ──────────────────────────────────────────────────────────────

export const consumerPolicyService = {
  /**
   * The profile every policy hangs off, created on first use.
   *
   * A customer entering their first policy has usually never filled in a
   * profile, and refusing to store the policy until they do would ask them to
   * answer questions about their income before they can find out when their
   * insurance runs out. The profile starts empty and is real.
   */
  async ensureProfile(userId: string): Promise<string> {
    const existing = await prisma.insuranceProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await prisma.insuranceProfile.create({
      data: { userId, source: "SELF" },
      select: { id: true },
    });
    return created.id;
  },

  // ── Vehicles ───────────────────────────────────────────────────────────────

  async listVehicles(actor: ConsumerActor) {
    return prisma.vehicle.findMany({
      where: { ownerId: actor.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Create a vehicle, or return the one that is already there.
   *
   * The same plate entered twice is one vehicle, not an error. A customer
   * adding this year's policy to the bike they registered last year should not
   * be stopped and told the vehicle exists — they know, that is why they typed
   * it. Matching is on the normalised form, so spacing and punctuation do not
   * decide the answer.
   *
   * A vehicle the customer previously deleted is revived rather than duplicated:
   * the unique constraint spans deleted rows, and inserting past it is not
   * possible anyway.
   */
  async upsertVehicle(actor: ConsumerActor, input: VehicleInput, tx = prisma) {
    const registrationNumber = input.registrationNumber.trim();
    const registrationNorm = normalizeRegistration(registrationNumber);
    if (!registrationNorm) {
      throw new AppError("Please enter the vehicle number.", 400, "VALIDATION_ERROR");
    }

    const existing = await tx.vehicle.findUnique({
      where: { ownerId_registrationNorm: { ownerId: actor.id, registrationNorm } },
    });

    if (existing) {
      return tx.vehicle.update({
        where: { id: existing.id },
        data: {
          registrationNumber,
          vehicleType: input.vehicleType,
          make: trim(input.make),
          model: trim(input.model),
          deletedAt: null,
        },
      });
    }

    return tx.vehicle.create({
      data: {
        ownerId: actor.id,
        registrationNumber,
        registrationNorm,
        vehicleType: input.vehicleType,
        make: trim(input.make),
        model: trim(input.model),
      },
    });
  },

  /** Change a vehicle's details. Scoped to the owner; absent if not theirs. */
  async updateVehicle(actor: ConsumerActor, vehicleId: string, input: Partial<VehicleInput>) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerId: actor.id, deletedAt: null },
    });
    if (!vehicle) throw new AppError("That vehicle does not exist.", 404, "NOT_FOUND");

    const data: Record<string, unknown> = {};
    if (input.registrationNumber !== undefined) {
      const registrationNumber = input.registrationNumber.trim();
      const registrationNorm = normalizeRegistration(registrationNumber);
      if (!registrationNorm) {
        throw new AppError("Please enter the vehicle number.", 400, "VALIDATION_ERROR");
      }
      // Renaming onto a plate they already hold would breach the per-owner
      // unique constraint. Caught here so the customer gets a sentence rather
      // than a database error surfacing as a 500.
      const clash = await prisma.vehicle.findUnique({
        where: { ownerId_registrationNorm: { ownerId: actor.id, registrationNorm } },
      });
      if (clash && clash.id !== vehicleId) {
        throw new AppError(
          "You have already added a vehicle with that number.",
          409,
          "CONFLICT"
        );
      }
      data.registrationNumber = registrationNumber;
      data.registrationNorm = registrationNorm;
    }
    if (input.vehicleType !== undefined) data.vehicleType = input.vehicleType;
    if (input.make !== undefined) data.make = trim(input.make);
    if (input.model !== undefined) data.model = trim(input.model);

    const updated = await prisma.vehicle.update({ where: { id: vehicleId }, data });
    auditService.record({
      actorId: actor.id,
      action: "consumer.vehicle.updated",
      entity: "Vehicle",
      entityId: vehicleId,
      metadata: { fields: Object.keys(data) },
    });
    return updated;
  },

  // ── Policies ───────────────────────────────────────────────────────────────

  async list(actor: ConsumerActor, options: { locale?: string; now?: Date } = {}) {
    const locale = localeFor(actor, options.locale);

    const policies = await prisma.heldPolicy.findMany({
      where: { profile: { userId: actor.id }, domain: DOMAIN, deletedAt: null },
      include: { vehicle: true },
      // Soonest expiry first: the policy that needs attention is the one a
      // customer opened this page to find, and burying it under an alphabetical
      // sort is how a renewal gets missed.
      orderBy: [{ renewalDate: "asc" }, { createdAt: "desc" }],
    });

    const trust = await buildTrustContext(actor.id, options.now);

    return {
      policies: policies.map((policy) =>
        toView(policy, locale, options.now, trust.get(policy.id))
      ),
      disclaimer: localise(GUIDANCE_DISCLAIMER, locale),
      locale,
    };
  },

  async getById(actor: ConsumerActor, policyId: string, options: { locale?: string; now?: Date } = {}) {
    const locale = localeFor(actor, options.locale);

    // Scoped in the query rather than fetched and then checked. A check after
    // the fact is one early return away from being skipped; a scope in the
    // `where` cannot be.
    const policy = await prisma.heldPolicy.findFirst({
      where: { id: policyId, profile: { userId: actor.id }, domain: DOMAIN, deletedAt: null },
      include: { vehicle: true },
    });
    if (!policy) throw new AppError("That policy does not exist.", 404, "NOT_FOUND");

    // Built across all of this customer's policies, not just this one: the
    // duplicate checks are questions about the set. See `buildTrustContext`.
    const trust = await buildTrustContext(actor.id, options.now);

    return {
      policy: toView(policy, locale, options.now, trust.get(policy.id)),
      disclaimer: localise(GUIDANCE_DISCLAIMER, locale),
      locale,
    };
  },

  /**
   * Store a policy the customer typed in.
   *
   * The vehicle and the policy are written together. Separately, a failure
   * between the two would leave a vehicle with no policy on it and a customer
   * who filled in a form and got nothing — and would then hit the duplicate
   * path on their second attempt.
   */
  async create(actor: ConsumerActor, input: PolicyInput, options: { locale?: string } = {}) {
    const profileId = await this.ensureProfile(actor.id);
    const locale = localeFor(actor, options.locale);

    const policy = await prisma.$transaction(async (tx) => {
      const vehicle = input.vehicle
        ? await this.upsertVehicle(actor, input.vehicle, tx as typeof prisma)
        : await tx.vehicle.findFirst({
            where: { id: input.vehicleId, ownerId: actor.id, deletedAt: null },
          });

      if (!vehicle) throw new AppError("That vehicle does not exist.", 404, "NOT_FOUND");

      return tx.heldPolicy.create({
        data: {
          profileId,
          domain: DOMAIN,
          insurer: trim(input.insurer),
          policyNumber: trim(input.policyNumber),
          policyNumberNorm: normalizePolicyNumber(input.policyNumber),
          policyType: input.policyType ?? "UNKNOWN",
          renewalDate: toStoredDate(input.expiryDate),
          startDate: toStoredDate(input.startDate),
          idv: toNumber(input.idv),
          ncbPercent: toNumber(input.ncbPercent),
          vehicleId: vehicle.id,
          // Typed by the customer, from their own certificate. Extraction does
          // not exist yet and will not write this value on its own when it does.
          enteredVia: "MANUAL",
          // The starting point. `persistTrust` overwrites it a moment later
          // with what the gate actually decided; it is set explicitly rather
          // than left to the column default so a policy is never momentarily
          // stateless if the assessment throws.
          verificationState: "UPLOADED",
          external: true,
          status: "ACTIVE",
        },
        include: { vehicle: true },
      });
    });

    // The trust gate runs on every write, so a policy is never shown with a
    // state that predates the details it is describing.
    const trust = await buildTrustContext(actor.id);
    const assessment = trust.get(policy.id);
    if (assessment) await persistTrust(policy.id, assessment);

    auditService.record({
      actorId: actor.id,
      action: "consumer.policy.created",
      entity: "HeldPolicy",
      entityId: policy.id,
      // No policy number, no registration — the audit trail records that a
      // policy was added, not what is on somebody's certificate.
      metadata: {
        policyType: policy.policyType,
        enteredVia: policy.enteredVia,
        trustState: assessment?.state ?? null,
      },
    });

    return {
      policy: toView(policy, locale, undefined, assessment),
      disclaimer: localise(GUIDANCE_DISCLAIMER, locale),
    };
  },

  /** Correct a policy. Partial: an absent field means "leave it alone". */
  async update(
    actor: ConsumerActor,
    policyId: string,
    input: PolicyInput,
    options: { locale?: string } = {}
  ) {
    const locale = localeFor(actor, options.locale);

    const existing = await prisma.heldPolicy.findFirst({
      where: { id: policyId, profile: { userId: actor.id }, domain: DOMAIN, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new AppError("That policy does not exist.", 404, "NOT_FOUND");

    const policy = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};

      if (input.insurer !== undefined) data.insurer = trim(input.insurer);
      if (input.policyNumber !== undefined) {
        data.policyNumber = trim(input.policyNumber);
        data.policyNumberNorm = normalizePolicyNumber(input.policyNumber);
      }
      if (input.policyType !== undefined) data.policyType = input.policyType;
      if (input.expiryDate !== undefined) data.renewalDate = toStoredDate(input.expiryDate);
      if (input.startDate !== undefined) data.startDate = toStoredDate(input.startDate);
      if (input.idv !== undefined) data.idv = toNumber(input.idv);
      if (input.ncbPercent !== undefined) data.ncbPercent = toNumber(input.ncbPercent);

      if (input.vehicle) {
        const vehicle = await this.upsertVehicle(actor, input.vehicle, tx as typeof prisma);
        data.vehicleId = vehicle.id;
      } else if (input.vehicleId !== undefined) {
        const vehicle = await tx.vehicle.findFirst({
          where: { id: input.vehicleId, ownerId: actor.id, deletedAt: null },
        });
        if (!vehicle) throw new AppError("That vehicle does not exist.", 404, "NOT_FOUND");
        data.vehicleId = vehicle.id;
      }

      return tx.heldPolicy.update({
        where: { id: policyId },
        data,
        include: { vehicle: true },
      });
    });

    const trust = await buildTrustContext(actor.id);
    const assessment = trust.get(policyId);
    if (assessment) await persistTrust(policyId, assessment);

    auditService.record({
      actorId: actor.id,
      action: "consumer.policy.updated",
      entity: "HeldPolicy",
      entityId: policyId,
      metadata: { fields: Object.keys(input).sort(), trustState: assessment?.state ?? null },
    });

    return {
      policy: toView(policy, locale, undefined, assessment),
      disclaimer: localise(GUIDANCE_DISCLAIMER, locale),
    };
  },

  /**
   * Remove a policy from the customer's list.
   *
   * Soft. The row stays, `deletedAt` is set, and every read in this service
   * already filters on it. What survives is the record that this person entered
   * this policy and was given advice about it — which is the thing a complaint
   * or a regulator asks about months later, and which a hard delete destroys.
   */
  async remove(actor: ConsumerActor, policyId: string) {
    const policy = await prisma.heldPolicy.findFirst({
      where: { id: policyId, profile: { userId: actor.id }, domain: DOMAIN, deletedAt: null },
      select: { id: true, policyType: true },
    });
    if (!policy) throw new AppError("That policy does not exist.", 404, "NOT_FOUND");

    await prisma.heldPolicy.update({
      where: { id: policyId },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    });

    auditService.record({
      actorId: actor.id,
      action: "consumer.policy.deleted",
      entity: "HeldPolicy",
      entityId: policyId,
      metadata: { policyType: policy.policyType, soft: true },
    });

    return { deleted: true };
  },
};
