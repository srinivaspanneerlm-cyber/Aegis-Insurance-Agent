"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LOGIN_ROUTE } from "@/lib/routes";

/**
 * The portal's one route guard.
 *
 * Four pages used to carry their own copy of this effect and each raced the
 * session probe independently, so whether a signed-in customer reached a page
 * or was thrown back to sign in depended on which resolved first. There is one
 * copy now, and `isReady` is false until the session is actually known — no
 * page renders a half-loaded frame with nobody in it.
 *
 * `middleware.ts` already turned anonymous visitors away before the page was
 * sent. This is the second line: it covers a session that ended while the tab
 * was open, and the case where the cookie is present but no longer valid.
 *
 * Returns the signed-in user, or null while the answer is still unknown.
 */
export function useRequireAuth() {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // `replace`, not `push`: a visitor who was turned away should not be able
      // to press Back into the page that turned them away.
      router.replace(LOGIN_ROUTE);
    }
  }, [loading, isAuthenticated, router]);

  return { user, isReady: !loading && !!user };
}
