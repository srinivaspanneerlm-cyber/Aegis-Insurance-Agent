import type { Page, APIRequestContext } from "@playwright/test";
import { ADMIN } from "./seed.mjs";

/**
 * Sign in without driving the login form.
 *
 * The login journey has its own test. Repeating it before every other spec
 * would mean one broken form failed the whole suite and told you nothing about
 * the twenty screens that were actually fine — so the rest of the tests
 * authenticate through the API and put the cookies straight into the browser.
 *
 * This is a shortcut through the *interface*, never through the check: the API
 * verifies the password exactly as it would for anybody, and the cookies handed
 * to the browser are the ones it issued.
 */
export async function signIn(page: Page, request: APIRequestContext, backend: string) {
  const response = await request.post(`${backend}/api/v1/auth/login`, {
    // The realm is part of the credential check: an account is admitted through
    // its own portal and no other, so a login with no realm defaults to CUSTOMER
    // and this ENTERPRISE account is refused with WRONG_REALM.
    data: { email: ADMIN.email, password: ADMIN.password, realm: "ENTERPRISE" },
    headers: { Origin: new URL(page.url() || "http://localhost:3903").origin },
  });
  if (!response.ok()) {
    throw new Error(`e2e sign-in failed: ${response.status()} ${await response.text()}`);
  }

  const cookies = await request.storageState();
  await page.context().addCookies(
    cookies.cookies.map((c) => ({ ...c, domain: "localhost", path: "/" }))
  );
}
