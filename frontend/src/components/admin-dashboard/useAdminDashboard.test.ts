import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { authState, push, router } = vi.hoisted(() => {
  const push = vi.fn();
  return {
    authState: {
      current: {
        user: { name: "Officer Node" },
        loading: false,
        isAuthenticated: true,
        isAdmin: true,
        logout: vi.fn(),
      },
    },
    push,
    // Stable reference, like the real next/navigation router — otherwise a new
    // object each render would re-fire the data-sync effect indefinitely.
    router: { push },
  };
});

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authState.current }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/api", () => ({
  adminService: { getStats: vi.fn() },
  leadService: { getLeads: vi.fn() },
  chatService: { getHistory: vi.fn() },
  uploadService: { getDocuments: vi.fn(), uploadDocument: vi.fn() },
}));

import { adminService, leadService, chatService, uploadService } from "@/services/api";
import { useAdminDashboard } from "./useAdminDashboard";

beforeEach(() => {
  push.mockReset();
  authState.current = {
    user: { name: "Officer Node" },
    loading: false,
    isAuthenticated: true,
    isAdmin: true,
    logout: vi.fn(),
  };
  vi.mocked(adminService.getStats).mockResolvedValue(null);
  vi.mocked(leadService.getLeads).mockResolvedValue({
    leads: [],
    pagination: { total: 0, page: 1, limit: 10, pages: 0 },
  });
  vi.mocked(chatService.getHistory).mockResolvedValue([]);
  vi.mocked(uploadService.getDocuments).mockResolvedValue({
    documents: [],
    pagination: { total: 0, page: 1, limit: 8, pages: 0 },
  });
});

describe("useAdminDashboard — access guards", () => {
  it("redirects to admin-login when not authenticated", () => {
    authState.current = { ...authState.current, isAuthenticated: false };
    renderHook(() => useAdminDashboard());
    expect(push).toHaveBeenCalledWith("/admin-login");
  });

  it("stops booting and reports non-admin for a logged-in non-admin", async () => {
    authState.current = { ...authState.current, isAdmin: false };
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});

describe("useAdminDashboard — data sync", () => {
  it("uses fallback leads when the API returns none", async () => {
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.leads.length).toBeGreaterThan(0);
    expect(result.current.leads[0].customerName).toBeTruthy();
  });

  it("uses API leads when provided", async () => {
    vi.mocked(leadService.getLeads).mockResolvedValue({
      leads: [{ id: "X1", customerName: "Real Lead", status: "Pending Audit" }],
      pagination: { total: 1, page: 1, limit: 10, pages: 1 },
    });
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.leads).toHaveLength(1);
    expect(result.current.leads[0].customerName).toBe("Real Lead");
  });
});

describe("useAdminDashboard — leads pagination", () => {
  it("requests the given page and mirrors the envelope", async () => {
    vi.mocked(leadService.getLeads).mockResolvedValue({
      leads: [{ id: "P1", customerName: "Page One", status: "Pending Audit" }],
      pagination: { total: 30, page: 1, limit: 10, pages: 3 },
    });
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.leadsPagination?.pages).toBe(3);
    expect(leadService.getLeads).toHaveBeenCalledWith({ page: 1, limit: 10 });

    vi.mocked(leadService.getLeads).mockResolvedValue({
      leads: [{ id: "P2", customerName: "Page Two", status: "Pending Audit" }],
      pagination: { total: 30, page: 2, limit: 10, pages: 3 },
    });
    await act(async () => {
      result.current.goToLeadsPage(2);
    });
    await waitFor(() => expect(result.current.leads[0].customerName).toBe("Page Two"));
    expect(leadService.getLeads).toHaveBeenLastCalledWith({ page: 2, limit: 10 });
    expect(result.current.leadsPagination?.page).toBe(2);
  });

  it("leaves pagination unset (single mock page) when the API has no leads", async () => {
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.leadsPagination).toBeNull();
    expect(result.current.leads.length).toBeGreaterThan(0);
  });
});

describe("useAdminDashboard — documents pagination", () => {
  it("loads a page of vaulted documents and mirrors the envelope", async () => {
    vi.mocked(uploadService.getDocuments).mockResolvedValue({
      documents: [{ id: "D1", name: "policy.pdf" }],
      pagination: { total: 12, page: 1, limit: 8, pages: 2 },
    });
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(uploadService.getDocuments).toHaveBeenCalledWith({ page: 1, limit: 8 });
    expect(result.current.documentsPagination?.pages).toBe(2);

    vi.mocked(uploadService.getDocuments).mockResolvedValue({
      documents: [{ id: "D2", name: "receipt.pdf" }],
      pagination: { total: 12, page: 2, limit: 8, pages: 2 },
    });
    await act(async () => {
      result.current.goToDocumentsPage(2);
    });
    await waitFor(() => expect(result.current.documents[0].name).toBe("receipt.pdf"));
    expect(uploadService.getDocuments).toHaveBeenLastCalledWith({ page: 2, limit: 8 });
  });
});

describe("useAdminDashboard — actions", () => {
  it("approves a lead and logs the override", async () => {
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));

    const target = result.current.leads.find(l => l.status !== "Approved")!;
    act(() => result.current.handleApproveLead(target.id));

    const updated = result.current.leads.find(l => l.id === target.id);
    expect(updated?.status).toBe("Approved");
    expect(result.current.logs[0]).toContain(target.id);
  });

  it("rejects an unsupported file type with a validation error", async () => {
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));

    const file = new File(["x"], "malware.txt", { type: "text/plain" });
    await act(async () => {
      await result.current.handleFileSelect({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.validationError).toMatch(/only pdf and docx/i);
    expect(uploadService.uploadDocument).not.toHaveBeenCalled();
  });
});
