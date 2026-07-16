import type { RecommendationData } from "./types";

// ── Recommendation parsing ─────────────────────────────────────────────────────

export function parseRecommendation(text: string): { data: RecommendationData; cleanedText: string } | null {
  const startTag = "[RECOMMENDATION:";
  const start = text.indexOf(startTag);
  if (start === -1) return null;

  const jsonStart = start + startTag.length;
  if (jsonStart >= text.length) return null;

  // Balance-walk to find the matching closing bracket of the JSON object
  let depth = 0;
  let inString = false;
  let escape = false;
  let jsonEnd = -1;

  for (let i = jsonStart; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) { jsonEnd = i; break; }
    }
  }

  if (jsonEnd === -1) return null;

  const jsonStr = text.slice(jsonStart, jsonEnd + 1);
  let data: RecommendationData | null = null;
  try { data = JSON.parse(jsonStr); } catch { return null; }
  if (!data) return null;

  // The full tag is [RECOMMENDATION:{...json...}] — ends at jsonEnd+1 (the outer "]")
  const tagEnd = jsonEnd + 1;
  const trailingBracket = text[tagEnd] === "]" ? tagEnd + 1 : tagEnd;
  const fullTag = text.slice(start, trailingBracket);
  const cleanedText = text.replace(fullTag, "").trim();

  return { data, cleanedText };
}
