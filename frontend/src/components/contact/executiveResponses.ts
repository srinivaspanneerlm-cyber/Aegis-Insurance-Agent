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
    return "Greetings. I am Sri AI, Chief Executive AI Advisor. I orchestrate the high-fidelity risk valuation matrices here at Aegis AI. How can I facilitate your onboarding or calibrate your underwriter desk today?";
  }
  if (norm.includes("insurance") || norm.includes("guidance") || norm.includes("plan") || norm.includes("cover")) {
    return "Aegis AI operates on a conversational 'Talk-to-Unlock' private gate. To unlock coverages, navigate to the Policies Portal, select your specialized underwriter (Alex, Sarah, Ethan, or Emma), and complete the conversational intake parameters checklist. My models will then compile a custom holographic recommendation package for you.";
  }
  if (norm.includes("tech") || norm.includes("support") || norm.includes("error") || norm.includes("bug") || norm.includes("fail")) {
    return "Underwriting channels are fully active. All endpoints—including the Node.js API server and our Gemini fallback actuarial controllers—are healthy and responding under 45ms. If you experience a token mismatch, please clear your browser cache or re-authenticate in the Vault Room.";
  }
  if (norm.includes("recommend") || norm.includes("recommendation") || norm.includes("card") || norm.includes("hologram")) {
    return "Our recommendation engine parses customer-specified budget bounds and risk metrics in real-time, emitting structured JSON payloads formatted inside secure tags. This renders the premium holographic card in your console. Simply click 'Continue Secure Application' to lock in your pre-approved pricing.";
  }
  if (norm.includes("consult") || norm.includes("intake") || norm.includes("checklist")) {
    return "To resolve your intake metrics, ensure you provide: your name (or sign in), your household matrix size, comfort budget boundaries (e.g. ₹850/mo), coverage goals, and risk preferences. The live checklist indicator in your sidebar will tick green as these are cleared.";
  }
  if (norm.includes("account") || norm.includes("login") || norm.includes("register") || norm.includes("auth")) {
    return "Aegis AI enforces strict digital vault security. You can register an administrative account on our portal to access your unified Underwriter Dashboard, audit telemetry metrics, and manage pre-approved insurance application submissions.";
  }
  return "Query processed through executive leadership channels. Aegis AI is committed to establishing an intuitive, emotionally intelligent protection gateway. Let me know how I can further refine your consultation workflow, or direct you to a specialized underwriter command desk.";
}
