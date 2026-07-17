"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { advisorPlanUrl } from "./botRouter";
import { MOCK_HOSPITALS, DEFAULT_PLAN } from "./constants";
import type { PlanDetails, DetailTab } from "./types";

/** GST rate applied to the interactive premium calculator. */
const GST_RATE = 0.18;

const RIDERS: { id: string; label: string; cost: number }[] = [
  { id: "critical", label: "Critical Illness Shield Option", cost: 120 },
  { id: "accidental", label: "Accidental Recovery Supplement", cost: 80 },
];

/**
 * Owns all state and handlers for the policy-details page so the hero and tab
 * components stay presentational. Behaviour (compare deep-link default, stored
 * plan load with fallback, rider calculator, network search, advisor routing)
 * is unchanged from the original monolithic page.
 */
export function usePolicyDetails() {
  const searchParams = useSearchParams();
  const isCompareDefault = searchParams.get("compare") === "true";

  const [activeTab, setActiveTab] = useState<DetailTab>("benefits");
  const [plan, setPlan] = useState<PlanDetails | null>(null);

  // Interactive Premium Calculator states
  const [basePremium, setBasePremium] = useState<number>(850);
  const [selectedRiders] = useState(RIDERS);
  const [activeRiderIds, setActiveRiderIds] = useState<string[]>(["critical"]);

  // Cashless network search state
  const [searchQuery, setSearchQuery] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    if (isCompareDefault) {
      setActiveTab("compare");
    }
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_PLAN);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPlan(parsed);
        // Extract numeric premium for calculator if possible
        const premStr = parsed.premium || "";
        const match = premStr.match(/\d+/);
        if (match) {
          setBasePremium(parseInt(match[0], 10));
        }
      } catch (err) {
        console.error("Failed to parse stored plan details", err);
      }
    } else {
      // Fallback default details if none saved yet
      setPlan(DEFAULT_PLAN);
    }
  }, [isCompareDefault]);

  // Calculator calculations (guarded so they can run before the plan resolves)
  const subtotal = basePremium + selectedRiders
    .filter((r) => activeRiderIds.includes(r.id))
    .reduce((sum, r) => sum + r.cost, 0);
  const gst = Math.round(subtotal * GST_RATE);
  const totalPremium = subtotal + gst;

  // Filter cashless hospitals/networks
  const filteredHospitals = MOCK_HOSPITALS.filter((h) =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const proceedToAdvisor = (planName: string) => {
    window.location.href = advisorPlanUrl(planName);
  };

  const toggleRider = (id: string) => {
    setActiveRiderIds((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
    );
  };

  return {
    plan,
    activeTab, setActiveTab,
    basePremium, selectedRiders, activeRiderIds, toggleRider,
    gst, totalPremium,
    searchQuery, setSearchQuery, filteredHospitals,
    proceedToAdvisor,
  };
}
