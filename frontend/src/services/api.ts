import axios from "axios";

// 1) Configure Axios base parameters
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 2) Request interceptor: Inject secure JWT from localStorage
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("aegis_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 3) Response interceptor: Secure error handling and token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
    const message = error.response?.data?.message || "An unexpected error occurred.";

    if (status === 401) {
      console.warn("Unauthorized token access. Clearing credentials...");
      if (typeof window !== "undefined") {
        localStorage.removeItem("aegis_token");
        // We can optionally dispatch a custom event to notify components to redirect to login
        window.dispatchEvent(new Event("aegis_auth_error"));
      }
    }
    return Promise.reject(new Error(message));
  }
);

// 4) Export individual SaaS Feature Service Endpoints
export const authService = {
  register: async (payload: any) => {
    const res = await apiClient.post("/auth/register", payload);
    return res.data;
  },
  login: async (payload: any) => {
    const res = await apiClient.post("/auth/login", payload);
    return res.data;
  },
  getMe: async () => {
    const res = await apiClient.get("/auth/me");
    return res.data.data;
  },
};

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
  getLeads: async () => {
    const res = await apiClient.get("/leads");
    return res.data.data.leads;
  },
};

export const chatService = {
  sendMessage: async (message: string, productType?: string) => {
    const res = await apiClient.post("/chat", { message, product_type: productType });
    return res.data.data;
  },
  getHistory: async () => {
    const res = await apiClient.get("/chat");
    return res.data.data.chat;
  },
};

export const uploadService = {
  uploadDocument: async (file: File, onUploadProgress?: (progressEvent: any) => void) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await apiClient.post("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress,
    });
    return res.data.data.document;
  },
  getDocuments: async () => {
    const res = await apiClient.get("/upload");
    return res.data.data.documents;
  },
};

export const adminService = {
  getStats: async () => {
    const res = await apiClient.get("/admin/stats");
    return res.data.data;
  },
};
