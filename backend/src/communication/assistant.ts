/**
 * The Communication Assistant.
 *
 * Summarises, drafts, triages. **Never sends.**
 *
 * That is not a limitation to be lifted later — it is the design. A draft is
 * stored as a SUGGESTION message and stays in the thread until a person decides
 * to send it. The moment an assistant can send under somebody's name, a
 * customer can no longer trust that a message signed by their advisor was
 * written by their advisor, and that is the only thing a communication platform
 * in insurance really sells.
 *
 * Triage is the exception that proves it: deciding a message *looks* urgent is
 * safe to automate, because the consequence is that a human looks sooner.
 */
import prisma from "../config/db";
import type { AssistantResult, CommunicationAssistant, Priority } from "./contracts";

/**
 * Words that mark a message as needing attention now.
 *
 * Deliberately a short, readable list rather than a model. Triage decides who
 * gets looked at first, and a rule an advisor can read and argue with is better
 * there than a score they cannot — particularly when being wrong means somebody
 * with an urgent problem waits.
 */
const URGENT_MARKERS = [
  "accident",
  "emergency",
  "hospital",
  "admitted",
  "icu",
  "death",
  "died",
  "passed away",
  "stolen",
  "theft",
  "fire",
  "flood",
  "urgent",
  "immediately",
  "deadline",
  "expiring today",
  "lapsed",
  "denied",
  "rejected",
  "complaint",
  "ombudsman",
  "legal",
  "police",
];

const FRUSTRATION_MARKERS = [
  "unacceptable",
  "ridiculous",
  "third time",
  "again and again",
  "no response",
  "nobody",
  "still waiting",
  "escalate",
];

const unavailable = <T>(reason: string, needs: string): AssistantResult<T> => ({
  available: false,
  data: null,
  reason,
  needs,
});

/**
 * The assistant as it stands: deterministic triage, extractive summary, and no
 * drafting at all.
 *
 * Drafting and translation return unavailable rather than a template. A
 * templated "Dear customer, thank you for your message" is not a draft — it is
 * something an advisor deletes, and offering it wastes the time the feature
 * exists to save. Wiring these to the LLM layer in `ai-python/` is the natural
 * next step and requires sign-off, because that is protected code.
 */
export class DeterministicAssistant implements CommunicationAssistant {
  readonly available = true;

  /**
   * An extractive summary — real sentences from the thread, never invented.
   *
   * Extractive rather than abstractive on purpose. A generated summary of an
   * insurance conversation can subtly restate a customer's position, and the
   * restatement is what the next advisor reads. Quoting cannot.
   */
  async summarise(conversationId: string): Promise<AssistantResult<{ summary: string; points: string[] }>> {
    const messages = await prisma.message.findMany({
      where: { conversationId, deletedAt: null, kind: { not: "SUGGESTION" } },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { body: true, senderKind: true, internal: true, createdAt: true },
    });

    if (messages.length === 0) {
      return unavailable(
        "There is nothing in this conversation yet.",
        "At least one message."
      );
    }

    const first = messages[0];
    const last = messages[messages.length - 1];
    const customerMessages = messages.filter((m) => m.senderKind === "USER" && !m.internal);

    // The sentences that carry a question or an urgent marker — the ones an
    // advisor picking this up needs to have read.
    const points: string[] = [];
    for (const message of customerMessages) {
      for (const sentence of message.body.split(/(?<=[.?!])\s+/)) {
        const trimmed = sentence.trim();
        if (trimmed.length < 12 || trimmed.length > 220) continue;
        const lower = trimmed.toLowerCase();
        if (trimmed.includes("?") || URGENT_MARKERS.some((m) => lower.includes(m))) {
          points.push(trimmed);
        }
        if (points.length >= 6) break;
      }
      if (points.length >= 6) break;
    }

    const days = Math.max(
      0,
      Math.round(((last?.createdAt.getTime() ?? 0) - (first?.createdAt.getTime() ?? 0)) / 86_400_000)
    );

    return {
      available: true,
      data: {
        summary: `${messages.length} messages${days > 0 ? ` over ${days} day${days === 1 ? "" : "s"}` : " today"}, ${customerMessages.length} from the customer. ${points.length > 0 ? "The open questions are quoted below." : "No unanswered questions were found."}`,
        // Quoted, so nothing here is the assistant's words.
        points,
      },
    };
  }

  /**
   * Drafting is not connected, and does not pretend to be.
   */
  async draftReply(): Promise<AssistantResult<{ draft: string }>> {
    return unavailable(
      "Reply drafting is not connected to a language model.",
      "An implementation of CommunicationAssistant backed by the LLM layer in ai-python/, which is protected code and needs sign-off. A canned template is deliberately not offered — it is something an advisor deletes."
    );
  }

  /**
   * How urgent this thread looks, and why.
   *
   * Safe to automate because being wrong means a person looks sooner than
   * necessary. The reasoning is always returned, so an advisor can disagree
   * with it rather than being ranked by something invisible.
   */
  async triage(conversationId: string): Promise<AssistantResult<{ urgency: Priority; why: string }>> {
    const messages = await prisma.message.findMany({
      where: { conversationId, deletedAt: null, internal: false, senderKind: "USER" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { body: true, createdAt: true, senderId: true },
    });

    if (messages.length === 0) {
      return unavailable("There is nothing from the customer to assess.", "At least one message from the customer.");
    }

    const text = messages.map((m) => m.body.toLowerCase()).join(" ");
    const urgentHits = URGENT_MARKERS.filter((m) => text.includes(m));
    const frustrationHits = FRUSTRATION_MARKERS.filter((m) => text.includes(m));

    // A thread with no staff reply for days is urgent regardless of wording.
    // The quiet ones are the complaints that become ombudsman referrals.
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { lastMessageAt: true },
    });
    const lastCustomer = messages[0]?.createdAt ?? new Date();
    const staleDays = Math.floor((Date.now() - lastCustomer.getTime()) / 86_400_000);
    const awaitingReply = conversation?.lastMessageAt.getTime() === lastCustomer.getTime();

    let urgency: Priority = "NORMAL";
    const reasons: string[] = [];

    if (urgentHits.length > 0) {
      urgency = "URGENT";
      reasons.push(`mentions ${urgentHits.slice(0, 3).join(", ")}`);
    }
    if (frustrationHits.length > 0) {
      urgency = urgency === "URGENT" ? "URGENT" : "HIGH";
      reasons.push("the customer sounds frustrated");
    }
    if (awaitingReply && staleDays >= 2) {
      urgency = urgency === "URGENT" ? "URGENT" : "HIGH";
      reasons.push(`waiting ${staleDays} days for a reply`);
    }
    if (reasons.length === 0) reasons.push("nothing in the wording or timing stands out");

    return {
      available: true,
      data: {
        urgency,
        why: `Flagged ${urgency.toLowerCase()} because ${reasons.join("; ")}.`,
      },
    };
  }

  async translate(): Promise<AssistantResult<{ text: string }>> {
    return unavailable(
      "Translation is not connected.",
      "A translation provider, or the multilingual LLM path in ai-python/. The platform serves Tamil, Thanglish and English speakers, so this is worth doing properly rather than with a word list."
    );
  }
}

let assistantImpl: CommunicationAssistant = new DeterministicAssistant();

export const assistant = (): CommunicationAssistant => assistantImpl;

export function registerAssistant(next: CommunicationAssistant): void {
  assistantImpl = next;
}

export function resetAssistant(): void {
  assistantImpl = new DeterministicAssistant();
}
