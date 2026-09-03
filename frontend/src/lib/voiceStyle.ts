/**
 * Reading how a customer put something, so the advisor can answer in kind.
 *
 * Deliberately a set of rules over the words themselves, not a model. Three
 * reasons, in order of how much they matter:
 *
 *   **It must not guess at people.** Every label below describes the *wording*
 *   of a message — a repetition, an "I don't understand", the word "urgent" —
 *   and never the person who wrote it. Aegis is not qualified to decide that a
 *   customer is upset, and a system that acted on such a guess would be wrong
 *   in public, about someone's insurance, in their own words. Naming the
 *   observation rather than the emotion keeps the mistake small when it comes:
 *   an answer phrased more plainly than it needed to be is a bad guess nobody
 *   notices, where "I can hear you're frustrated" is one they never forget.
 *
 *   **It must not cost a turn.** A second model call to classify tone would add
 *   latency to the exact path Step 5 spent its whole effort removing, and spend
 *   paid quota on a decision worth a handful of regexes.
 *
 *   **It must be inspectable.** When an advisor answers oddly, someone has to be
 *   able to say why. These rules can be read.
 *
 * The audience shapes the vocabulary. These customers speak English, Tamil and
 * Thanglish, often within one sentence, so the markers include the Thanglish
 * ones people actually say — `puriyala` for "I don't understand", `seekiram`
 * for "quickly". Tamil script is matched where a short phrase is unambiguous.
 * Nothing here translates anything; it only notices.
 *
 * Everything unrecognised is `normal`, which is the behaviour Aegis had before
 * any of this existed. Adaptation failing must never cost a customer an answer.
 */

/**
 * How a message was worded.
 *
 * Read these as descriptions of sentences, not states of mind:
 *
 * `normal`      — nothing in particular stands out.
 * `confused`    — worded as though something has not landed.
 * `frustrated`  — carries the markers of a stalled conversation.
 * `urgent`      — carries time pressure.
 * `brief`       — short and direct, with no padding.
 */
export type SpeakingStyle = "normal" | "confused" | "frustrated" | "urgent" | "brief";

export const SPEAKING_STYLES: readonly SpeakingStyle[] = [
  "normal", "confused", "frustrated", "urgent", "brief",
] as const;

/**
 * A phrase matcher that will not fire from inside a longer word.
 *
 * "quick" must not match "Quickfield Road", the same way "car" must not match
 * "care" — the defect `cbd47bb` fixed in the domain lexicon, which cost a
 * health customer being routed to motor. Boundaries are written as
 * "not a letter or a number" rather than `\b`, because `\b` is ASCII-oriented
 * and would put a boundary in the middle of Tamil script.
 *
 * The leading boundary is consumed rather than looked behind: these are only
 * ever used with `.test()`, so consumption costs nothing, and lookbehind is
 * unavailable on older iOS Safari — which is precisely the browser this whole
 * voice layer exists to include.
 */
function phraseRe(phrases: string[]): RegExp {
  const escaped = phrases.map((p) =>
    p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
  );
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${escaped.join("|")})(?![\\p{L}\\p{N}])`, "iu");
}

// A conversation that has stalled: something repeated, something still unfixed,
// or a sentence carrying its own emphasis.
const STALLED = phraseRe([
  "already told you", "already said", "i said that", "asked you",
  "still not", "still doesn't", "still dont", "still no",
  "not working", "doesn't work", "does not work", "didn't work",
  "again and again", "how many times", "same thing", "over and over",
  "waste of time", "no use", "useless", "pointless",
  "forget it", "never mind this",
  // Thanglish, as people actually say it.
  "onnum nadakala", "seri illa", "romba neram",
]);

// Worded as though something has not landed.
const NOT_LANDING = phraseRe([
  "don't understand", "dont understand", "do not understand",
  "not clear", "unclear", "confusing", "confused",
  "what do you mean", "what does that mean", "what is that",
  "didn't get", "didnt get", "did not get", "not getting",
  "explain again", "say that again", "come again",
  "simpler", "simple words", "plain english", "in easy words",
  "no idea", "lost me",
  // Thanglish / Tamil.
  "puriyala", "puriyalai", "purila", "theriyala", "theriyalai",
  "புரியல", "புரியவில்லை",
]);

/**
 * The "what does X mean" family, where a word can sit in the middle.
 *
 * A fixed phrase list cannot see "what does that *even* mean", and that is
 * exactly how somebody says it when the answer did not land. Kept as one
 * explicit pattern rather than by loosening the phrase matcher, which would
 * make every other entry fire more eagerly than it should.
 */
const NOT_LANDING_LOOSE = /\bwhat (?:does|do|is|are) [^.?!]{0,24}\bmean\b/i;

// Time pressure, stated.
const TIME_PRESSURE = phraseRe([
  "urgent", "urgently", "emergency", "immediately", "right away", "right now",
  "as soon as possible", "asap", "today itself", "by today", "by tomorrow",
  "quickly", "quick", "hurry", "no time", "running out of time",
  "in a hurry", "need it now",
  // Thanglish.
  "seekiram", "sikkiram", "udane", "ippove",
]);

/**
 * A raised voice, in punctuation or capitals.
 *
 * Both are weak on their own — a transcript rarely carries either, and STT
 * output is usually flat — so they are treated as supporting evidence for a
 * stalled conversation rather than as a marker of one.
 */
function hasEmphasis(text: string): boolean {
  if (/[!?]{2,}/.test(text)) return true;
  const words = text.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length < 2) return false;
  const shouted = words.filter((w) => /^[A-Z]{3,}$/.test(w));
  return shouted.length >= 2;
}

/** Words in a message, ignoring punctuation. */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Under this many words, a turn is short and direct rather than merely brief. */
export const BRIEF_WORD_LIMIT = 4;

/**
 * ...and under this many characters.
 *
 * Word count alone is calibrated for English and misreads every other language
 * here. Tamil is agglutinative: "எனக்கு மருத்துவ காப்பீடு வேண்டும்" — a
 * complete, ordinary sentence — is four words, and answering it in clipped
 * fragments because it looked terse would be the detector patronising someone
 * for the language they speak. Characters measure how much was actually said,
 * and they measure it the same way in every script.
 */
export const BRIEF_CHAR_LIMIT = 24;

/**
 * How this message was worded.
 *
 * Precedence is deliberate and not alphabetical. A message that is both stalled
 * and urgent is answered as stalled, because acknowledging what has not worked
 * is what unblocks it — answering faster without acknowledging is how a
 * conversation that was already going in circles goes round once more. Time
 * pressure outranks not-landing for the opposite reason: someone who says "just
 * tell me quickly, I don't follow all this" wants the answer first.
 *
 * `brief` is last because it is the weakest signal — a short message is only
 * short.
 */
export function detectSpeakingStyle(text: string | null | undefined): SpeakingStyle {
  const message = (text ?? "").trim();
  if (!message) return "normal";

  try {
    if (STALLED.test(message)) return "frustrated";
    if (hasEmphasis(message) && wordCount(message) >= 3) return "frustrated";
    if (TIME_PRESSURE.test(message)) return "urgent";
    if (NOT_LANDING.test(message) || NOT_LANDING_LOOSE.test(message)) return "confused";

    // A short turn with no question in it: "yes", "the blue one", "go ahead".
    // A short *question* is an ordinary question, not a terse one.
    if (
      wordCount(message) <= BRIEF_WORD_LIMIT &&
      message.length <= BRIEF_CHAR_LIMIT &&
      !message.includes("?")
    ) {
      return "brief";
    }

    return "normal";
  } catch {
    // A regex cannot realistically throw here, but the fallback is the whole
    // safety story of this file: anything unexpected becomes the behaviour
    // Aegis had before adaptation existed.
    return "normal";
  }
}

/**
 * Phrases whose whole purpose is to stop the advisor talking.
 *
 * "Wait." "Hold on." "Stop stop stop." A customer who cuts in with one of these
 * has not asked a question — they have asked for silence, and they are about to
 * say the real thing. Sending it to the orchestrator as a turn spends a paid
 * LLM call to have the advisor say "of course, go ahead" over the top of them,
 * which is precisely the talking-over that barge-in exists to end.
 *
 * Only matched when the phrase is the *entire* utterance. "Wait, does this
 * cover my mother?" is a question with a "wait" attached to it and must be
 * answered normally — the word carries no weight once a sentence follows it.
 */
const STOP_PHRASES = new Set([
  "wait", "hold on", "hold", "stop", "one second", "one sec", "just a second",
  "just a moment", "hang on", "sorry", "excuse me", "no no", "actually",
  // Thanglish and Tamil, as people actually cut in.
  "irunga", "konjam irunga", "nillu", "nirutthu", "wait pannunga",
  "இருங்க", "நில்லு",
]);

/**
 * Whether this transcript is a request for silence rather than a turn.
 *
 * Repetition is normal here and does not change the meaning — "stop stop stop"
 * is one instruction, not three — so a phrase repeated is collapsed before the
 * lookup.
 */
export function isStopPhrase(text: string | null | undefined): boolean {
  const cleaned = (text ?? "")
    .toLowerCase()
    .replace(/[.,!?;:]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!cleaned) return false;
  if (STOP_PHRASES.has(cleaned)) return true;

  // "stop stop stop" / "wait wait" — one word, said more than once.
  const words = cleaned.split(" ");
  const unique = new Set(words);
  if (unique.size === 1 && STOP_PHRASES.has(words[0])) return true;

  return false;
}

// ── The context a voice turn carries ─────────────────────────────────────────

/**
 * What the voice layer knows about a turn, assembled from state that already
 * exists elsewhere.
 *
 * Not a store and not a memory. Every field is read from something the runtime
 * or the stream already holds — the turn machine, the STT result, the live
 * stream — so there is nothing here to keep in sync and nothing to persist. It
 * is built for one request and discarded.
 */
export interface VoiceContext {
  /** How this turn was worded. */
  style: SpeakingStyle;
  /** What the transcription heard. Metadata: Aegis answers in English unless asked. */
  language: string | null;
  /** Always true — a typed turn has no voice context at all. */
  spoken: true;
  /** The advisor currently answering, from the live stream. */
  agentName: string | null;
  agentDomain: string | null;
  /** Where the middleware put this turn, when the engine has told us. */
  conversationState: string | null;
  intent: string | null;
  /** What the customer actually said, kept so a caller can log or show it. */
  transcript: string;
}

/** The part of a `VoiceContext` that crosses the wire. Nothing else needs to. */
export interface VoiceRequestMeta {
  style: SpeakingStyle;
  language?: string;
  spoken: true;
}

/** The wire form of a context, or null when the turn was typed. */
export function toRequestMeta(context: VoiceContext | null): VoiceRequestMeta | null {
  if (!context || !context.spoken) return null;
  return {
    style: context.style,
    ...(context.language ? { language: context.language } : {}),
    spoken: true,
  };
}

// ── Delivery ─────────────────────────────────────────────────────────────────

/**
 * How much unbroken text to let build up before speaking, for this style.
 *
 * The default lives in `lib/speech`; this only tightens it. A turn worded with
 * time pressure should not wait behind 220 characters of prose for its first
 * full stop, and a turn where something has not landed is easier to follow in
 * smaller pieces.
 */
export function maxUnspokenCharsFor(style: SpeakingStyle, fallback: number): number {
  if (style === "urgent") return Math.min(fallback, 120);
  if (style === "confused") return Math.min(fallback, 160);
  return fallback;
}

/**
 * Whether a reply hands the conversation back — i.e. ends on a question.
 *
 * The cue for turn-taking. A human advisor who asks something stops talking and
 * waits; a voice interface that asks and then sits mute has, from the
 * customer's side, simply stopped. Checked on the text rather than fetched from
 * the server, because the question mark is right there and a round trip to be
 * told about it would be slower and no more certain.
 *
 * Tamil and Thanglish questions end in `?` the same way, so no separate rule is
 * needed — the danda `।` ends statements, not questions.
 */
export function endsWithQuestion(text: string | null | undefined): boolean {
  const trimmed = (text ?? "").replace(/\[(?:RECOMMENDATION|DOCUMENT_REQUEST)\s*:[\s\S]*$/i, "").trim();
  if (!trimmed) return false;
  // Trailing quotes and brackets belong to the sentence they close.
  const withoutClosers = trimmed.replace(/["'”’)\]]+$/, "");
  return withoutClosers.endsWith("?");
}
