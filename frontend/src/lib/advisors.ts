// ── Advisor configuration ──────────────────────────────────────────────────────

export const ADVISORS = {
  motor: {
    name: "Alex AI",
    title: "Vehicle Protection Advisor",
    avatar: "A",
    emoji: "🚗",
    theme: "from-blue-600 to-cyan-500",
    glowColor: "rgba(6, 182, 212, 0.22)",
    borderGlow: "shadow-[0_0_25px_rgba(6,182,212,0.12)] border-cyan-500/20",
    activeTab: "bg-cyan-500/10 border-cyan-400/35 text-cyan-300",
    accentBg: "bg-cyan-500/10",
    accentText: "text-cyan-400",
    pythonDomain: "motor",
    intro: "Hey! 👋\n\nI'm Alex, your vehicle insurance advisor.\n\nCar or bike — you're in the right place. I'll keep it simple: no jargon, no pressure.\n\nWhat are we insuring? Tell me the make and model.",
    placeholder: "Tell Alex about your vehicle...",
  },
  health: {
    name: "Sarah AI",
    title: "Family Health Advisor",
    avatar: "S",
    emoji: "❤️",
    theme: "from-emerald-600 to-teal-500",
    glowColor: "rgba(16, 185, 129, 0.22)",
    borderGlow: "shadow-[0_0_25px_rgba(16,185,129,0.12)] border-emerald-500/20",
    activeTab: "bg-emerald-500/10 border-emerald-400/35 text-emerald-300",
    accentBg: "bg-emerald-500/10",
    accentText: "text-emerald-400",
    pythonDomain: "health",
    intro: "Hello! 👋\n\nI'm Sarah, your health insurance advisor.\n\nHealth insurance can feel confusing — don't worry, I'll explain everything step by step, and I won't suggest anything until I understand what you actually need.\n\nWho are we looking to protect — just yourself, or your family too?",
    placeholder: "Ask Sarah about health plans for your family...",
  },
  travel: {
    name: "Ethan AI",
    title: "Travel Protection Advisor",
    avatar: "E",
    emoji: "✈️",
    theme: "from-violet-600 to-purple-500",
    glowColor: "rgba(139, 92, 246, 0.22)",
    borderGlow: "shadow-[0_0_25px_rgba(139,92,246,0.12)] border-purple-500/20",
    activeTab: "bg-purple-500/10 border-purple-400/35 text-purple-300",
    accentBg: "bg-purple-500/10",
    accentText: "text-purple-400",
    pythonDomain: "travel",
    intro: "Hey, welcome! ✈️\n\nI'm Ethan, your travel insurance advisor.\n\nPlanning a trip? Good timing — with the right cover sorted, you can stop thinking about it and enjoy the travelling.\n\nWhere are you headed?",
    placeholder: "Tell Ethan about your travel plans...",
  },
  property: {
    name: "Emma AI",
    title: "Home Protection Advisor",
    avatar: "E",
    emoji: "🏡",
    theme: "from-amber-600 to-orange-500",
    glowColor: "rgba(245, 158, 11, 0.22)",
    borderGlow: "shadow-[0_0_25px_rgba(245,158,11,0.12)] border-amber-500/20",
    activeTab: "bg-amber-500/10 border-amber-400/35 text-amber-300",
    accentBg: "bg-amber-500/10",
    accentText: "text-amber-400",
    pythonDomain: "home-property",
    intro: "Welcome! 🏡\n\nI'm Emma, your home insurance advisor.\n\nYour home is usually the most valuable thing you own — let's find the cover that protects it properly.\n\nDo you own your home, or are you renting?",
    placeholder: "Ask Emma about protecting your home...",
  },
  miscellaneous: {
    name: "Sri AI",
    title: "Executive Risk Advisor",
    avatar: "SR",
    emoji: "💼",
    theme: "from-rose-600 to-pink-500",
    glowColor: "rgba(244, 63, 94, 0.35)",
    borderGlow: "shadow-[0_0_35px_rgba(244,63,94,0.18)] border-rose-500/35",
    activeTab: "bg-rose-500/10 border-rose-400/35 text-rose-300",
    accentBg: "bg-rose-500/10",
    accentText: "text-rose-400",
    pythonDomain: "executive",
    intro: "Good to connect. 💼\n\nI'm Sri, your guide at Aegis AI.\n\nHealth, motor, travel or home insurance — tell me what you need and I'll connect you to the right specialist.\n\nWhat brings you here today?",
    placeholder: "Tell Sri about your risk protection needs...",
  },
};

export type AdvisorKey = keyof typeof ADVISORS;
export type Advisor = (typeof ADVISORS)[AdvisorKey];

export const AGENT_NAME_TO_CATEGORY: Record<string, AdvisorKey> = {
  "Sarah AI": "health",
  "Alex AI": "motor",
  "Ethan AI": "travel",
  "Emma AI": "property",
  "Sri AI": "miscellaneous",
};

export const PYTHON_DOMAIN_TO_CATEGORY: Record<string, AdvisorKey> = {
  "health":        "health",
  "motor":         "motor",
  "travel":        "travel",
  "home-property": "property",
  "executive":     "miscellaneous",
};

/**
 * Resolve an advisor from any identifier the app uses for one — a UI category
 * (`property`) or a Python domain (`home-property`). The two key spaces overlap
 * but are not identical, and callers receive whichever the backend happened to
 * send, so both are accepted. Returns null for anything unrecognised.
 */
export function resolveAdvisorKey(key: string): AdvisorKey | null {
  if (key in ADVISORS) return key as AdvisorKey;
  return PYTHON_DOMAIN_TO_CATEGORY[key] || null;
}

/**
 * Display name for whichever advisor owns `key`, falling back to `fallback`
 * when the key names no advisor. The fallback is explicit because callers
 * disagree on the right one — a chat bubble wants the current agent, whereas a
 * purchase receipt wants a sensible default.
 */
export function resolveAdvisorName(key: string, fallback: string): string {
  const advisorKey = resolveAdvisorKey(key);
  return advisorKey ? ADVISORS[advisorKey].name : fallback;
}
