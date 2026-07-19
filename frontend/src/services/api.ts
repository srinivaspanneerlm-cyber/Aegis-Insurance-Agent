import axios, { AxiosProgressEvent } from "axios";
import { API_URL } from "@/lib/config";
import type { Lead, PageInfo } from "@/types/domain";

// 1) Axios base configuration
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  // Send the httpOnly auth cookie with every request. The JWT is no longer
  // stored in localStorage (which was readable by any injected script / XSS).
  withCredentials: true,
});

// 2) Response interceptor — handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
    const message = error.response?.data?.message || "An unexpected error occurred.";
    if (status === 401) {
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
  logout: async () => {
    const res = await apiClient.post("/auth/logout");
    return res.data;
  },
  getMe: async () => {
    const res = await apiClient.get("/auth/me");
    return res.data.data;
  },
};

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------
export const policyService = {
  getPolicies: async () => {
    const res = await apiClient.get("/policies");
    return res.data.data.policies;
  },
  getPolicyById: async (id: string) => {
    const res = await apiClient.get(`/policies/${id}`);
    return res.data.data.policy;
  },
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
  getDocuments: async () => {
    const res = await apiClient.get("/upload");
    return res.data.data.documents;
  },
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const adminService = {
  getStats: async () => {
    const res = await apiClient.get("/admin/stats");
    return res.data.data;
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
