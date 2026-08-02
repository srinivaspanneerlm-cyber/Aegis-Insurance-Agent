import { extractTaggedPayload } from "@/lib/tagParser";
import type { RecommendationData } from "./types";

// ── Recommendation parsing ─────────────────────────────────────────────────────

/** Extract the advisor's `[RECOMMENDATION:{…}]` payload from its prose reply. */
export function parseRecommendation(text: string): { data: RecommendationData; cleanedText: string } | null {
  return extractTaggedPayload<RecommendationData>(text, "RECOMMENDATION");
}
