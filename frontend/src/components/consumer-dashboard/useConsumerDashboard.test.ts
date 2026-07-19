import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { authState, push, router } = vi.hoisted(() => {
  const push = vi.fn();
  return {
    authState: {
      current: {
        user: { name: "Premium Client" },
        loading: false,
        isAuthenticated: true,
        logout: vi.fn(),
      },
    },
    push,
    router: { push },
  };
});

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authState.current }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/api", () => ({
  chatService: { sendMessage: vi.fn() },
  policyService: { getPolicies: vi.fn() },
}));

import { policyService } from "@/services/api";
import { useConsumerDashboard } from "./useConsumerDashboard";

beforeEach(() => {
  push.mockReset();
  authState.current = {
    user: { name: "Premium Client" },
    loading: false,
    isAuthenticated: true,
    logout: vi.fn(),
  };
  vi.mocked(policyService.getPolicies).mockResolvedValue({
    policies: [],
    pagination: { total: 0, page: 1, limit: 6, pages: 0 },
  });
});

describe("useConsumerDashboard — policies pagination", () => {
  it("keeps the premium default (no pagination) when the API has no policies", async () => {
    const { result } = renderHook(() => useConsumerDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(policyService.getPolicies).toHaveBeenCalledWith({ page: 1, limit: 6 });
    expect(result.current.policiesPagination).toBeNull();
    expect(result.current.activePoliciesList.length).toBeGreaterThan(0);
  });

  it("pages through the portfolio and mirrors the envelope", async () => {
    vi.mocked(policyService.getPolicies).mockResolvedValue({
      policies: [{ id: "1", policyName: "Plan One", coverage: "1 Cr", premium: 100 }],
      pagination: { total: 12, page: 1, limit: 6, pages: 2 },
    });
    const { result } = renderHook(() => useConsumerDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.policiesPagination?.pages).toBe(2);
    expect(result.current.activePoliciesList[0].policyName).toBe("Plan One");

    vi.mocked(policyService.getPolicies).mockResolvedValue({
      policies: [{ id: "2", policyName: "Plan Two", coverage: "2 Cr", premium: 200 }],
      pagination: { total: 12, page: 2, limit: 6, pages: 2 },
    });
    await act(async () => {
      result.current.goToPoliciesPage(2);
    });
    await waitFor(() => expect(result.current.activePoliciesList[0].policyName).toBe("Plan Two"));
    expect(policyService.getPolicies).toHaveBeenLastCalledWith({ page: 2, limit: 6 });
    expect(result.current.policiesPagination?.page).toBe(2);
  });
});
