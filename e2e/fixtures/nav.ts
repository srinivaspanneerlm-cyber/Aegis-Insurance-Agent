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
    if (!String(error).includes("ERR_ABORTED")) throw error;
    await page.goto(path, { waitUntil: "domcontentloaded" });
  }
}
