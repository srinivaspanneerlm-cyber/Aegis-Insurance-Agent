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
  (response) => response,
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
