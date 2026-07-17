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
  vi.mocked(leadService.getLeads).mockResolvedValue([]);
  vi.mocked(chatService.getHistory).mockResolvedValue([]);
  vi.mocked(uploadService.getDocuments).mockResolvedValue([]);
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
    vi.mocked(leadService.getLeads).mockResolvedValue([
      { id: "X1", customerName: "Real Lead", status: "Pending Audit" },
    ]);
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.leads).toHaveLength(1);
    expect(result.current.leads[0].customerName).toBe("Real Lead");
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
