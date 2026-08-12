import type { Page } from "@playwright/test";

/**
 * Navigate, tolerating the dev server compiling the route.
 *
 * `next dev` builds a route the first time anybody asks for it, and a
 * navigation that arrives mid-compile is aborted rather than served. That is a
 * property of the development server, not of the product, so retrying once is
 * honest — it is not papering over a flaky page, it is waiting for a compiler.
 */
export async function visit(page: Page, path: string) {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded" });
  } catch (error) {
    const message = String(error);
    // Same tolerance for the guard as for the compiler. A navigation that
    // starts before the session cookie has settled is answered by the route
    // guard sending the browser to identity, and Playwright reports the first
    // navigation as "interrupted by another navigation". The cookie is there by
    // the time that unwinds, so asking again lands on the page — retrying is
    // waiting for the sign-in to take effect, not ignoring a real redirect. A
    // genuinely unauthenticated run still fails, because the second attempt is
    // redirected too and the assertions that follow never find their console.
    const raceable =
      message.includes("ERR_ABORTED") || message.includes("interrupted by another navigation");
    if (!raceable) throw error;
    await page.goto(path, { waitUntil: "domcontentloaded" });
  }
}
