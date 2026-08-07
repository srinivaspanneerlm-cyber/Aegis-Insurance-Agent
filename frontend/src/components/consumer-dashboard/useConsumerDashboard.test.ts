import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { authState, push, replace, router } = vi.hoisted(() => {
  const push = vi.fn();
  // The guard turns an unauthenticated visitor away with `replace`, so Back
  // cannot return them to the page that just turned them away.
  const replace = vi.fn();
  // Signed out is a state the hook has to handle, so the session it stands in
  // for has to be allowed to be absent.
  const authState: {
    current: {
      user: { name: string; email?: string } | null;
      loading: boolean;
      isAuthenticated: boolean;
      logout: () => void;
    };
  } = {
    current: {
      user: { name: "Aarthi Kumar", email: "aarthi@example.com" },
      loading: false,
      isAuthenticated: true,
      logout: vi.fn(),
    },
  };
  return { authState, push, replace, router: { push, replace } };
});

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authState.current }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/api", () => ({
  chatService: { sendMessage: vi.fn() },
  policyService: { getPolicies: vi.fn() },
  // Resolves to null: these tests are about policies and identity, and a
  // rejected report would make them fail for a reason they are not testing.
  // The report's own behaviour is covered separately.
  intelligenceService: {
    getReport: vi.fn().mockResolvedValue(null),
    getProfile: vi.fn().mockResolvedValue({ heldPolicies: [], completeness: 0 }),
  },
}));

import { policyService } from "@/services/api";
import { useConsumerDashboard } from "./useConsumerDashboard";

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  authState.current = {
    user: { name: "Aarthi Kumar", email: "aarthi@example.com" },
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

describe("useConsumerDashboard — whose dashboard this is", () => {
  it("shows the signed-in customer, not a stand-in", async () => {
    authState.current = {
      user: { name: "Meena Rajan", email: "meena@example.com" },
      loading: false,
      isAuthenticated: true,
      logout: vi.fn(),
    };

    const { result } = renderHook(() => useConsumerDashboard());
    await waitFor(() => expect(result.current.isBooting).toBe(false));

    expect(result.current.clientName).toBe("Meena Rajan");
    expect(result.current.clientEmail).toBe("meena@example.com");
  });

  it("holds the screen rather than render a dashboard belonging to nobody", async () => {
    authState.current = {
      user: null,
      loading: false,
      isAuthenticated: false,
      logout: vi.fn(),
    };

    const { result } = renderHook(() => useConsumerDashboard());

    // The guard sends them to sign in; until then nothing of the dashboard —
    // and no invented name — is shown.
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(result.current.isBooting).toBe(true);
    expect(result.current.clientName).toBe("");
  });
});
