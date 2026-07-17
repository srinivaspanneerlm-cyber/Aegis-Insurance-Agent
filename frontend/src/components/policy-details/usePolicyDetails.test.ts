import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Control the `compare` search param per test.
const { searchParamsMock } = vi.hoisted(() => ({
  searchParamsMock: { value: new URLSearchParams() },
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock.value,
}));

import { STORAGE_KEYS } from "@/lib/storage-keys";
import { usePolicyDetails } from "./usePolicyDetails";

beforeEach(() => {
  localStorage.clear();
  searchParamsMock.value = new URLSearchParams();
});

describe("usePolicyDetails — plan loading", () => {
  it("falls back to the default plan when nothing is stored", () => {
    const { result } = renderHook(() => usePolicyDetails());
    expect(result.current.plan?.planName).toBe("Aegis Supreme Health Shield");
    expect(result.current.activeTab).toBe("benefits");
    expect(result.current.basePremium).toBe(850);
  });

  it("loads a stored plan and extracts its numeric base premium", () => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_PLAN, JSON.stringify({
      planName: "Aegis Smart Drive Shield",
      coverage: "₹10 Lakh",
      premium: "₹1200/mo",
      benefits: ["a"],
    }));
    const { result } = renderHook(() => usePolicyDetails());
    expect(result.current.plan?.planName).toBe("Aegis Smart Drive Shield");
    expect(result.current.basePremium).toBe(1200);
  });

  it("opens the compare tab when ?compare=true", () => {
    searchParamsMock.value = new URLSearchParams("compare=true");
    const { result } = renderHook(() => usePolicyDetails());
    expect(result.current.activeTab).toBe("compare");
  });
});

describe("usePolicyDetails — calculator and search", () => {
  it("recomputes GST and total when a rider is toggled", () => {
    const { result } = renderHook(() => usePolicyDetails());
    // default: base 850 + critical(120) = 970; gst round(174.6)=175; total 1145
    expect(result.current.totalPremium).toBe(1145);

    act(() => result.current.toggleRider("accidental"));
    // now + accidental(80) = 1050; gst 189; total 1239
    expect(result.current.activeRiderIds).toContain("accidental");
    expect(result.current.totalPremium).toBe(1239);
  });

  it("filters the hospital network by query", () => {
    const { result } = renderHook(() => usePolicyDetails());
    const all = result.current.filteredHospitals.length;
    act(() => result.current.setSearchQuery("chennai"));
    expect(result.current.filteredHospitals.length).toBeLessThan(all);
    expect(result.current.filteredHospitals.every(h =>
      `${h.name} ${h.city} ${h.category}`.toLowerCase().includes("chennai"))).toBe(true);
  });

  it("returns no hospitals for an unmatched query", () => {
    const { result } = renderHook(() => usePolicyDetails());
    act(() => result.current.setSearchQuery("zzz-nonexistent"));
    expect(result.current.filteredHospitals).toHaveLength(0);
  });
});
