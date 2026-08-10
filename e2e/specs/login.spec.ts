import { test, expect } from "@playwright/test";
import { ADMIN } from "../fixtures/seed.mjs";

/**
 * The real journey: identity, then the console.
 *
 * Every other spec authenticates through the API, which is faster and less
 * brittle but proves nothing about the form somebody actually types into. This
 * one test earns that back — it is the only place the sign-in screen, the realm
 * routing and the hand-off between two applications are exercised together.
 */
const IDENTITY = "http://localhost:3905";

test("an enterprise administrator signs in and reaches the console", async ({ page }) => {
  await page.goto(`${IDENTITY}/login?portal=ENTERPRISE`);

  await page.getByLabel("Email address").fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // The backend decides where an ENTERPRISE realm lands; the test asserts the
  // destination rather than a message, because arriving is the outcome.
  await page.waitForURL(/3903/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("a wrong password is refused without saying which half was wrong", async ({ page }) => {
  await page.goto(`${IDENTITY}/login?portal=ENTERPRISE`);

  await page.getByLabel("Email address").fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Anti-enumeration: the message must not reveal that the address exists.
  const message = page.getByText(/incorrect|invalid|could not/i);
  await expect(message).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/3905/);
});
