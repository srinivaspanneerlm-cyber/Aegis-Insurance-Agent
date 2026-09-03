/**
 * Turning a stream of model tokens into things worth saying out loud.
 *
 * Two jobs, both of which used to be done badly or not at all.
 *
 * **Sanitising** was already here, but buried inside `useVoice.speak()` where
 * only a complete reply could reach it. Now that sentences are spoken while the
 * rest is still being written, the same rules have to apply to a fragment — so
 * they live in a function instead of in a closure. The behaviour is unchanged;
 * only its reachability is.
 *
 * **Segmenting** is new. Speaking each token as it arrives produces stuttering
 * nonsense — a speech synthesiser given "I" then " recommend" then " the" says
 * three disconnected words with three separate intonations. Waiting for the
 * whole reply is what the old code did and is the latency this replaces. The
 * unit that is both natural to hear and available early is the sentence.
 *
 * The boundary rules matter more than they look:
 *
 *   `।` is in the terminator set because Tamil and other Indic text uses the
 *   danda, and a reply written in Tamil script has no full stops in it at all.
 *   Without it, a Tamil answer would buffer to the end and lose every bit of
 *   the latency this file exists to win.
 *
 *   A decimal point, an abbreviation and a rupee figure all contain `.` and
 *   none of them end a sentence. "₹12,500." split at the wrong place is read
 *   aloud as two fragments, which in a premium quote is worse than a pause.
 *
 *   There is a length fallback, because a model that writes a long clause with
 *   no terminal punctuation would otherwise never trigger the first utterance —
 *   the one case where "wait for a boundary" degrades into "wait for the end".
 */

/** Sentence-ending punctuation, including the Indic danda. */
const TERMINATORS = new Set([".", "!", "?", "।", "॥"]);

/** Closers that legitimately follow a terminator and belong to the same sentence. */
const TRAILING = new Set(['"', "'", ")", "]", "”", "’", "»"]);

/**
 * Past this many characters with no boundary in sight, speak at the last safe
 * pause instead of waiting. Long enough that ordinary prose is never cut
 * mid-thought, short enough that a customer is not left in silence.
 */
export const MAX_UNSPOKEN_CHARS = 220;

/** Below this a fragment is not worth an utterance of its own. */
export const MIN_SPOKEN_CHARS = 2;

/** Weak boundaries used only by the length fallback, best first. */
const SOFT_BREAKS = [";", ":", ",", "—", " "];

/**
 * Abbreviations whose full stop does not end a sentence.
 *
 * Deliberately short. Every entry is one an insurance advisor actually writes,
 * and a list that tried to be exhaustive would be a list nobody could check.
 */
const ABBREVIATIONS = [
  "mr", "mrs", "ms", "dr", "sr", "jr", "st",
  "vs", "etc", "eg", "ie", "no", "rs", "approx", "govt", "ltd", "pvt", "co",
];

/** Whether the `.` at `index` is a decimal point rather than a full stop. */
function isDecimalPoint(text: string, index: number): boolean {
  const before = text[index - 1];
  const after = text[index + 1];
  return /\d/.test(before ?? "") && /\d/.test(after ?? "");
}

/** Whether the `.` at `index` closes a known abbreviation. */
function isAbbreviation(text: string, index: number): boolean {
  // Walk back over the word this full stop is attached to.
  let start = index - 1;
  while (start >= 0 && /[A-Za-z]/.test(text[start])) start -= 1;
  const word = text.slice(start + 1, index).toLowerCase();
  if (!word) return false;
  if (ABBREVIATIONS.includes(word)) return true;
  // A single letter followed by a stop is an initial — "A. Kumar" — not an end.
  return word.length === 1;
}

/**
 * The index just past the first complete sentence in `text`, or -1.
 *
 * Only reports a boundary it is sure of: a terminator that is not a decimal
 * point or an abbreviation, followed by whitespace or the end of what we have.
 * A terminator at the very end of an in-flight buffer is *not* a boundary,
 * because the next token may reveal it was "3.5" all along.
 */
export function findSentenceEnd(text: string, atEnd = false): number {
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (!TERMINATORS.has(char)) continue;
    if (char === "." && (isDecimalPoint(text, i) || isAbbreviation(text, i))) continue;

    // Absorb repeated terminators ("!?") and any closing quote or bracket.
    let end = i + 1;
    while (end < text.length && (TERMINATORS.has(text[end]) || TRAILING.has(text[end]))) end += 1;

    if (end >= text.length) {
      // Nothing after it yet. Only trustworthy once we know no more is coming.
      return atEnd ? end : -1;
    }
    if (/\s/.test(text[end])) return end;
    // A terminator glued to more text — a URL, a version number. Not a boundary.
  }
  return -1;
}

/**
 * Where to break a long run that has produced no sentence boundary.
 *
 * Returns -1 below the threshold, so ordinary prose is never chopped: this is
 * the escape hatch for the model that writes 300 characters without a full
 * stop, not a second segmentation strategy.
 */
export function findFallbackBreak(text: string, maxChars = MAX_UNSPOKEN_CHARS): number {
  const limit = Math.max(40, maxChars);
  if (text.length < limit) return -1;
  const window = text.slice(0, limit);
  for (const mark of SOFT_BREAKS) {
    const at = window.lastIndexOf(mark);
    // Not so early that the utterance is a stub.
    if (at > limit / 3) return at + 1;
  }
  return limit;
}

/**
 * Pull every complete sentence out of a buffer.
 *
 * Returns what can be spoken now and what must keep accumulating. `atEnd` says
 * the stream is finished, which is what lets a final sentence with no trailing
 * space — or no terminator at all — still be spoken.
 *
 * `maxChars` only tightens the length fallback, never the sentence rule: a turn
 * worded with time pressure should not wait behind a long clause for its first
 * full stop. See `maxUnspokenCharsFor` in `lib/voiceStyle`.
 */
export function takeSpeakableSentences(
  buffer: string,
  atEnd = false,
  maxChars = MAX_UNSPOKEN_CHARS
): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = buffer;

  for (;;) {
    let cut = findSentenceEnd(rest, atEnd);
    if (cut === -1) cut = findFallbackBreak(rest, maxChars);
    if (cut === -1) break;

    const piece = rest.slice(0, cut);
    rest = rest.slice(cut);
    if (piece.trim()) sentences.push(piece.trim());
  }

  if (atEnd && rest.trim()) {
    sentences.push(rest.trim());
    rest = "";
  }

  return { sentences, rest };
}

/**
 * Everything from the first structured tag onwards, removed.
 *
 * `[RECOMMENDATION:{...}]` is a several-kilobyte JSON payload the interface
 * renders as a card. Read aloud it is a minute of punctuation, and it is always
 * appended at the end — so the safe rule while streaming is not "strip the tag"
 * but "stop at it". Stripping needs the closing bracket, which has not arrived
 * yet; stopping needs only the opening one, and nothing said after a tag is
 * ever meant to be heard anyway.
 */
export function truncateAtStructuredTag(text: string): string {
  const at = text.search(/\[(?:RECOMMENDATION|DOCUMENT_REQUEST)\s*:/i);
  return at === -1 ? text : text.slice(0, at);
}

/**
 * A fragment of model output, as it should be heard.
 *
 * The rules are the ones `useVoice.speak()` has always applied — tags out,
 * markdown symbols out, newlines turned into pauses, length bounded — kept
 * identical so that extracting them changed nothing about how a reply sounds.
 */
export function sanitizeForSpeech(text: string): string {
  return truncateAtStructuredTag(text ?? "")
    .replace(/\[RECOMMENDATION:\{[\s\S]*?\}\]/g, "")
    .replace(/[#*_`~>]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .slice(0, 1500)
    .trim();
}

/** Whether this fragment is worth an utterance at all, once sanitised. */
export function isWorthSpeaking(text: string): boolean {
  const clean = sanitizeForSpeech(text);
  // Punctuation alone is not speech: a synthesiser handed "—" says nothing and
  // fires no end event, which would stall a queue that waits for one.
  return clean.length >= MIN_SPOKEN_CHARS && /[\p{L}\p{N}]/u.test(clean);
}
