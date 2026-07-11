const axios = require("axios");
const prisma = require("../config/db");
const env = require("../config/env");

// Shared secret sent on every backend -> AI microservice call. When set, the
// AI service rejects requests that do not present a matching key.
const internalHeaders = env.AI_INTERNAL_API_KEY
  ? { "X-Internal-Api-Key": env.AI_INTERNAL_API_KEY }
  : {};

/**
 * Aegis AI — Multi-Agent Service Bridge
 * Routes chat messages through the Python CentralOrchestrator and returns
 * the full agent response including metadata (agent_name, transferred, etc.)
 */
const getResponseFromAIService = async (
  userMessage,
  userName = "Sri",
  productType = null,
  sessionId = null,
  userId = null
) => {
  const aiServiceUrl = env.AI_SERVICE_URL;

  // Fetch recent conversation history for context. Scope strictly to the
  // authenticated user so one customer's messages can never leak into another
  // customer's AI prompt (cross-tenant data isolation). Without a userId we
  // send no history rather than a global feed.
  let history = [];
  try {
    const recentChats = userId
      ? await prisma.chat.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [];
    recentChats.reverse();
    history = recentChats.map((c) => ({
      sender: c.sender,
      message: c.message,
    }));
  } catch (err) {
    console.error("[AI Service] Prisma history fetch error:", err.message);
  }

  try {
    const payload = {
      message: userMessage,
      history,
      user_name: userName,
      product_type: productType || undefined,
      session_id: sessionId || undefined,
    };

    const response = await axios.post(aiServiceUrl, payload, {
      timeout: 45000,
      headers: internalHeaders,
    });
    const data = response.data;

    // Return full orchestrator response including agent metadata
    return {
      reply: data.reply || "",
      agent_name: data.agent_name || null,
      agent_domain: data.agent_domain || null,
      transferred: data.transferred || false,
      transfer_from: data.transfer_from || null,
      transfer_to: data.transfer_to || null,
      transfer_to_name: data.transfer_to_name || null,
      session_id: data.session_id || sessionId || null,
    };
  } catch (error) {
    console.warn("[AI Service] Python microservice offline — using resilient fallback");
    const reply = _buildFallbackReply(userMessage, userName, productType, history);
    return {
      reply,
      agent_name: _detectFallbackAgent(userMessage, history, productType),
      agent_domain: _detectFallbackDomain(userMessage, history, productType),
      transferred: false,
      transfer_from: null,
      transfer_to: null,
      transfer_to_name: null,
      session_id: sessionId,
    };
  }
};

// ── Fallback helpers ──────────────────────────────────────────────────────────

function _detectFallbackDomain(message, history, productType) {
  if (productType) return productType;
  const allText = [message, ...history.map((h) => h.message)].join(" ").toLowerCase();
  if (["car", "bike", "vehicle", "motor", "creta", "enfield"].some((w) => allText.includes(w))) return "motor";
  if (["travel", "trip", "flight", "international", "abroad"].some((w) => allText.includes(w))) return "travel";
  if (["home", "house", "property", "apartment", "tenant"].some((w) => allText.includes(w))) return "home-property";
  return "health";
}

function _detectFallbackAgent(message, history, productType) {
  const domain = _detectFallbackDomain(message, history, productType);
  const map = { health: "Sarah AI", motor: "Alex AI", travel: "Ethan AI", "home-property": "Emma AI" };
  return map[domain] || "Sarah AI";
}

function _buildFallbackReply(userMessage, userName, productType, history) {
  const allText = [userMessage, ...history.map((h) => h.message)].join(" ").toLowerCase();

  let category = _detectFallbackDomain(userMessage, history, productType);
  const agentName = _detectFallbackAgent(userMessage, history, productType);

  const hasFamily = ["spouse", "wife", "husband", "child", "kid", "family", "myself", "members"].some((w) =>
    allText.includes(w)
  );
  const hasBudget =
    ["budget", "₹", "month", "premium", "rs", "rupee", "/mo"].some((w) => allText.includes(w)) ||
    /\d{3,}/.test(allText);
  const forceReveal = ["recommend", "suggest", "show plan", "quote", "reveal", "give me"].some((w) =>
    userMessage.toLowerCase().includes(w)
  );

  if ((hasFamily && hasBudget) || forceReveal) {
    const plans = {
      motor: {
        planName: "Aegis Bumper-to-Bumper Shield",
        category: "motor",
        coverage: "₹10,00,000",
        premium: "₹2,500/month",
        benefits: ["Zero Depreciation Cover", "Engine Protection", "24/7 Roadside Assistance", "Cashless Garages"],
        claimSettlementRatio: "98.9%",
        riskLevel: "Low Risk",
        score: 96,
        confidenceScore: 0.96,
        executiveApproval: "Approved",
        executiveNotes: "Underwritten by Alex AI. Safe Driver discount applied. Signed: Chief Risk Officer.",
        hospitalNetwork: "4,500+ Cashless Garage Networks",
        premiumBreakdown: "Base Premium: ₹2,125, GST (18%): ₹375",
        idvValue: "₹8,50,000",
        zeroDep: "Zero Depreciation Cover included",
        roadsideAssistance: "24/7 Roadside Assistance included",
        engineProtection: "Engine Protection included",
        alternativePlan: {
          planName: "Aegis Value Drive Cover",
          category: "motor",
          coverage: "₹5,00,000",
          premium: "₹1,200/month",
          benefits: ["Standard OD Cover", "Third Party Shield", "Cashless Garages"],
          claimSettlementRatio: "98.4%",
          riskLevel: "Low Risk",
          score: 85,
          confidenceScore: 0.9,
          executiveApproval: "Approved",
          premiumBreakdown: "Base Premium: ₹1,020, GST: ₹180",
        },
      },
      travel: {
        planName: "Aegis GlobeTrotter Elite",
        category: "travel",
        coverage: "₹35,00,000",
        premium: "₹1,500/month",
        benefits: ["Emergency Medical Evacuation", "Trip Cancellation", "Baggage Loss", "Adventure Sports Cover"],
        claimSettlementRatio: "98.8%",
        riskLevel: "Low Risk",
        score: 98,
        confidenceScore: 0.98,
        executiveApproval: "Approved",
        executiveNotes: "Underwritten by Ethan AI. Global mobility parameters verified.",
        hospitalNetwork: "10,000+ Global Partner Hospitals",
        premiumBreakdown: "Base Premium: ₹1,275, GST (18%): ₹225",
        medicalCoverage: "$100,000",
        tripCancellation: "$2,500",
        baggageLoss: "$1,000",
        emergencyEvacuation: "$50,000",
        alternativePlan: {
          planName: "Aegis Standard Voyage Guard",
          category: "travel",
          coverage: "₹10,00,000",
          premium: "₹700/month",
          benefits: ["Emergency Medical Cap", "Trip Interruption Safeguard"],
          claimSettlementRatio: "98.4%",
          score: 82,
          confidenceScore: 0.88,
          executiveApproval: "Approved",
          premiumBreakdown: "Base Premium: ₹595, GST: ₹105",
        },
      },
      "home-property": {
        planName: "Aegis SafeHaven Platinum",
        category: "home-property",
        coverage: "₹50,00,000",
        premium: "₹4,000/month",
        benefits: ["Complete Structure Cover", "Contents Protection", "Natural Calamity", "Relocation Allowance"],
        claimSettlementRatio: "99.2%",
        riskLevel: "Low Risk",
        score: 94,
        confidenceScore: 0.95,
        executiveApproval: "Approved",
        executiveNotes: "Underwritten by Emma AI. Calamity protection indices checked.",
        hospitalNetwork: "600+ Panel Engineers & Surveyors",
        premiumBreakdown: "Base Premium: ₹3,400, GST (18%): ₹600",
        propertyCoverage: "₹50,00,000",
        fireProtection: "100% replacement value cover",
        naturalDisasterCover: "Earthquake and Flood shield",
        theftCover: "Burglary & Theft protection",
        structureCover: "₹80 Lakhs",
        contentsCover: "₹20 Lakhs",
        alternativePlan: {
          planName: "Aegis Brick-and-Mortar Shield",
          category: "home-property",
          coverage: "₹25,00,000",
          premium: "₹2,000/month",
          benefits: ["Structure Cover", "Fire & Burglary Protection"],
          claimSettlementRatio: "98.4%",
          score: 80,
          confidenceScore: 0.86,
          executiveApproval: "Approved",
          premiumBreakdown: "Base Premium: ₹1,700, GST: ₹300",
        },
      },
      health: {
        planName: "Aegis Supreme Health Shield",
        category: "health",
        coverage: "₹1 Crore Cover",
        premium: "₹850/month",
        benefits: ["Cashless Hospitalization", "Zero Co-Pay", "Pre-existing Cover from Day 1", "No Room Rent Sublimit"],
        claimSettlementRatio: "99.1%",
        riskLevel: "Low Risk",
        score: 98,
        confidenceScore: 0.98,
        executiveApproval: "Approved",
        executiveNotes: "Underwritten by Sarah AI. Chief Risk Officer approved.",
        hospitalNetwork: "12,000+ Empanelled Cashless Care Centers",
        premiumBreakdown: "Base Premium: ₹720, GST (18%): ₹130",
        waitingPeriod: "12 months for pre-existing diseases, 30 days initial.",
        alternativePlan: {
          planName: "Aegis Care Silver Floater",
          category: "health",
          coverage: "₹8 Lakh Cover",
          premium: "₹1,800/month",
          benefits: ["Day Care Procedures", "Cashless Hospitalization", "Restore Benefit"],
          claimSettlementRatio: "98.4%",
          score: 85,
          confidenceScore: 0.92,
          executiveApproval: "Approved",
          premiumBreakdown: "Base Premium: ₹1,600, GST: ₹200",
        },
      },
    };

    const plan = plans[category] || plans.health;
    const agentMessages = {
      motor: `Alex AI here, ${userName}. I've locked in the **${plan.planName}** for your vehicle. Zero-depreciation means full part replacement value at claim time.`,
      travel: `Ethan AI here, ${userName}! Your travel is fully secured with the **${plan.planName}**. Includes medevac, trip cancellation, and baggage protection.`,
      "home-property": `Emma AI here, ${userName}. Your property is protected with the **${plan.planName}** — complete structure, contents, and natural calamity cover.`,
      health: `Sarah AI here, ${userName}. Based on your health profile, I've curated the **${plan.planName}** for your family with zero co-pay and 12,000+ cashless hospitals.`,
    };

    const explanation = agentMessages[category] || agentMessages.health;
    return `[RECOMMENDATION:${JSON.stringify(plan)}]\n\n${explanation}\n\nClick **View Details** for full coverage breakdown or **Select Plan** to proceed.`;
  }

  // Ask missing info
  const introMessages = {
    motor: `Alex AI here, ${userName}. To calibrate your vehicle protection shield: what's your vehicle make, model, and year? I'll calculate the exact IDV and premium for you.`,
    travel: `Ethan AI here, ${userName}! To secure your journey: where are you travelling and approximately when? I'll map out the exact coverage you need.`,
    "home-property": `Emma AI here, ${userName}. To structure your home protection: do you own or rent? Is it an apartment or independent house? This helps me calculate the right coverage.`,
    health: `Sarah AI here, ${userName}. To design the best health protection: who are we covering (yourself, family), approximate age, and monthly budget?`,
  };

  return introMessages[category] || introMessages.health;
}

module.exports = {
  getResponseFromAIService,
};
