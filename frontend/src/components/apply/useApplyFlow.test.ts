import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock the API layer so the hook never hits the network.
vi.mock("@/services/api", () => ({
  leadService: { createLead: vi.fn() },
}));

import { leadService } from "@/services/api";
import { useApplyFlow } from "./useApplyFlow";

const createLead = vi.mocked(leadService.createLead);

beforeEach(() => {
  createLead.mockReset();
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

describe("useApplyFlow — family/priority toggles", () => {
  it("starts with self locked and the default selections", () => {
    const { result } = renderHook(() => useApplyFlow());
    expect(result.current.familyConfig).toEqual(["self"]);
    expect(result.current.budgetTier).toBe("medium");
    expect(result.current.priorities).toEqual(["room-limit"]);
    expect(result.current.step).toBe(1);
  });

  it("never lets 'self' be toggled off", () => {
    const { result } = renderHook(() => useApplyFlow());
    act(() => result.current.toggleFamily("self"));
    expect(result.current.familyConfig).toEqual(["self"]);
  });

  it("adds then removes a family member", () => {
    const { result } = renderHook(() => useApplyFlow());
    act(() => result.current.toggleFamily("spouse"));
    expect(result.current.familyConfig).toContain("spouse");
    act(() => result.current.toggleFamily("spouse"));
    expect(result.current.familyConfig).not.toContain("spouse");
  });

  it("toggles priorities on and off", () => {
    const { result } = renderHook(() => useApplyFlow());
    act(() => result.current.togglePriority("global-medevac"));
    expect(result.current.priorities).toContain("global-medevac");
    act(() => result.current.togglePriority("room-limit"));
    expect(result.current.priorities).not.toContain("room-limit");
  });
});

describe("useApplyFlow — underwriting submission", () => {
  it("blocks submission and alerts when contact details are incomplete", async () => {
    const { result } = renderHook(() => useApplyFlow());
    await act(async () => { await result.current.executeRiskUnderwriting(); });
    expect(window.alert).toHaveBeenCalled();
    expect(createLead).not.toHaveBeenCalled();
    expect(result.current.step).toBe(1);
  });

  it("creates a lead and stores the returned secure id + verdict", async () => {
    createLead.mockResolvedValue({ id: "LEAD-77" });
    const { result } = renderHook(() => useApplyFlow());

    act(() => {
      result.current.setFullName("Aravind");
      result.current.setPhone("9876543210");
      result.current.setEmail("a@x.com");
    });
    await act(async () => { await result.current.executeRiskUnderwriting(); });

    expect(createLead).toHaveBeenCalledTimes(1);
    expect(result.current.step).toBe(4);
    expect(result.current.secureId).toBe("LEAD-77");
    expect(result.current.underwritingVerdict?.name).toBeTruthy();
  });

  it("falls back to a generated id when lead creation fails", async () => {
    createLead.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useApplyFlow());

    act(() => {
      result.current.setFullName("Aravind");
      result.current.setPhone("9876543210");
      result.current.setEmail("a@x.com");
    });
    await act(async () => { await result.current.executeRiskUnderwriting(); });

    expect(result.current.secureId).toMatch(/^AEG-\d+$/);
    expect(result.current.underwritingVerdict?.name).toBeTruthy();
  });
});
