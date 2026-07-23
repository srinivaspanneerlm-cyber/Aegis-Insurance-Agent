/**
 * Canned "Sri AI" executive advisor replies for the Contact page demo chat.
 *
 * This is a self-contained, keyword-matched mock — it is intentionally NOT the
 * production AI engine (that lives behind the streaming/advisor workflow). Kept
 * as a pure function so the response mapping is easy to read and adjust in one
 * place, separate from the chat UI/state.
 */
export function getExecutiveResponse(query: string): string {
  const norm = query.toLowerCase();
  // Short greetings are matched as whole words, not substrings, so ordinary
  // words that merely contain them ("this", "hit", "they") don't trigger a
  // greeting instead of the branch the user actually wanted.
  const words = norm.split(/[^a-z]+/).filter(Boolean);
  const hasWord = (w: string) => words.includes(w);

  if (hasWord("hi") || hasWord("hey") || norm.includes("hello") || norm.includes("greet")) {
    return "Hello, I'm Sri AI, the Chief Executive AI Advisor at Aegis. I'm here to help you understand your options and get started, at your own pace. What can I help you with today?";
  }
  if (norm.includes("insurance") || norm.includes("guidance") || norm.includes("plan") || norm.includes("cover")) {
    return "Getting started is simple. Go to the Policies page and pick the advisor that fits your need — Sarah for health, Alex for motor, Ethan for travel, or Emma for home. Answer a few plain questions in a chat, and they'll put together a recommendation tailored to you.";
  }
  if (norm.includes("tech") || norm.includes("support") || norm.includes("error") || norm.includes("bug") || norm.includes("fail")) {
    return "Everything is up and running smoothly. If something isn't working, try refreshing the page or signing in again. If it still won't work, our team is happy to help — just let us know what you were trying to do.";
  }
  if (norm.includes("recommend") || norm.includes("recommendation") || norm.includes("card") || norm.includes("hologram")) {
    return "Our AI looks at your budget and what you need, then suggests a plan that fits — shown as a clear, easy-to-read card on screen. When you're ready, click 'Continue Secure Application' to move ahead. There's no obligation.";
  }
  if (norm.includes("consult") || norm.includes("intake") || norm.includes("checklist")) {
    return "To resolve your intake metrics, ensure you provide: your name (or sign in), your household matrix size, comfort budget boundaries (e.g. ₹850/mo), coverage goals, and risk preferences. The live checklist indicator in your sidebar will tick green as these are cleared.";
  }
  if (norm.includes("account") || norm.includes("login") || norm.includes("register") || norm.includes("auth")) {
    return "Aegis AI enforces strict digital vault security. You can register an administrative account on our portal to access your unified Underwriter Dashboard, audit telemetry metrics, and manage pre-approved insurance application submissions.";
  }
  return "Query processed through executive leadership channels. Aegis AI is committed to establishing an intuitive, emotionally intelligent protection gateway. Let me know how I can further refine your consultation workflow, or direct you to a specialized underwriter command desk.";
}
