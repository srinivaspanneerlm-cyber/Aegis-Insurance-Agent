import { test, expect } from "@playwright/test";
import { signIn } from "../fixtures/auth";
import { visit } from "../fixtures/nav";

/**
 * The console at the three widths people actually use it at.
 *
 * Static analysis of the CSS says the layout *should* hold — off-canvas nav
 * below `lg`, `overflow-x-auto` on every table — but a class name is a claim
 * about the DOM, not a measurement of it. The one objective, viewport-agnostic
 * signal that a layout has broken is content wider than the window: nothing
 * legitimate on this console needs the page itself to scroll sideways, because
 * every table already owns its own horizontal scroll.
 */
const BACKEND = "http://localhost:5900";

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

const PAGES = ["/", "/customers", "/claims", "/products", "/security"];

test.beforeEach(async ({ page, request }) => {
  await page.goto("/");
  await signIn(page, request, BACKEND);
});

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`at ${name} (${viewport.width}×${viewport.height})`, () => {
    test.use({ viewport });

    for (const path of PAGES) {
      test(`${path || "/"} has no horizontal overflow`, async ({ page }) => {
        await visit(page, path);
        // Real content, not the loading skeleton — the scroll width of three
        // placeholder bars says nothing about the page it becomes.
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return { scroll: doc.scrollWidth, viewport: doc.clientWidth };
        });
        expect(
          overflow.scroll,
          `page is ${overflow.scroll}px wide in a ${overflow.viewport}px viewport`
        ).toBeLessThanOrEqual(overflow.viewport);
      });
    }

    test("the navigation is reachable", async ({ page }) => {
      await visit(page, "/");
      if (viewport.width < 1024) {
        // Below the `lg` breakpoint the rail is off-canvas; the toggle in the
        // header is the only path to it, and it must still be there to press.
        await page.getByRole("button", { name: /open navigation/i }).click();
      }
      await expect(page.getByRole("navigation", { name: "Console" })).toBeVisible();
    });
  });
}
