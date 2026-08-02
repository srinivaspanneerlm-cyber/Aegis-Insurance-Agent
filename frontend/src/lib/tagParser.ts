// ── Inline AI control-tag parsing ────────────────────────────────────────────

export interface TaggedPayload<T> {
  /** The parsed JSON body of the tag. */
  data: T;
  /** The surrounding prose with the whole tag removed. */
  cleanedText: string;
}

/**
 * Pull an inline `[NAME:{…json…}]` control tag out of an AI response.
 *
 * Agents embed structured payloads in the middle of prose, so the closing
 * bracket cannot be found with a plain `indexOf` — the payload itself contains
 * braces and brackets, including inside string values. This balance-walks the
 * JSON (string- and escape-aware) and returns null while a tag is still
 * half-streamed, which is what stops a partial tag rendering as raw text.
 */
export function extractTaggedPayload<T>(text: string, name: string): TaggedPayload<T> | null {
  const startTag = `[${name}:`;
  const start = text.indexOf(startTag);
  if (start === -1) return null;

  const jsonStart = start + startTag.length;
  if (jsonStart >= text.length) return null;

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

  let data: T | null = null;
  try { data = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as T; } catch { return null; }
  if (!data) return null;

  // The tag closes with its own "]" straight after the payload.
  const tagEnd = text[jsonEnd + 1] === "]" ? jsonEnd + 2 : jsonEnd + 1;
  const cleanedText = text.replace(text.slice(start, tagEnd), "").trim();

  return { data, cleanedText };
}
