"use client";

import { useState } from "react";
import { leadService } from "@/services/api";
import { computeRecommendation, type Recommendation } from "./recommendation";
import { logger } from "@/lib/logger";

/** Delay before the underwriting spinner resolves to the verdict (ms). */
const UNDERWRITE_SIMULATE_DELAY = 2500;

/**
 * Owns all state and handlers for the 4-step Apply wizard so the step
 * components stay presentational. Behaviour (family/priority toggles, plan
 * recommendation, lead creation with offline fallback) is unchanged from the
 * original monolithic page.
 */
export function useApplyFlow() {
  const [step, setStep] = useState(1);

  // Guided State
  const [familyConfig, setFamilyConfig] = useState<string[]>(["self"]);
  const [budgetTier, setBudgetTier] = useState("medium");
  const [priorities, setPriorities] = useState<string[]>(["room-limit"]);

  // Contact details
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [secureId, setSecureId] = useState("");
  const [underwritingVerdict, setUnderwritingVerdict] = useState<Recommendation | null>(null);

  // Toggle family helper
  const toggleFamily = (member: string) => {
    if (member === "self") return;
    if (familyConfig.includes(member)) {
      setFamilyConfig(familyConfig.filter((m) => m !== member));
    } else {
      setFamilyConfig([...familyConfig, member]);
    }
  };

  // Toggle priorities
  const togglePriority = (p: string) => {
    if (priorities.includes(p)) {
      setPriorities(priorities.filter((item) => item !== p));
    } else {
      setPriorities([...priorities, p]);
    }
  };

  const executeRiskUnderwriting = async () => {
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      alert("Please complete all personal security credentials.");
      return;
    }

    setStep(4);
    setLoading(true);

    const recommendation = computeRecommendation({ priorities, budgetTier, familyConfig });
    const membersString = familyConfig.map((m) => m.toUpperCase()).join(" + ");
    const prioritiesString = priorities.join(", ");

    try {
      const lead = await leadService.createLead({
        customerName: fullName,
        email: email,
        phone: phone,
        insuranceType: `${recommendation.name} (${membersString})`,
        budget: `${budgetTier.toUpperCase()} [Priorities: ${prioritiesString}]`,
      });

      if (lead && lead.id) {
        setSecureId(lead.id);
      } else {
        setSecureId("AEG-" + Math.floor(100000 + Math.random() * 900000));
      }
      setUnderwritingVerdict(recommendation);
    } catch (err) {
      logger.error("Underwriting lead creation error:", err);
      setSecureId("AEG-" + Math.floor(100000 + Math.random() * 900000));
      setUnderwritingVerdict(recommendation);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, UNDERWRITE_SIMULATE_DELAY);
    }
  };

  return {
    step, setStep,
    familyConfig, toggleFamily,
    budgetTier, setBudgetTier,
    priorities, togglePriority,
    fullName, setFullName,
    phone, setPhone,
    email, setEmail,
    loading, secureId, underwritingVerdict,
    executeRiskUnderwriting,
  };
}
