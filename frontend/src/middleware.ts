import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, LOGIN_ROUTE, isProtectedPath } from "@/lib/routes";

/**
 * Stops a protected page from ever reaching a visitor without a session.
 *
 * The in-page guards it replaces could only act after the page had already been
 * sent, mounted and rendered — which is why a protected screen used to flash up
 * and then bounce. This runs at the edge, before any of that.
 *
 * It reads only whether a session cookie is present. It cannot and must not
 * decide whether the session is *valid*: that requires the signing secret,
 * which belongs to the API and nowhere else. The API still authorises every
 * request; this only spares the customer a redirect, and spares an anonymous
 * visitor a page they cannot use.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPath(pathname)) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE_NAME)) return NextResponse.next();

  // Remember where they were going, so signing in finishes the journey they
  // started rather than dropping them on the dashboard.
  const url = request.nextUrl.clone();
  url.pathname = LOGIN_ROUTE;
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

/**
 * Kept in step with `PROTECTED_PREFIXES` by the test in `routes.test.ts` —
 * Next.js requires these patterns to be statically analysable, so they cannot
 * be generated from that list at runtime.
 */
export const config = {
  matcher: [
    "/consumer-dashboard/:path*",
    "/consumer/:path*",
    "/dashboard/:path*",
    "/onboarding/:path*",
  ],
};
