/**
 * Aegis Kural Lite — the answering service.
 *
 * Retrieval, not generation. A question comes in, the matcher picks one of six
 * fixed answers or none, and the answer is returned with a disclaimer and an
 * offer to speak to a person attached by this file rather than by the caller.
 * There is no LLM on this path and no network call of any kind, which is why it
 * is not behind `aiLimiter`: throttling it as though it cost money would be a
 * claim about what it does.
 *
 * One thing here is not general. When somebody asks about expiry and names a
 * policy of their own, the answer carries the renewal engine's verdict on *that
 * policy* — its status line and next action, already reviewed copy from M3. That
 * is the one place a specific fact enters, and it enters from the customer's own
 * record rather than from anything this service knows about insurance.
 *
 * Scoped like the rest of the consumer flow: no method takes a user id, the
 * policy lookup is built from the verified session, and somebody else's policy
 * reads as absent.
 */
import prisma from "../config/db";
import { CONSUMER } from "../config/constants";
import { assessRenewal } from "../consumer/renewalStatus";
import { matchQuestion, relatedTopics, MAX_QUESTION_LENGTH } from "../consumer/kural/match";
import { KURAL_ENTRIES, kuralEntry, type KuralTopic } from "../consumer/kural/topics";
import {
  GUIDANCE_DISCLAIMER,
  KURAL_INTRO,
  KURAL_NO_MATCH,
  KURAL_UNREADABLE,
  localise,
  resolveKuralCopy,
  resolveRenewalCopy,
  type ConsumerLocale,
} from "../consumer/messages";
import { auditService } from "./audit.service";
import { localeFor, type ConsumerActor } from "./consumerPolicy.service";

/** Why an answer is what it is. Sent to the client so the UI can be honest. */
export type AnswerOutcome = "ANSWERED" | "NO_MATCH" | "UNREADABLE";

export interface KuralAnswer {
  outcome: AnswerOutcome;
  /** The topic that was answered, when one was. */
  topic: KuralTopic | null;
  /** The answer itself, already in the customer's language. */
  answer: string;
  /**
   * The renewal engine's verdict on the policy they named, when they named one
   * and asked about expiry. Never a claim about cover — only what M3 already
   * tells them on the policy's own screen.
   */
  aboutYourPolicy: { status: string; nextAction: string; expiryDate: string | null } | null;
  /** Where the answer came from, so provenance is visible rather than implied. */
  source: { kind: string; reference: string } | null;
  scopeNote: string;
  disclaimer: string;
  humanCta: string;
  /** Other topics the question brushed against, offered as "did you mean". */
  suggestions: { topic: KuralTopic; title: string }[];
  copyVersion: string;
}

/** A source, flattened to something a client can display without knowing its shape. */
function describeSource(topic: KuralTopic): { kind: string; reference: string } | null {
  const entry = kuralEntry(topic);
  if (!entry) return null;
  const source = entry.source;
  if (source.kind === "layer1") return { kind: source.kind, reference: source.file };
  if (source.kind === "aegis-copy") return { kind: source.kind, reference: source.module };
  return { kind: source.kind, reference: source.note };
}

const titlesFor = (topics: readonly KuralTopic[], locale: ConsumerLocale) =>
  topics
    .map((topic) => kuralEntry(topic))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({ topic: entry.id, title: localise(entry.title, locale) }));

export const kuralService = {
  /**
   * What the assistant can be asked, for the opening screen.
   *
   * The six topics, named. Shown before the first question rather than after a
   * failed one, because a customer who has to discover the limits by hitting
   * them has already been told the product does not work.
   */
  topics(actor: ConsumerActor, options: { locale?: string } = {}) {
    const locale = localeFor(actor, options.locale);
    return {
      intro: localise(KURAL_INTRO, locale),
      topics: KURAL_ENTRIES.map((entry) => ({
        topic: entry.id,
        title: localise(entry.title, locale),
      })),
      ...resolveKuralCopy(locale),
      disclaimer: localise(GUIDANCE_DISCLAIMER, locale),
    };
  },

  /**
   * Answer one question.
   *
   * Three outcomes and they are reported distinctly, because a screen that draws
   * "I could not read that" and "that is outside what I know" the same way
   * teaches somebody to rephrase a question that was never going to be answered.
   */
  async ask(
    actor: ConsumerActor,
    input: { question: string; policyId?: string | null },
    options: { locale?: string; now?: Date } = {}
  ): Promise<KuralAnswer> {
    const locale = localeFor(actor, options.locale);
    const copy = resolveKuralCopy(locale);
    const base = {
      ...copy,
      disclaimer: localise(GUIDANCE_DISCLAIMER, locale),
      aboutYourPolicy: null,
      source: null,
    };

    const question = typeof input.question === "string" ? input.question.trim() : "";
    if (question === "" || question.length > MAX_QUESTION_LENGTH) {
      return {
        ...base,
        outcome: "UNREADABLE",
        topic: null,
        answer: localise(KURAL_UNREADABLE, locale),
        suggestions: titlesFor(KURAL_ENTRIES.map((e) => e.id).slice(0, 3), locale),
      };
    }

    const match = matchQuestion(question);

    // Recorded without the question itself. What somebody asks about their own
    // insurance is theirs; that the assistant could not answer is ours, and the
    // second is the part worth counting.
    auditService.record({
      actorId: actor.id,
      action: match ? "consumer.kural.answered" : "consumer.kural.unanswered",
      metadata: { topic: match?.topic ?? null, score: match?.score ?? 0, locale },
    });

    if (!match) {
      return {
        ...base,
        outcome: "NO_MATCH",
        topic: null,
        answer: localise(KURAL_NO_MATCH, locale),
        // Whatever it half-recognised, offered as a question they can tap. A
        // dead end with no way forward is where somebody leaves.
        suggestions: titlesFor(
          relatedTopics(question, 2).length > 0
            ? relatedTopics(question, 2)
            : KURAL_ENTRIES.map((e) => e.id).slice(0, 3),
          locale
        ),
      };
    }

    const entry = kuralEntry(match.topic);
    const aboutYourPolicy =
      match.topic === "POLICY_EXPIRY" && input.policyId
        ? await this.expiryFor(actor, input.policyId, locale, options.now)
        : null;

    return {
      ...base,
      outcome: "ANSWERED",
      topic: match.topic,
      answer: localise(entry!.answer, locale),
      aboutYourPolicy,
      source: describeSource(match.topic),
      suggestions: titlesFor(
        relatedTopics(question, 3).filter((topic) => topic !== match.topic).slice(0, 2),
        locale
      ),
    };
  },

  /**
   * The renewal engine's verdict on one of the customer's own policies.
   *
   * Returns null rather than throwing when the policy is not theirs. A question
   * about insurance should still be answered even if the policy id attached to
   * it was wrong — refusing the whole answer over it would punish the customer
   * for a client-side mistake they cannot see.
   */
  async expiryFor(
    actor: ConsumerActor,
    policyId: string,
    locale: ConsumerLocale,
    now?: Date
  ): Promise<KuralAnswer["aboutYourPolicy"]> {
    const policy = await prisma.heldPolicy.findFirst({
      where: { id: policyId, profile: { userId: actor.id }, domain: "motor", deletedAt: null },
      select: { renewalDate: true },
    });
    if (!policy) return null;

    const renewal = assessRenewal(policy.renewalDate, {
      timeZone: CONSUMER.TIMEZONE,
      ...(now ? { now } : {}),
    });
    const resolved = resolveRenewalCopy(renewal.messageKey, renewal.nextActionKey, locale);

    return {
      status: resolved.status,
      nextAction: resolved.nextAction,
      expiryDate: policy.renewalDate ? policy.renewalDate.toISOString().slice(0, 10) : null,
    };
  },
};
