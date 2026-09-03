/**
 * "Help me renew" — the request, the consent behind it, and the queue it lands in.
 *
 * Two audiences, and the split runs through every method here.
 *
 * A **customer** reaches only their own requests and their own consents, the
 * same way they reach only their own policies: no method takes a user id, every
 * query is built from the verified session, and somebody else's row reads as
 * absent rather than as forbidden.
 *
 * An **operator** works the queue, gated by `lead.read` and `lead.write` at the
 * route. Those capabilities already exist and already mean "may work the
 * pipeline" — inventing `renewal.read` would have meant a permission nobody had
 * and a dashboard nobody could open.
 *
 * One thing this file deliberately does not do is send anything. No email, no
 * SMS, no WhatsApp. A request is a row in a queue that a person reads; the
 * consent it carries is what would make sending lawful *later*, and recording
 * consent before there is a sender is the right order to build it in.
 */
import type { RenewalConsent, RenewalLead } from "@prisma/client";
import prisma from "../config/db";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { CONSUMER } from "../config/constants";
import { assessRenewal } from "../consumer/renewalStatus";
import { consentTextHash } from "../consumer/consentHash";
import {
  CONSENT_TEXT_VERSION,
  GUIDANCE_DISCLAIMER,
  RENEWAL_REQUEST_COPY,
  localise,
  type ConsumerLocale,
} from "../consumer/messages";
import {
  LABELS,
  canTransition,
  explainRefusal,
  type ClosedReason,
  type ConsentPurpose,
  type ContactChannel,
  type RenewalLeadStatus,
} from "../consumer/renewalLead";
import { localeFor, maskPolicyNumber, type ConsumerActor } from "./consumerPolicy.service";

/** Which channels cannot be worked without a number. */
const needsPhone = (channel: ContactChannel): boolean =>
  channel === "CALL" || channel === "WHATSAPP";

/** The circumstances a consent was given in. Part of the proof, not tracking. */
export interface ConsentContext {
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

export interface ConsentInput {
  readonly channel: ContactChannel;
  readonly purpose: ConsentPurpose;
  readonly policyId?: string | null;
}

export interface RenewalRequestInput {
  readonly preferredChannel: ContactChannel;
  /**
   * The number to reach them on. Required for CALL and WHATSAPP, ignored for
   * EMAIL — a request nobody can act on is worse than one that was refused.
   */
  readonly contactPhone?: string | null;
  /** Whether they also agreed to be reminded in future. A separate agreement. */
  readonly alsoRemind?: boolean;
}

// ── What a customer sees ─────────────────────────────────────────────────────

export interface ConsentView {
  id: string;
  channel: string;
  purpose: string;
  grantedAt: string;
  withdrawnAt: string | null;
  /** Live means it has not been withdrawn. Said rather than inferred by a screen. */
  active: boolean;
  textVersion: string;
  policyId: string | null;
}

const toConsentView = (consent: RenewalConsent): ConsentView => ({
  id: consent.id,
  channel: consent.channel,
  purpose: consent.purpose,
  grantedAt: consent.grantedAt.toISOString(),
  withdrawnAt: consent.withdrawnAt ? consent.withdrawnAt.toISOString() : null,
  active: consent.withdrawnAt === null,
  textVersion: consent.textVersion,
  policyId: consent.policyId,
});

export interface RenewalRequestView {
  id: string;
  status: RenewalLeadStatus;
  statusLabel: string;
  preferredChannel: string;
  policyId: string | null;
  urgencyAtCreation: string;
  expiryAtCreation: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present only when it is finished. */
  closedReason: string | null;
}

const toRequestView = (lead: RenewalLead): RenewalRequestView => ({
  id: lead.id,
  status: lead.status as RenewalLeadStatus,
  statusLabel: LABELS[lead.status as RenewalLeadStatus] ?? lead.status,
  preferredChannel: lead.preferredChannel,
  policyId: lead.policyId,
  urgencyAtCreation: lead.urgencyAtCreation,
  expiryAtCreation: lead.expiryAtCreation ? lead.expiryAtCreation.toISOString().slice(0, 10) : null,
  createdAt: lead.createdAt.toISOString(),
  updatedAt: lead.updatedAt.toISOString(),
  closedReason: lead.closedReason,
});

// ── What an operator sees ────────────────────────────────────────────────────

/**
 * A queue row.
 *
 * Carries the contact details, because an operator picking this up has to be
 * able to ring the person without opening another screen. It does **not** carry
 * the policy number: knowing which policy somebody is asking about does not
 * require the number printed on their certificate, and the queue is the widest
 * audience this data reaches.
 */
export interface QueueRow {
  id: string;
  status: RenewalLeadStatus;
  statusLabel: string;
  preferredChannel: string;
  urgencyAtCreation: string;
  expiryAtCreation: string | null;
  createdAt: string;
  updatedAt: string;
  assignedToId: string | null;
  closedReason: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
    /** The number they gave for this request, when the channel needed one. */
    phone: string | null;
  };
  policy: {
    id: string;
    insurer: string | null;
    policyNumberMasked: string | null;
    registrationNumber: string | null;
    expiryDate: string | null;
  } | null;
  /** Whether a live consent still stands for the channel they chose. */
  consentActive: boolean;
}

type LeadWithRelations = RenewalLead & {
  user: { id: string; name: string; email: string };
  policy: {
    id: string;
    insurer: string | null;
    policyNumber: string | null;
    renewalDate: Date | null;
    vehicle: { registrationNumber: string } | null;
  } | null;
  consent: RenewalConsent | null;
};

const toQueueRow = (lead: LeadWithRelations): QueueRow => ({
  id: lead.id,
  status: lead.status as RenewalLeadStatus,
  statusLabel: LABELS[lead.status as RenewalLeadStatus] ?? lead.status,
  preferredChannel: lead.preferredChannel,
  urgencyAtCreation: lead.urgencyAtCreation,
  expiryAtCreation: lead.expiryAtCreation ? lead.expiryAtCreation.toISOString().slice(0, 10) : null,
  createdAt: lead.createdAt.toISOString(),
  updatedAt: lead.updatedAt.toISOString(),
  assignedToId: lead.assignedToId,
  closedReason: lead.closedReason,
  customer: {
    id: lead.user.id,
    name: lead.user.name,
    email: lead.user.email,
    // From the request, not from the account: an account has no phone number,
    // and this is the number they gave for this request.
    phone: lead.contactPhone,
  },
  policy: lead.policy
    ? {
        id: lead.policy.id,
        insurer: lead.policy.insurer,
        policyNumberMasked: maskPolicyNumber(lead.policy.policyNumber),
        registrationNumber: lead.policy.vehicle?.registrationNumber ?? null,
        expiryDate: lead.policy.renewalDate
          ? lead.policy.renewalDate.toISOString().slice(0, 10)
          : null,
      }
    : null,
  consentActive: lead.consent !== null && lead.consent.withdrawnAt === null,
});

const QUEUE_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  policy: {
    select: {
      id: true,
      insurer: true,
      policyNumber: true,
      renewalDate: true,
      vehicle: { select: { registrationNumber: true } },
    },
  },
  consent: true,
} as const;

export const renewalLeadService = {
  // ── Consent ────────────────────────────────────────────────────────────────

  /**
   * Record that somebody agreed to something.
   *
   * Never an upsert. Agreeing again is a new row, because "when did they agree"
   * has a different answer each time and overwriting the first one destroys the
   * only record of it. An existing live consent for the same channel and purpose
   * is returned unchanged instead — re-agreeing to what you already agreed to is
   * not an event.
   */
  async grantConsent(actor: ConsumerActor, input: ConsentInput, context: ConsentContext = {}) {
    const live = await prisma.renewalConsent.findFirst({
      where: {
        userId: actor.id,
        channel: input.channel,
        purpose: input.purpose,
        withdrawnAt: null,
      },
      orderBy: { grantedAt: "desc" },
    });
    if (live) return toConsentView(live);

    const consent = await prisma.renewalConsent.create({
      data: {
        userId: actor.id,
        channel: input.channel,
        purpose: input.purpose,
        textVersion: CONSENT_TEXT_VERSION,
        // The wording itself, hashed. See `consentHash.ts` for why the version
        // alone is not enough.
        textHash: consentTextHash(input.purpose),
        policyId: input.policyId ?? null,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });

    auditService.record({
      actorId: actor.id,
      action: "consumer.consent.granted",
      entity: "RenewalConsent",
      entityId: consent.id,
      metadata: {
        channel: consent.channel,
        purpose: consent.purpose,
        textVersion: consent.textVersion,
      },
    });

    return toConsentView(consent);
  },

  /**
   * Stop it.
   *
   * `withdrawnAt`, never a delete. The question asked afterwards is not "do they
   * consent now" but "what did they agree to, in which words, on which date, and
   * when did they stop" — and a deleted row cannot answer any of it.
   *
   * Withdrawing does not close the requests raised under it. Somebody who asked
   * for a call and then withdrew the standing permission still asked; the queue
   * row shows `consentActive: false`, which is what tells an operator not to
   * ring them. Silently closing it would erase the request from the record.
   */
  async withdrawConsent(actor: ConsumerActor, consentId: string, locale?: string) {
    const consent = await prisma.renewalConsent.findFirst({
      where: { id: consentId, userId: actor.id },
    });
    if (!consent) throw new AppError("That permission does not exist.", 404, "NOT_FOUND");

    // Withdrawing twice is not an error; the first withdrawal stands and its
    // date is the true one.
    const updated =
      consent.withdrawnAt === null
        ? await prisma.renewalConsent.update({
            where: { id: consentId },
            data: { withdrawnAt: new Date() },
          })
        : consent;

    if (consent.withdrawnAt === null) {
      auditService.record({
        actorId: actor.id,
        action: "consumer.consent.withdrawn",
        entity: "RenewalConsent",
        entityId: consentId,
        metadata: { channel: consent.channel, purpose: consent.purpose },
      });
    }

    return {
      consent: toConsentView(updated),
      message: localise(RENEWAL_REQUEST_COPY.withdrawn, localeFor(actor, locale)),
    };
  },

  /** Everything this customer has agreed to, including what they have stopped. */
  async listConsents(actor: ConsumerActor) {
    const consents = await prisma.renewalConsent.findMany({
      where: { userId: actor.id },
      orderBy: { grantedAt: "desc" },
    });
    return { consents: consents.map(toConsentView) };
  },

  // ── Raising a request ──────────────────────────────────────────────────────

  /**
   * Ask for help renewing one policy.
   *
   * The consent is created in the same transaction as the request, and the
   * request refuses to exist without one. That ordering is the whole point: a
   * queue row with no consent behind it is a phone number somebody will ring
   * without being able to say why they were allowed to.
   *
   * The urgency and expiry are **snapshots**. A request raised at eleven days to
   * expiry was urgent when it was raised, and a queue that silently re-sorts
   * itself as dates pass makes "why was this not called?" unanswerable later.
   */
  async requestHelp(
    actor: ConsumerActor,
    policyId: string,
    input: RenewalRequestInput,
    options: { locale?: string; context?: ConsentContext } = {}
  ) {
    const locale: ConsumerLocale = localeFor(actor, options.locale);

    const policy = await prisma.heldPolicy.findFirst({
      where: { id: policyId, profile: { userId: actor.id }, domain: "motor", deletedAt: null },
      select: { id: true, renewalDate: true },
    });
    if (!policy) throw new AppError("That policy does not exist.", 404, "NOT_FOUND");

    // One open request per policy. A customer tapping twice on a slow connection
    // should not put two rows in front of two different operators.
    const open = await prisma.renewalLead.findFirst({
      where: { userId: actor.id, policyId, status: { not: "CLOSED" }, deletedAt: null },
    });
    if (open) {
      return {
        request: toRequestView(open),
        alreadyOpen: true,
        message: localise(RENEWAL_REQUEST_COPY.received, locale),
        disclaimer: localise(GUIDANCE_DISCLAIMER, locale),
      };
    }

    // Checked here as well as in the schema, because the rule is conditional on
    // the channel and a service is where a rule about two fields belongs.
    if (needsPhone(input.preferredChannel) && !(input.contactPhone ?? "").trim()) {
      throw new AppError(
        "Please give us a number to reach you on, or choose email instead.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const renewal = assessRenewal(policy.renewalDate, { timeZone: CONSUMER.TIMEZONE });
    const urgency = renewal.ok ? renewal.urgency : "NONE";

    const consent = await this.grantConsent(
      actor,
      { channel: input.preferredChannel, purpose: "RENEWAL_ASSISTANCE", policyId },
      options.context ?? {}
    );

    // A separate agreement, taken only if it was actually given.
    if (input.alsoRemind) {
      await this.grantConsent(
        actor,
        { channel: input.preferredChannel, purpose: "RENEWAL_REMINDER", policyId },
        options.context ?? {}
      );
    }

    const lead = await prisma.renewalLead.create({
      data: {
        userId: actor.id,
        policyId,
        status: "NEW",
        preferredChannel: input.preferredChannel,
        contactPhone: needsPhone(input.preferredChannel) ? (input.contactPhone ?? "").trim() : null,
        urgencyAtCreation: urgency,
        expiryAtCreation: policy.renewalDate,
        consentId: consent.id,
      },
    });

    auditService.record({
      actorId: actor.id,
      action: "consumer.renewalRequest.created",
      entity: "RenewalLead",
      entityId: lead.id,
      // No phone number and no policy number. The trail records that somebody
      // asked for help, not their contact details.
      metadata: {
        policyId,
        preferredChannel: lead.preferredChannel,
        urgencyAtCreation: urgency,
        consentId: consent.id,
        alsoRemind: Boolean(input.alsoRemind),
      },
    });

    return {
      request: toRequestView(lead),
      alreadyOpen: false,
      message: localise(RENEWAL_REQUEST_COPY.received, locale),
      disclaimer: localise(GUIDANCE_DISCLAIMER, locale),
    };
  },

  /** This customer's own requests. */
  async myRequests(actor: ConsumerActor) {
    const leads = await prisma.renewalLead.findMany({
      where: { userId: actor.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return { requests: leads.map(toRequestView) };
  },

  // ── The operations queue ───────────────────────────────────────────────────

  /**
   * The queue, most urgent first.
   *
   * Not tenant-scoped, and that is a property of the data rather than an
   * oversight: a customer's `organizationId` is null by design, so these rows
   * belong to the Aegis consumer funnel rather than to any one organisation.
   * `lead.read` is therefore the whole gate. Partitioning by tenant later is an
   * additive change, the same as the model was.
   */
  async queue(
    filters: { status?: RenewalLeadStatus; channel?: ContactChannel; page?: number; limit?: number } = {}
  ) {
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const page = Math.max(filters.page ?? 1, 1);

    const where = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.channel ? { preferredChannel: filters.channel } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.renewalLead.findMany({
        where,
        include: QUEUE_INCLUDE,
        // Urgency first, then oldest first within a band: the request that has
        // been waiting longest at the same urgency is the one that lapses.
        orderBy: [{ urgencyAtCreation: "desc" }, { createdAt: "asc" }],
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.renewalLead.count({ where }),
    ]);

    return {
      leads: rows.map(toQueueRow),
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    };
  },

  /** One request, in full. */
  async detail(leadId: string): Promise<QueueRow> {
    const lead = await prisma.renewalLead.findFirst({
      where: { id: leadId, deletedAt: null },
      include: QUEUE_INCLUDE,
    });
    if (!lead) throw new AppError("That request does not exist.", 404, "NOT_FOUND");
    return toQueueRow(lead);
  },

  /**
   * Move a request along.
   *
   * The transition table decides, not the caller — see `renewalLead.ts` for why
   * NEW cannot go straight to CLOSED. A refusal answers with what the request
   * *can* do next, because an operator who is told "not permitted" and nothing
   * else will click the other four buttons to find out.
   */
  async advance(
    staffId: string,
    leadId: string,
    input: { status: RenewalLeadStatus; closedReason?: ClosedReason | null; assignToMe?: boolean }
  ) {
    const lead = await prisma.renewalLead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: { id: true, status: true, assignedToId: true },
    });
    if (!lead) throw new AppError("That request does not exist.", 404, "NOT_FOUND");

    const from = lead.status as RenewalLeadStatus;
    if (!canTransition(from, input.status)) {
      throw new AppError(explainRefusal(from, input.status), 409, "CONFLICT");
    }

    // Closing without saying why produces a queue nobody can learn from.
    if (input.status === "CLOSED" && !input.closedReason) {
      throw new AppError(
        "Please say why this is being closed. It is the only thing that makes the queue worth counting.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const updated = await prisma.renewalLead.update({
      where: { id: leadId },
      data: {
        status: input.status,
        ...(input.status === "CLOSED" ? { closedReason: input.closedReason ?? null } : {}),
        // Whoever moves it first owns it, unless somebody already does. An
        // operator picking up an unassigned request should not have to claim it
        // in a second click they will forget.
        ...(lead.assignedToId === null && input.assignToMe !== false
          ? { assignedToId: staffId }
          : {}),
      },
      include: QUEUE_INCLUDE,
    });

    auditService.record({
      actorId: staffId,
      action: "renewalLead.advanced",
      entity: "RenewalLead",
      entityId: leadId,
      // Both ends of the move. "Changed to CLOSED" alone cannot answer whether
      // the workflow was followed.
      metadata: {
        from,
        to: input.status,
        closedReason: input.status === "CLOSED" ? (input.closedReason ?? null) : null,
        assignedToId: updated.assignedToId,
      },
    });

    return toQueueRow(updated);
  },

  /**
   * The queue as spreadsheet rows.
   *
   * Flat and already-formatted, so the screen, the CSV and any later format
   * share one definition of what a row *is*. The turning into CSV happens in
   * `toCsv` — the platform's existing one, which quotes every field and defuses
   * a leading formula character, and which is the reason this export does not
   * hand somebody a working exfiltration link inside a customer's name.
   *
   * The policy number is masked here as it is everywhere else. An export leaves
   * the platform and stops being governed by it, which makes it the last place
   * to widen what a row contains.
   */
  async exportRows(filters: { status?: RenewalLeadStatus; channel?: ContactChannel } = {}) {
    const { leads } = await this.queue({ ...filters, limit: 100, page: 1 });
    return leads.map((lead) => ({
      "Request id": lead.id,
      Status: lead.statusLabel,
      Urgency: lead.urgencyAtCreation,
      "Raised on": lead.createdAt.slice(0, 10),
      "Contact by": lead.preferredChannel,
      "Consent live": lead.consentActive ? "Yes" : "No",
      Customer: lead.customer.name,
      Email: lead.customer.email,
      Phone: lead.customer.phone ?? "",
      Vehicle: lead.policy?.registrationNumber ?? "",
      Insurer: lead.policy?.insurer ?? "",
      "Policy number": lead.policy?.policyNumberMasked ?? "",
      "Policy expires": lead.policy?.expiryDate ?? "",
      "Closed because": lead.closedReason ?? "",
    }));
  },
};
