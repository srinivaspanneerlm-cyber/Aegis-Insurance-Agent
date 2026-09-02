import axios, { AxiosProgressEvent } from "axios";
import { API_URL } from "@/lib/config";
import type { Lead, DocumentRecord, PolicyRecord, PageInfo } from "@/types/domain";
import type { IntelligenceReport } from "@aegis/intelligence";

declare module "axios" {
  export interface AxiosRequestConfig {
    /**
     * Marks a request that *asks* whether a session exists rather than assuming
     * one. A 401 is a valid answer to that question — not an expired session —
     * so it must not trip the global sign-out in the interceptor below.
     */
    isSessionProbe?: boolean;
    /**
     * Marks the renewal call itself, so it can neither trigger a renewal of its
     * own nor sign the customer out. Only the request that provoked it decides
     * that.
     */
    isRefreshCall?: boolean;
    /** Set once a request has been replayed after a renewal, so it is tried once and not in a loop. */
    wasRetriedAfterRefresh?: boolean;
  }
}

// 1) Axios base configuration
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  // Send the httpOnly auth cookie with every request. The JWT is no longer
  // stored in localStorage (which was readable by any injected script / XSS).
  withCredentials: true,
});

/**
 * The renewal in flight, if any.
 *
 * Every request that was in the air when the access token expired comes back
 * 401 at once. Without this they would each start their own renewal, and
 * because renewal *rotates* the refresh token, the first to land invalidates
 * the rest — a burst of parallel requests would sign the customer out instead
 * of keeping them in. They all wait on the same promise.
 */
let renewal: Promise<void> | null = null;

function renewSession(): Promise<void> {
  if (!renewal) {
    renewal = apiClient
      .post("/auth/refresh", undefined, { isRefreshCall: true })
      .then(() => undefined)
      .finally(() => {
        renewal = null;
      });
  }
  return renewal;
}

/**
 * The action needs the account holder to confirm themselves first.
 *
 * A distinct type rather than a flag on a generic error, so a caller has to
 * decide what to do about it. Swallowing this into the ordinary error path is
 * how a confirmation prompt silently becomes a failure message.
 */
export class ReauthRequiredError extends Error {
  readonly reauthRequired = true;
  constructor(message: string) {
    super(message);
    this.name = "ReauthRequiredError";
  }
}

// 2) Response interceptor — renew silently on 401, and only give up if that fails.
apiClient.interceptors.response.use(
  (response) => {
    // A proxy, gateway or hotel wifi portal can answer a JSON request with an
    // HTML page and a 200. axios reports that as success, the caller reads
    // fields off a string, every one of them is undefined, and the screen shows
    // nothing at all — the customer presses the button and no message ever
    // arrives. A body that claims to be JSON and is not is a failure, so say so.
    const contentType = String(response.headers?.["content-type"] ?? "");
    if (contentType.includes("json") && typeof response.data === "string") {
      return Promise.reject(
        new Error("We couldn't read the reply from Aegis. Please try again.")
      );
    }
    return response;
  },
  async (error) => {
    const config = error.config ?? {};
    const status = error.response ? error.response.status : null;
    const message = error.response?.data?.message || "An unexpected error occurred.";

    // "Confirm it's you" and "your session is over" are both 401s and look
    // identical from here. Told apart by the code, because renewing the session
    // would not help — the session is fine — and signing the customer out for
    // it would end their work at the exact moment they were being careful.
    if (status === 401 && error.response?.data?.code === "REAUTH_REQUIRED") {
      return Promise.reject(new ReauthRequiredError(message));
    }

    // An expired access token is the ordinary state of a long session, not a
    // reason to interrupt the customer. Trade the refresh cookie for a new one
    // and replay the request; they never learn it happened. Once per request —
    // a second 401 after a successful renewal means the answer really is no.
    if (status === 401 && !config.isRefreshCall && !config.wasRetriedAfterRefresh) {
      let renewed = false;
      try {
        await renewSession();
        renewed = true;
      } catch {
        // The refresh token is gone, expired or already used. Fall through and
        // treat this as the end of the session.
      }

      if (renewed) {
        config.wasRetriedAfterRefresh = true;
        // Deliberately not caught: if the replay fails it re-enters this
        // interceptor, where the flag above stops another round.
        return apiClient.request(config);
      }
    }

    // The session is genuinely over: say so once and let AuthContext decide
    // where the customer goes. Two callers are exempt. The probe — the
    // boot-time "who am I?" — 401s for every signed-out visitor, and firing
    // this for them would bounce anyone reading the public pages to /login. The
    // renewal call is exempt so the request that provoked it reports the loss,
    // once, instead of both of them reporting it.
    if (status === 401 && !config.isSessionProbe && !config.isRefreshCall) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("aegis_auth_error"));
      }
    }
    return Promise.reject(new Error(message));
  }
);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authService = {
  register: async (payload: Record<string, unknown>) => {
    const res = await apiClient.post("/auth/register", payload);
    return res.data;
  },
  login: async (payload: Record<string, unknown>) => {
    const res = await apiClient.post("/auth/login", payload);
    return res.data;
  },
  googleLogin: async (credential: string) => {
    const res = await apiClient.post("/auth/google", { credential });
    return res.data;
  },
  logout: async () => {
    const res = await apiClient.post("/auth/logout");
    return res.data;
  },
  // The session probe: called on every mount to establish whether anyone is
  // signed in. Signed out is an ordinary outcome, so it opts out of the
  // interceptor's redirect — but not out of renewal, which is what lets a
  // customer returning after their access token expired land straight on the
  // dashboard instead of on a sign-in screen.
  getMe: async () => {
    const res = await apiClient.get("/auth/me", { isSessionProbe: true });
    return res.data.data;
  },
  /**
   * Re-confirm the account holder before an irreversible action. Either a
   * password or a provider credential — an account created through Google was
   * never told a password, and demanding one would bar it from these actions
   * entirely. The proof is set as an httpOnly cookie; nothing to store here.
   */
  stepUp: async (proof: { password?: string; provider?: string; credential?: string }) => {
    const res = await apiClient.post("/auth/step-up", proof);
    return res.data.data;
  },
  completeOnboarding: async (payload: {
    preferredLanguage: string;
    insuranceInterests: string[];
  }) => {
    const res = await apiClient.patch("/auth/me/onboarding", payload);
    return res.data.data;
  },
};

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------
export const policyService = {
  // Server-side paginated (see leadService.getLeads). Params optional so a
  // caller wanting the whole bounded catalogue can omit them.
  getPolicies: async (
    params: { page?: number; limit?: number } = {}
  ): Promise<{ policies: PolicyRecord[]; pagination: PageInfo }> => {
    const res = await apiClient.get("/policies", { params });
    return { policies: res.data.data.policies, pagination: res.data.pagination };
  },
  getPolicyById: async (id: string) => {
    const res = await apiClient.get(`/policies/${id}`);
    return res.data.data.policy;
  },
};

// ---------------------------------------------------------------------------
// Insurance intelligence
// ---------------------------------------------------------------------------

/**
 * The customer's own protection analysis.
 *
 * One call rather than several: every part of the report is derived from the
 * same profile snapshot, so fetching the pieces separately would let the screen
 * show a recommendation built from one version of the facts beside a risk
 * summary built from another.
 *
 * The endpoint scopes itself to the caller — there is no user id to pass, and
 * no way for this client to ask for somebody else's.
 */
export const intelligenceService = {
  getReport: async (): Promise<IntelligenceReport> => {
    const res = await apiClient.get("/intelligence/report");
    return res.data.data;
  },

  /**
   * The customer's own documents, from the Sprint 8 platform.
   *
   * Scoped to the caller by the server — there is no owner id to pass. Carries
   * the verification status and, on a rejection, the reason, which is the part
   * a customer most needs and the part a file list alone cannot show.
   */
  getDocuments: async (): Promise<{ documents: CustomerDocument[] }> => {
    const res = await apiClient.get("/documents");
    return { documents: res.data.data.documents };
  },

  /**
   * The customer's own activity, including their claims.
   *
   * There is no customer-facing claims endpoint: cases live as work items, and
   * the Sprint 11 timeline is the surface that serves them to the person they
   * concern. Self-readable by design — `authorise` lets somebody read their own
   * without any permission at all.
   */
  getTimeline: async (): Promise<{ entries: TimelineEntry[] }> => {
    const res = await apiClient.get("/communication/timeline");
    return { entries: res.data.data.entries };
  },

  /**
   * The customer's notifications, from the Sprint 10 platform.
   *
   * Scoped to the caller by the server. Carries category, priority and the deep
   * link, so a notification can be acted on rather than only read.
   */
  getNotifications: async (): Promise<{ notifications: CustomerNotification[] }> => {
    const res = await apiClient.get("/communication/notifications");
    return { notifications: res.data.data.notifications };
  },

  /** Marks notifications read. Scoped by the server to the caller's own. */
  markNotificationsRead: async (ids: string[]): Promise<{ updated: number }> => {
    const res = await apiClient.post("/communication/notifications/read", { ids });
    return res.data.data;
  },

  /**
   * How the customer wants to be contacted.
   *
   * The payload reports which channels are actually available and why not,
   * which the UI must pass on rather than smooth over: somebody who switches on
   * SMS and hears nothing has been told a lie by the interface.
   */
  getPreferences: async (): Promise<NotificationPreferences> => {
    const res = await apiClient.get("/communication/preferences");
    return res.data.data;
  },

  savePreferences: async (input: Partial<NotificationPreferences>): Promise<NotificationPreferences> => {
    const res = await apiClient.put("/communication/preferences", input);
    return res.data.data;
  },

  /** The insurance profile the analysis is built from. */
  getProfile: async (): Promise<InsuranceProfileResponse> => {
    const res = await apiClient.get("/intelligence/profile");
    return res.data.data;
  },

  /**
   * Saves the profile.
   *
   * A partial update: the server merges rather than replaces, so a form that
   * submits three fields does not erase the other ten. That behaviour lives in
   * the backend and is not re-implemented here.
   */
  saveProfile: async (input: Record<string, unknown>): Promise<InsuranceProfileResponse> => {
    const res = await apiClient.put("/intelligence/profile", input);
    return res.data.data;
  },
};

/**
 * A policy the customer already holds — here or with another insurer.
 *
 * Distinct from the `Policy` catalogue, which is a product somebody could buy.
 * Cover held elsewhere still counts as cover, and it is what stops the platform
 * recommending health insurance to a customer who already has it.
 */
export interface NotificationPreferences {
  exists?: boolean;
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  reminderFrequency: string;
  language: string;
  mutedCategories: string[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  /** Per channel: whether it works, and what is missing when it does not. */
  channels: { channel: string; available: boolean; reason?: string }[];
}

export interface CustomerNotification {
  id: string;
  category: string;
  title: string;
  body: string | null;
  priority: string;
  status: "UNREAD" | "READ" | "ARCHIVED";
  deepLink: string | null;
  subjectKind: string | null;
  subjectId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface TimelineEntry {
  at: string;
  /** work | document | intelligence | message | notification */
  source: string;
  kind: string;
  summary: string;
  actorId: string | null;
  actorKind: string;
  subjectKind: string;
  subjectId: string;
  deepLink: string | null;
}

export interface CustomerDocument {
  id: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  category: string | null;
  documentKey: string | null;
  domain: string | null;
  status: string;
  uploadedAt: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
}

export interface HeldPolicy {
  id: string;
  domain: string;
  insurer: string | null;
  productName: string | null;
  policyNumber: string | null;
  sumInsured: number | null;
  premium: number | null;
  startDate: string | null;
  renewalDate: string | null;
  external: boolean;
  status: string;
  notes: string | null;
}

export interface InsuranceProfileResponse {
  exists: boolean;
  userId: string;
  completeness: number;
  profile: Record<string, unknown> | null;
  heldPolicies: HeldPolicy[];
}

// ---------------------------------------------------------------------------
// Aegis Consumer — the caller's own vehicles and motor policies
// ---------------------------------------------------------------------------

/** The renewal engine's answer, as the API sends it. */
export type RenewalAssessment =
  | {
      ok: true;
      status:
        | "ACTIVE"
        | "RENEWAL_COMING_SOON"
        | "ACTION_SOON"
        | "URGENT_RENEWAL"
        | "POLICY_MAY_BE_EXPIRED";
      daysRemaining: number;
      urgency: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      displayLabel: string;
      messageKey: string;
      nextActionKey: string;
      evaluatedOn: string;
      expiresOn: string;
      timeZone: string;
    }
  | {
      ok: false;
      reason: "MISSING_EXPIRY" | "INVALID_EXPIRY" | "UNKNOWN_TIMEZONE";
      messageKey: string;
      nextActionKey: string;
    };

/**
 * The status copy, already in the customer's language.
 *
 * Resolved by the API rather than here, so the wording of a renewal warning has
 * one source. The disclaimer travels with it — a screen cannot render a status
 * without it by simply forgetting to ask.
 */
export interface RenewalCopy {
  status: string;
  nextAction: string;
  disclaimer: string;
  copyVersion: string;
}

export interface ConsumerVehicle {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  make: string | null;
  model: string | null;
}

/** The four things Aegis can currently say about a policy — see the API's `trustStatus`. */
export type TrustState =
  | "UPLOADED"
  | "NEEDS_CONFIRMATION"
  | "CONSISTENCY_VERIFIED"
  | "VERIFICATION_REQUIRED";

export interface TrustAssessment {
  state: TrustState;
  reasonKey: string;
  actionKey: string;
  /** Whether a readable certificate is attached. Reported by the API, not derived here. */
  hasDocument: boolean;
  checks: {
    detailsComplete: boolean;
    coverTypeKnown: boolean;
    expiryInFuture: boolean;
    documentAttached: boolean;
    documentFormatAccepted: boolean;
    documentUniqueToThisPolicy: boolean;
    policyNumberUniqueToThisPolicy: boolean;
  };
}

/**
 * The trust copy, already in the customer's language.
 *
 * `scopeNote` travels with the rest for the same reason the guidance disclaimer
 * does: "Details check out" read on its own could be taken as the insurer having
 * confirmed the cover, and no screen should be able to show the badge without
 * the sentence that says what was actually checked.
 */
export interface TrustCopy {
  label: string;
  reason: string;
  action: string;
  scopeNote: string;
  copyVersion: string;
}

// ── Aegis Kural Lite ───────────────────────────────────────────────────────

export type KuralTopic =
  | "POLICY_EXPIRY"
  | "COVER_TYPES"
  | "IDV"
  | "NCB"
  | "ZERO_DEPRECIATION"
  | "RENEWAL_STEPS";

/** Why the answer is what it is. Drawn differently for each — see the panel. */
export type KuralOutcome = "ANSWERED" | "NO_MATCH" | "UNREADABLE";

export interface KuralSuggestion {
  topic: KuralTopic;
  title: string;
}

export interface KuralTopics {
  intro: string;
  topics: KuralSuggestion[];
  scopeNote: string;
  humanCta: string;
  disclaimer: string;
  copyVersion: string;
}

export interface KuralAnswer {
  outcome: KuralOutcome;
  topic: KuralTopic | null;
  /** Already in the customer's language, and never assembled in the browser. */
  answer: string;
  /**
   * The renewal engine's verdict on the policy they named, when they named one
   * and asked about expiry. Absent for every other question.
   */
  aboutYourPolicy: { status: string; nextAction: string; expiryDate: string | null } | null;
  /** Where the answer came from, so provenance can be shown rather than implied. */
  source: { kind: string; reference: string } | null;
  scopeNote: string;
  disclaimer: string;
  humanCta: string;
  suggestions: KuralSuggestion[];
  copyVersion: string;
}

// ── Help me renew ──────────────────────────────────────────────────────────

export type ContactChannel = "CALL" | "WHATSAPP" | "EMAIL";

export type RenewalRequestStatus =
  | "NEW"
  | "CONTACTED"
  | "QUOTE_REQUESTED"
  | "PARTNER_HANDOFF"
  | "CLOSED";

export interface RenewalRequest {
  id: string;
  status: RenewalRequestStatus;
  /** Already in words. The capitals are the database's business, not a screen's. */
  statusLabel: string;
  preferredChannel: ContactChannel;
  policyId: string | null;
  urgencyAtCreation: string;
  expiryAtCreation: string | null;
  createdAt: string;
  updatedAt: string;
  closedReason: string | null;
}

export interface RenewalRequestResult {
  request: RenewalRequest;
  /** True when a request was already open, so nothing new was created. */
  alreadyOpen: boolean;
  message: string;
  disclaimer: string;
}

/** A permission to make contact, live or withdrawn. */
export interface ConsentRecord {
  id: string;
  channel: ContactChannel;
  purpose: "RENEWAL_ASSISTANCE" | "RENEWAL_REMINDER";
  grantedAt: string;
  withdrawnAt: string | null;
  active: boolean;
  textVersion: string;
  policyId: string | null;
}

/** One of the caller's own policy documents. */
export interface ConsumerDocument {
  id: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  policyId: string | null;
  /** First eight characters of the SHA-256. The whole digest never leaves the API. */
  fingerprint: string | null;
}

export interface ConsumerPolicy {
  id: string;
  insurer: string | null;
  /** Last four characters only. The full number is never sent to the browser. */
  policyNumberMasked: string | null;
  policyType: "THIRD_PARTY" | "COMPREHENSIVE" | "OWN_DAMAGE" | "UNKNOWN" | null;
  startDate: string | null;
  expiryDate: string | null;
  idv: number | null;
  ncbPercent: number | null;
  verificationState: string;
  verificationNote: string | null;
  enteredVia: string;
  vehicle: ConsumerVehicle | null;
  renewal: RenewalAssessment;
  copy: RenewalCopy;
  trust: TrustAssessment;
  trustCopy: TrustCopy;
  createdAt: string;
  updatedAt: string;
}

/**
 * Every call is scoped to the signed-in customer by the server.
 *
 * There is no user id to pass and no way for this client to ask for somebody
 * else's policy — the API accepts none, which is what makes that guarantee
 * something other than a convention here.
 */
export const consumerService = {
  getPolicies: async (
    locale?: string
  ): Promise<{ policies: ConsumerPolicy[]; disclaimer: string; locale: string }> => {
    const res = await apiClient.get("/consumer/policies", {
      params: locale ? { locale } : {},
    });
    return res.data.data;
  },

  getPolicy: async (
    id: string,
    locale?: string
  ): Promise<{ policy: ConsumerPolicy; disclaimer: string; locale: string }> => {
    const res = await apiClient.get(`/consumer/policies/${id}`, {
      params: locale ? { locale } : {},
    });
    return res.data.data;
  },

  createPolicy: async (
    payload: Record<string, unknown>,
    locale?: string
  ): Promise<{ policy: ConsumerPolicy; disclaimer: string }> => {
    const res = await apiClient.post("/consumer/policies", payload, {
      params: locale ? { locale } : {},
    });
    return res.data.data;
  },

  updatePolicy: async (
    id: string,
    payload: Record<string, unknown>,
    locale?: string
  ): Promise<{ policy: ConsumerPolicy; disclaimer: string }> => {
    const res = await apiClient.patch(`/consumer/policies/${id}`, payload, {
      params: locale ? { locale } : {},
    });
    return res.data.data;
  },

  deletePolicy: async (id: string): Promise<{ deleted: boolean }> => {
    const res = await apiClient.delete(`/consumer/policies/${id}`);
    return res.data.data;
  },

  getVehicles: async (): Promise<{ vehicles: ConsumerVehicle[] }> => {
    const res = await apiClient.get("/consumer/vehicles");
    return res.data.data;
  },

  /**
   * Correct a vehicle in place.
   *
   * Separate from `updatePolicy` on purpose. Sending changed vehicle details
   * nested inside a policy update matches them by registration number, so a
   * customer fixing a typo in their plate would get a second vehicle rather than
   * a corrected one, and the original would be left behind with nothing on it.
   */
  updateVehicle: async (
    id: string,
    payload: Record<string, unknown>
  ): Promise<{ vehicle: ConsumerVehicle }> => {
    const res = await apiClient.patch(`/consumer/vehicles/${id}`, payload);
    return res.data.data;
  },

  /**
   * Attach a certificate to a policy.
   *
   * Answers with the whole policy rather than the document, because what the
   * customer is waiting to see is what changed about their policy — the trust
   * state — and a screen that had to fetch it again would show the old badge in
   * between.
   */
  uploadPolicyDocument: async (
    policyId: string,
    file: File,
    locale?: string,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
  ): Promise<{ policy: ConsumerPolicy; disclaimer: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post(`/consumer/policies/${policyId}/document`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      params: locale ? { locale } : {},
      ...(onUploadProgress ? { onUploadProgress } : {}),
    });
    return res.data.data;
  },

  getDocuments: async (policyId?: string): Promise<{ documents: ConsumerDocument[] }> => {
    const res = await apiClient.get("/consumer/documents", {
      params: policyId ? { policyId } : {},
    });
    return res.data.data;
  },

  // ── Help me renew ────────────────────────────────────────────────────────

  /**
   * Ask a person for help renewing one policy.
   *
   * `agreed` is sent explicitly rather than implied by calling this at all. The
   * API refuses anything but a literal `true`, and passing it through the same
   * shape the consent screen produced keeps the agreement visible in the code
   * that sends it rather than buried in a default.
   */
  requestRenewalHelp: async (
    policyId: string,
    payload: {
      preferredChannel: ContactChannel;
      contactPhone?: string | null;
      alsoRemind?: boolean;
      agreed: true;
    },
    locale?: string
  ): Promise<RenewalRequestResult> => {
    const res = await apiClient.post(
      `/consumer/policies/${policyId}/renewal-request`,
      payload,
      { params: locale ? { locale } : {} }
    );
    return res.data.data;
  },

  getRenewalRequests: async (): Promise<{ requests: RenewalRequest[] }> => {
    const res = await apiClient.get("/consumer/renewal-requests");
    return res.data.data;
  },

  getConsents: async (): Promise<{ consents: ConsentRecord[] }> => {
    const res = await apiClient.get("/consumer/consents");
    return res.data.data;
  },

  /**
   * Stop a permission.
   *
   * `DELETE` in the HTTP sense only. The record survives with the date it was
   * withdrawn, which is the thing anybody asking afterwards actually needs.
   */
  withdrawConsent: async (
    consentId: string,
    locale?: string
  ): Promise<{ consent: ConsentRecord; message: string }> => {
    const res = await apiClient.delete(`/consumer/consents/${consentId}`, {
      params: locale ? { locale } : {},
    });
    return res.data.data;
  },

  // ── Aegis Kural Lite ─────────────────────────────────────────────────────

  getKuralTopics: async (locale?: string): Promise<KuralTopics> => {
    const res = await apiClient.get("/consumer/kural/topics", {
      params: locale ? { locale } : {},
    });
    return res.data.data;
  },

  /**
   * Ask a motor question.
   *
   * Always resolves on a 200, including when the answer is "I do not know that
   * one" — that is an outcome rather than an error, and treating it as a
   * rejection here would put it through the catch block that shows a red box.
   */
  askKural: async (
    question: string,
    options: { policyId?: string | null; locale?: string } = {}
  ): Promise<KuralAnswer> => {
    const res = await apiClient.post(
      "/consumer/kural/ask",
      { question, ...(options.policyId ? { policyId: options.policyId } : {}) },
      { params: options.locale ? { locale: options.locale } : {} }
    );
    return res.data.data;
  },

  /**
   * Where the file itself is served from.
   *
   * A URL rather than a fetch: a preview is an `<a>` or an `<img>`, and the
   * session cookie travels with it. Nothing about the document is in the path
   * beyond its id, so a link that is shared is still useless to anybody else —
   * the API answers only for the row's owner.
   */
  documentFileUrl: (documentId: string): string =>
    `${apiClient.defaults.baseURL ?? ""}/consumer/documents/${documentId}/file`,
};

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
export const leadService = {
  createLead: async (payload: {
    customerName: string;
    email: string;
    phone: string;
    insuranceType: string;
    budget: string;
  }) => {
    const res = await apiClient.post("/leads", payload);
    return res.data.data.lead;
  },
  // Server-side paginated. Params are optional so any caller that wants the
  // whole (bounded) list can still omit them; the backend defaults `limit` to
  // its hard cap. The response carries the list plus the pagination envelope.
  getLeads: async (
    params: { page?: number; limit?: number } = {}
  ): Promise<{ leads: Lead[]; pagination: PageInfo }> => {
    const res = await apiClient.get("/leads", { params });
    return { leads: res.data.data.leads, pagination: res.data.pagination };
  },
};

// ---------------------------------------------------------------------------
// Chat — Multi-Agent (session_id carried for continuity)
// ---------------------------------------------------------------------------

export interface ChatMessageResult {
  customerMessage: { id: string; message: string; sender: string; createdAt?: string };
  advisorMessage: { id: string; message: string; sender: string; createdAt?: string };
  agentName?: string;
  transferred?: boolean;
  sessionId?: string;
}

export const chatService = {
  sendMessage: async (
    message: string,
    productType?: string,
    sessionId?: string
  ): Promise<ChatMessageResult> => {
    const res = await apiClient.post("/chat", {
      message,
      product_type: productType,
      ...(sessionId ? { session_id: sessionId } : {}),
    });
    return res.data.data as ChatMessageResult;
  },
  getHistory: async () => {
    const res = await apiClient.get("/chat");
    return res.data.data.chat;
  },
};

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------
export const uploadService = {
  uploadDocument: async (file: File, onUploadProgress?: (progressEvent: AxiosProgressEvent) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
    return res.data.data.document;
  },
  // Server-side paginated (see leadService.getLeads). Params optional; the
  // response carries the document page plus its pagination envelope.
  getDocuments: async (
    params: { page?: number; limit?: number } = {}
  ): Promise<{ documents: DocumentRecord[]; pagination: PageInfo }> => {
    const res = await apiClient.get("/upload", { params });
    return { documents: res.data.data.documents, pagination: res.data.pagination };
  },
};


// ---------------------------------------------------------------------------
// UI Action Engine — structured button-click dispatcher
// Bypasses Intent Detection, Category Routing, and Recommendation Generation.
// ---------------------------------------------------------------------------

export interface UIActionPayload {
  type?: string;
  action: string;
  session_id?: string;
  plan_id?: string;
  session_data?: Record<string, unknown>;
}

export interface UIActionResult {
  type: string;
  action: string;
  session_id: string;
  status: string;
  response_type: string;
  data: Record<string, unknown>;
  message?: string;
}

export const uiActionService = {
  dispatch: async (payload: UIActionPayload): Promise<UIActionResult> => {
    const res = await apiClient.post("/ui-action", {
      type: "ui_action",
      ...payload,
    });
    return res.data.data as UIActionResult;
  },
};
