import { test, expect } from "@playwright/test";
import { signIn } from "../fixtures/auth";
import { TENANT } from "../fixtures/seed.mjs";

/**
 * The three screens changed in Phase 5 and never seen rendered.
 *
 * Tasks 11 and 12 altered what the dashboard, products and security pages show,
 * and every check that followed was an HTTP check. The API sending the right
 * figure and the screen putting it in front of somebody are different claims,
 * and only the second one is the product.
 */
const BACKEND = "http://localhost:5900";

/**
 * Navigate, tolerating the dev server compiling the route.
 *
 * `next dev` builds a route the first time anybody asks for it, and a
 * navigation that arrives mid-compile is aborted rather than served. That is a
 * property of the development server, not of the product, so retrying once is
 * honest — it is not papering over a flaky page, it is waiting for a compiler.
 */
async function visit(page: import("@playwright/test").Page, path: string) {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded" });
  } catch (error) {
    if (!String(error).includes("ERR_ABORTED")) throw error;
    await page.goto(path, { waitUntil: "domcontentloaded" });
  }
}

test.beforeEach(async ({ page, request }) => {
  await page.goto("/");
  await signIn(page, request, BACKEND);
});

test.describe("the console opens", () => {
  test("the dashboard renders the tenant's own figures", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Seeded: one employee, one branch. A screen showing the platform's numbers
    // instead of this tenant's would not show these.
    await expect(page.getByText(TENANT.branch)).toBeVisible();
  });

  test("the average resolution states what it is an average of", async ({ page }) => {
    // Task 11 capped the sample behind this figure, so the card now says how
    // many cases it covers. Four were seeded, all resolved.
    await page.goto("/");
    await expect(page.getByText(/Over \d+ resolved case\(s\), last 30 days/)).toBeVisible();
  });

  test("an insurer's product count is this tenant's own", async ({ page }) => {
    // The Phase 5 task 12 leak, seen from the screen: a rival sells the same
    // insurer, so a count that lost its tenant would read one higher.
    await visit(page, "/products");
    // The name alone also appears on every product row, so the badge — name and
    // count together — is both the unique locator and the actual claim.
    await expect(page.getByText(`${TENANT.insurer} · ${TENANT.products}`)).toBeVisible();
    await expect(page.getByText(/Each figure is your own products from that insurer/)).toBeVisible();
  });

  test("the security page says what its figures cannot see", async ({ page }) => {
    // Task 12 chose disclosure over inventing attribution. A quiet security
    // screen during a stuffing run is worse than none, because it reassures.
    await visit(page, "/security");
    await expect(page.getByText("What these figures do not include")).toBeVisible();
    await expect(page.getByText(/matching no account belong to no organisation/)).toBeVisible();
  });
});

test.describe("the console refuses what it should", () => {
  test("a signed-out visitor is sent to sign in, not shown the console", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await page.waitForURL(/3905\/login/, { timeout: 20_000 });
    expect(page.url()).toContain("portal=ENTERPRISE");
  });

  test("AI monitoring is not offered to an administrator who cannot use it", async ({ page }) => {
    // `/ai-systems` needs platform.configure, which no ENTERPRISE role holds.
    // The navigation is permission-gated so nobody is shown a link that 403s.
    await page.goto("/");
    await expect(page.getByRole("navigation").getByText("AI Agents")).toHaveCount(0);
  });
});
