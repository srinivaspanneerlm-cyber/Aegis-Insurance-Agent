import type { Readable } from "stream";
import { chatRepository } from "../repositories";
import env from "../config/env";
import { createHttpClient } from "../utils/httpClient";
import { AI_CLIENT, HISTORY } from "../config/constants";
import { logger } from "../config/logger";

// Shared secret sent on every backend -> AI microservice call. When set, the
// AI service rejects requests that do not present a matching key.
const internalHeaders: Record<string, string> = env.AI_INTERNAL_API_KEY
  ? { "X-Internal-Api-Key": env.AI_INTERNAL_API_KEY }
  : {};

// Propagate the request correlation id downstream so a chat request can be
// traced across the backend and the AI engine's logs.
const headersFor = (requestId?: string): Record<string, string> =>
  requestId ? { ...internalHeaders, "X-Request-Id": requestId } : internalHeaders;

// Dedicated client with a centralised timeout. Retries are intentionally 0: the
// AI dispatch is non-idempotent (it mutates conversation memory), so a retry
// could double-process. Transient failures fall through to the resilient
// fallback reply below instead.
const aiHttp = createHttpClient({ timeout: AI_CLIENT.TIMEOUT_MS, retries: 0 });

// Separate client for the SSE path. No timeout: an advisor stream is long-lived
// by design and a request timer would sever it mid-answer. The stream ends when
// the AI service finishes or the browser disconnects (see `signal`).
const aiStreamHttp = createHttpClient({ timeout: 0, retries: 0 });

interface HistoryItem {
  sender: string;
  message: string;
}

interface AIResponse {
  reply: string;
  agent_name: string | null;
  agent_domain: string | null;
  transferred: boolean;
  transfer_from: string | null;
  transfer_to: string | null;
  transfer_to_name: string | null;
  session_id: string | null;
}

/**
 * Aegis AI — Multi-Agent Service Bridge
 * Routes chat messages through the Python CentralOrchestrator and returns
 * the full agent response including metadata (agent_name, transferred, etc.)
 */
const getResponseFromAIService = async (
  userMessage: string,
  userName = "Sri",
  productType: string | null = null,
  sessionId: string | null = null,
  userId: string | null = null,
  requestId?: string
): Promise<AIResponse> => {
  const aiServiceUrl = env.AI_SERVICE_URL;

  // Fetch recent conversation history for context. Scope strictly to the
  // authenticated user so one customer's messages can never leak into another
  // customer's AI prompt (cross-tenant data isolation). Without a userId we
  // send no history rather than a global feed.
  let history: HistoryItem[] = [];
  try {
    const recentChats = userId
      ? await chatRepository.findRecentByUser(userId, HISTORY.AI_CONTEXT_TURNS)
      : [];
    recentChats.reverse();
    history = recentChats.map((c) => ({
      sender: c.sender,
      message: c.message,
    }));
  } catch (err) {
    logger.error({ requestId, err }, "[AI Service] history fetch failed");
  }

  try {
    const payload = {
      message: userMessage,
      history,
      user_name: userName,
      // The AI engine keys conversation memory, profile answers and cached
      // recommendations on this. Without it, two customers who share a
      // display name share those too — user_id is what actually tells them
      // apart.
      user_id: userId || undefined,
      product_type: productType || undefined,
      session_id: sessionId || undefined,
    };

    const response = await aiHttp.post(aiServiceUrl, payload, {
      headers: headersFor(requestId),
    });
    const data = response.data;

    // Return full orchestrator response including agent metadata
    return {
      reply: data.reply || "",
      agent_name: data.agent_name || null,
      agent_domain: data.agent_domain || null,
      transferred: data.transferred || false,
      transfer_from: data.transfer_from || null,
      transfer_to: data.transfer_to || null,
      transfer_to_name: data.transfer_to_name || null,
      session_id: data.session_id || sessionId || null,
    };
  } catch (err) {
    logger.warn(
      { requestId, err: (err as Error).message },
      "[AI Service] engine unavailable — using resilient fallback"
    );
    const reply = _buildFallbackReply(userMessage, userName, productType, history);
    return {
      reply,
      agent_name: _detectFallbackAgent(userMessage, history, productType),
      agent_domain: _detectFallbackDomain(userMessage, history, productType),
      transferred: false,
      transfer_from: null,
      transfer_to: null,
      transfer_to_name: null,
      session_id: sessionId,
    };
  }
};

// ── Fallback helpers ──────────────────────────────────────────────────────────

// Match any keyword as a whole word. Plain substring matching let a short
// keyword fire from inside an unrelated word — "care"/"cardiac" contain "car"
// and routed a health customer to motor. Anchoring with \b matches the keyword
// only as its own word. Mirrors the intent engine's word-boundary lexicon.
function _hasKeyword(text: string, words: string[]): boolean {
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i").test(text);
}

function _detectFallbackDomain(
  message: string,
  history: HistoryItem[],
  productType?: string | null
): string {
  if (productType) return productType;
  const allText = [message, ...history.map((h) => h.message)].join(" ").toLowerCase();
  if (_hasKeyword(allText, ["car", "bike", "vehicle", "motor", "creta", "enfield"])) return "motor";
  if (_hasKeyword(allText, ["travel", "trip", "flight", "international", "abroad"])) return "travel";
  if (_hasKeyword(allText, ["home", "house", "property", "apartment", "tenant"])) return "home-property";
  return "health";
}

function _detectFallbackAgent(
  message: string,
  history: HistoryItem[],
  productType?: string | null
): string {
  const domain = _detectFallbackDomain(message, history, productType);
  const map: Record<string, string> = { health: "Sarah AI", motor: "Alex AI", travel: "Ethan AI", "home-property": "Emma AI" };
  return map[domain] || "Sarah AI";
}

interface FallbackPlan {
  planName: string;
  category: string;
  [key: string]: unknown;
}

function _buildFallbackReply(
  userMessage: string,
  userName: string,
  productType: string | null,
  history: HistoryItem[]
): string {
  const allText = [userMessage, ...history.map((h) => h.message)].join(" ").toLowerCase();

  const category = _detectFallbackDomain(userMessage, history, productType);

  const hasFamily = ["spouse", "wife", "husband", "child", "kid", "family", "myself", "members"].some((w) =>
    allText.includes(w)
  );
  const hasBudget =
    ["budget", "₹", "month", "premium", "rs", "rupee", "/mo"].some((w) => allText.includes(w)) ||
    /\d{3,}/.test(allText);
  const forceReveal = ["recommend", "suggest", "show plan", "quote", "reveal", "give me"].some((w) =>
    userMessage.toLowerCase().includes(w)
  );

  if ((hasFamily && hasBudget) || forceReveal) {
    const plans: Record<string, FallbackPlan> = {
      motor: {
        planName: "Aegis Bumper-to-Bumper Shield",
        category: "motor",
        coverage: "₹10,00,000",
        premium: "₹2,500/month",
        benefits: ["Zero Depreciation Cover", "Engine Protection", "24/7 Roadside Assistance", "Cashless Garages"],
        claimSettlementRatio: "98.9%",
        riskLevel: "Low Risk",
        score: 96,
        confidenceScore: 0.96,
        executiveApproval: "Approved",
        executiveNotes: "Underwritten by Alex AI. Safe Driver discount applied. Signed: Chief Risk Officer.",
        hospitalNetwork: "4,500+ Cashless Garage Networks",
        premiumBreakdown: "Base Premium: ₹2,125, GST (18%): ₹375",
        idvValue: "₹8,50,000",
        zeroDep: "Zero Depreciation Cover included",
        roadsideAssistance: "24/7 Roadside Assistance included",
        engineProtection: "Engine Protection included",
        alternativePlan: {
          planName: "Aegis Value Drive Cover",
          category: "motor",
          coverage: "₹5,00,000",
          premium: "₹1,200/month",
          benefits: ["Standard OD Cover", "Third Party Shield", "Cashless Garages"],
          claimSettlementRatio: "98.4%",
          riskLevel: "Low Risk",
          score: 85,
          confidenceScore: 0.9,
          executiveApproval: "Approved",
          premiumBreakdown: "Base Premium: ₹1,020, GST: ₹180",
        },
      },
      travel: {
        planName: "Aegis GlobeTrotter Elite",
        category: "travel",
        coverage: "₹35,00,000",
        premium: "₹1,500/month",
        benefits: ["Emergency Medical Evacuation", "Trip Cancellation", "Baggage Loss", "Adventure Sports Cover"],
        claimSettlementRatio: "98.8%",
        riskLevel: "Low Risk",
        score: 98,
        confidenceScore: 0.98,
        executiveApproval: "Approved",
        executiveNotes: "Underwritten by Ethan AI. Global mobility parameters verified.",
        hospitalNetwork: "10,000+ Global Partner Hospitals",
        premiumBreakdown: "Base Premium: ₹1,275, GST (18%): ₹225",
        medicalCoverage: "$100,000",
        tripCancellation: "$2,500",
        baggageLoss: "$1,000",
        emergencyEvacuation: "$50,000",
        alternativePlan: {
          planName: "Aegis Standard Voyage Guard",
          category: "travel",
          coverage: "₹10,00,000",
          premium: "₹700/month",
          benefits: ["Emergency Medical Cap", "Trip Interruption Safeguard"],
          claimSettlementRatio: "98.4%",
          score: 82,
          confidenceScore: 0.88,
          executiveApproval: "Approved",
          premiumBreakdown: "Base Premium: ₹595, GST: ₹105",
        },
      },
      "home-property": {
        planName: "Aegis SafeHaven Platinum",
        category: "home-property",
        coverage: "₹50,00,000",
        premium: "₹4,000/month",
        benefits: ["Complete Structure Cover", "Contents Protection", "Natural Calamity", "Relocation Allowance"],
        claimSettlementRatio: "99.2%",
        riskLevel: "Low Risk",
        score: 94,
        confidenceScore: 0.95,
        executiveApproval: "Approved",
        executiveNotes: "Underwritten by Emma AI. Calamity protection indices checked.",
        hospitalNetwork: "600+ Panel Engineers & Surveyors",
        premiumBreakdown: "Base Premium: ₹3,400, GST (18%): ₹600",
        propertyCoverage: "₹50,00,000",
        fireProtection: "100% replacement value cover",
        naturalDisasterCover: "Earthquake and Flood shield",
        theftCover: "Burglary & Theft protection",
        structureCover: "₹80 Lakhs",
        contentsCover: "₹20 Lakhs",
        alternativePlan: {
          planName: "Aegis Brick-and-Mortar Shield",
          category: "home-property",
          coverage: "₹25,00,000",
          premium: "₹2,000/month",
          benefits: ["Structure Cover", "Fire & Burglary Protection"],
          claimSettlementRatio: "98.4%",
          score: 80,
          confidenceScore: 0.86,
          executiveApproval: "Approved",
          premiumBreakdown: "Base Premium: ₹1,700, GST: ₹300",
        },
      },
      health: {
        planName: "Aegis Supreme Health Shield",
        category: "health",
        coverage: "₹1 Crore Cover",
        premium: "₹850/month",
        benefits: ["Cashless Hospitalization", "Zero Co-Pay", "Pre-existing Cover from Day 1", "No Room Rent Sublimit"],
        claimSettlementRatio: "99.1%",
        riskLevel: "Low Risk",
        score: 98,
        confidenceScore: 0.98,
        executiveApproval: "Approved",
        executiveNotes: "Underwritten by Sarah AI. Chief Risk Officer approved.",
        hospitalNetwork: "12,000+ Empanelled Cashless Care Centers",
        premiumBreakdown: "Base Premium: ₹720, GST (18%): ₹130",
        waitingPeriod: "12 months for pre-existing diseases, 30 days initial.",
        alternativePlan: {
          planName: "Aegis Care Silver Floater",
          category: "health",
          coverage: "₹8 Lakh Cover",
          premium: "₹1,800/month",
          benefits: ["Day Care Procedures", "Cashless Hospitalization", "Restore Benefit"],
          claimSettlementRatio: "98.4%",
          score: 85,
          confidenceScore: 0.92,
          executiveApproval: "Approved",
          premiumBreakdown: "Base Premium: ₹1,600, GST: ₹200",
        },
      },
    };

    const plan = plans[category] || plans.health;

    // Deliberately no [RECOMMENDATION:...] card here, and no claim-settlement
    // ratio, score or "I've locked this in".
    //
    // This branch runs only when the AI engine could not be reached, so nothing
    // has been scored against this customer's profile — the plan below is a
    // popular product for the category, not a recommendation. Emitting the card
    // rendered it on screen identically to a real engine result, complete with
    // a confidence score, and the customer had no way to tell that the advisor
    // was down. Somebody choosing cover during an outage deserves to know they
    // are looking at a general suggestion.
    const commonlyChosen: Record<string, string> = {
      motor: `our vehicle cover, **${plan.planName}**`,
      travel: `our travel cover, **${plan.planName}**`,
      "home-property": `our home cover, **${plan.planName}**`,
      health: `our health cover, **${plan.planName}**`,
    };
    const suggestion = commonlyChosen[category] || commonlyChosen.health;

    return (
      `I can't reach the advisor just now, ${userName}, so I can't look at your ` +
      `details properly yet — please try again in a moment.\n\n` +
      `In the meantime, a plan many families start with is ${suggestion}. ` +
      `That is a general suggestion, not advice for your situation. Once the ` +
      `advisor is back it will go through your details and show you the plans ` +
      `that actually fit.`
    );
  }

  // Still offline, but nothing has been claimed yet — so this can simply say so
  // and collect the details the advisor will need when it returns. No figures
  // are quoted here, which is why these lines are safe to keep as they are.
  const introMessages: Record<string, string> = {
    motor: `I can't reach the advisor just now, ${userName} — please try again in a moment. Meanwhile, what vehicle are we covering: make, model and year?`,
    travel: `I can't reach the advisor just now, ${userName} — please try again in a moment. Meanwhile, where are you travelling, and roughly when?`,
    "home-property": `I can't reach the advisor just now, ${userName} — please try again in a moment. Meanwhile, do you own or rent, and is it a flat or an independent house?`,
    health: `I can't reach the advisor just now, ${userName} — please try again in a moment. Meanwhile, who are we covering, and roughly what ages?`,
  };

  return introMessages[category] || introMessages.health;
}

/**
 * How the customer spoke a turn, when they spoke it.
 *
 * Present only on a voice turn and read by the engine for one purpose: which
 * block of phrasing guidance to append to the prompt. It reaches no
 * recommendation, no premium and no eligibility rule. Passed through rather
 * than interpreted here — this file is a transport, and the engine validates it
 * against a known set on arrival, falling back to `normal` for anything else.
 */
// Not re-exported: this file uses `export =`, and mixing a named export into
// that produces a module tsx cannot load. Callers pass the block through
// untyped — it is a transport, and the engine is what validates it.
interface VoiceTurnMeta {
  /** normal | confused | frustrated | urgent | brief — a description of the wording. */
  style?: string;
  /** What the transcription heard: 'en-IN', 'ta-IN', 'ta-en'. Metadata only. */
  language?: string;
  spoken?: boolean;
}

interface OpenAIStreamParams {
  message: string;
  history?: unknown[];
  userName: string;
  userId?: string | null;
  productType?: string | null;
  sessionId?: string;
  forceTransferTo?: string | null;
  declinedDomains?: string[];
  voice?: VoiceTurnMeta | null;
  signal?: AbortSignal;
  requestId?: string;
}

/** The styles the engine recognises. Anything else is dropped rather than forwarded. */
const VOICE_STYLES = new Set(["normal", "confused", "frustrated", "urgent", "brief"]);

/**
 * The voice block, reduced to fields we recognise, or null.
 *
 * Bounded here as well as at the engine because this is where browser-supplied
 * data crosses a trust boundary, and because a value that ends up near a prompt
 * should be narrowed by every hop that touches it, not just the last one.
 */
const sanitiseVoice = (voice: VoiceTurnMeta | null | undefined): VoiceTurnMeta | null => {
  if (!voice || typeof voice !== "object") return null;
  if (voice.spoken === false) return null;

  const style = typeof voice.style === "string" ? voice.style.toLowerCase() : "";
  const language = typeof voice.language === "string" ? voice.language.slice(0, 16) : undefined;

  return {
    style: VOICE_STYLES.has(style) ? style : "normal",
    ...(language ? { language } : {}),
    spoken: true,
  };
};

/**
 * Open the AI engine's SSE stream on behalf of an authenticated customer.
 *
 * The browser used to call the AI service directly, which meant the engine had
 * no way to tell who was asking: it took `user_name` from the request body and
 * resolved that straight to a customer's profile and conversation memory. Any
 * caller could name any customer. Routing through here closes that — `userName`
 * is supplied by the caller in this process from the verified session, never
 * from the request body, and the shared key means the engine can stop accepting
 * requests from anywhere else.
 *
 * Returns the raw upstream stream for the caller to pipe; SSE framing is the
 * AI service's, and passing it through unparsed keeps this a transport.
 */
const openAIStream = ({
  message,
  history = [],
  userName,
  userId = null,
  productType = null,
  sessionId = "",
  forceTransferTo = null,
  declinedDomains = [],
  voice = null,
  signal,
  requestId,
}: OpenAIStreamParams): Promise<Readable> =>
  aiStreamHttp
    .post(
      `${env.AI_SERVICE_URL}/chat/stream`,
      {
        message,
        history,
        user_name: userName,
        user_id: userId,
        product_type: productType,
        session_id: sessionId,
        force_transfer_to: forceTransferTo,
        declined_domains: declinedDomains,
        voice: sanitiseVoice(voice),
      },
      { headers: headersFor(requestId), responseType: "stream", signal }
    )
    .then((response) => response.data as Readable);

// Exported as a plain object (not ESM named exports) so the surface stays a
// mutable data property — `node:test`'s mock.method can only stub data
// properties, and tsx compiles ESM named exports to non-configurable getters.
export = {
  getResponseFromAIService,
  openAIStream,
  // Exported for unit testing of the voice-metadata narrowing.
  _sanitiseVoice: sanitiseVoice,
  // Exported for unit testing of the offline fallback routing.
  _detectFallbackDomain,
  _detectFallbackAgent,
};
