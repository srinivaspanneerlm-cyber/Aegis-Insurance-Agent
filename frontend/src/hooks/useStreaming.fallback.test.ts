/**
 * What the advisor says when it cannot answer.
 *
 * This is the behaviour that cost a full investigation: a signed-out customer
 * saw "I'm having a little trouble right now", concluded the AI was broken, and
 * so did we — while the AI service was answering perfectly. The cause has to be
 * distinguishable from the message.
 */
import { describe, expect, it } from "vitest";
import { _advisorFallback, AdvisorError } from "./useStreaming";

describe("advisor fallback", () => {
  it("tells a signed-out customer to sign in, not that the AI is broken", () => {
    expect(_advisorFallback(new AdvisorError(401))).toMatch(/sign in/i);
    expect(_advisorFallback(new AdvisorError(401))).not.toMatch(/went wrong|trouble/i);
  });

  it("treats a forbidden response the same way", () => {
    expect(_advisorFallback(new AdvisorError(403))).toMatch(/sign in/i);
  });

  it("names rate limiting as rate limiting", () => {
    expect(_advisorFallback(new AdvisorError(429))).toMatch(/moment|lot of questions/i);
  });

  it("owns a server fault rather than blaming the connection", () => {
    expect(_advisorFallback(new AdvisorError(500))).toMatch(/our side/i);
    expect(_advisorFallback(new AdvisorError(503))).toMatch(/our side/i);
  });

  it("falls back to a connection problem when there is no status", () => {
    expect(_advisorFallback(new Error("network"))).toMatch(/connection/i);
    expect(_advisorFallback(null)).toMatch(/connection/i);
  });
});
