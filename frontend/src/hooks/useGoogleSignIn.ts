"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Google Identity Services, in one place.
 *
 * This used to live inline in the /login page while the homepage modal had a
 * *simulated* Google button that waited 900ms and then told the customer to use
 * their password instead. Two surfaces, one real — so the button most people
 * actually clicked never talked to Google at all. One hook now backs both.
 *
 * The flow is popup + ID token, not a redirect: the browser gets a signed token
 * from Google and posts it to our own backend, which verifies the signature and
 * audience and issues an Aegis session. That is why no OAuth *client secret*
 * exists anywhere in this codebase, and why `redirect_uris` in the Google Cloud
 * config is irrelevant to us — only `javascript_origins` matters.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";

/**
 * Read at call time rather than module scope. Next inlines `NEXT_PUBLIC_*`
 * wherever it appears, so this costs nothing — and it keeps the hook testable,
 * which a value captured once at import is not.
 */
const clientId = (): string => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

// ── Minimal typings for the GIS global, so we integrate without `any`. ───────
interface GoogleIdConfig {
  client_id: string;
  callback: (response: { credential?: string }) => void;
}
interface GoogleButtonOptions {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "small" | "medium" | "large";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
}
interface GoogleAccountsId {
  initialize: (config: GoogleIdConfig) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
  cancel?: () => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

export type GoogleSignInStatus =
  /** No client id configured — the caller should hide the button entirely. */
  | "unconfigured"
  /** Script in flight. */
  | "loading"
  /** Google's button is mounted and clickable. */
  | "ready"
  /** The script could not be reached (offline, blocked, ad-blocker). */
  | "unavailable";

export interface UseGoogleSignInOptions {
  /** Receives the Google ID token. Exchange it for a session server-side. */
  onCredential: (credential: string) => void | Promise<void>;
  onError?: (message: string) => void;
  /** Matches the button chrome to the page. */
  appearance?: GoogleButtonOptions;
  /** Skip mounting entirely (e.g. a closed modal). */
  enabled?: boolean;
}

export interface UseGoogleSignIn {
  /** Attach to the element Google's real button should render into. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  status: GoogleSignInStatus;
}

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.id) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("gis failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gis failed"));
    document.head.appendChild(script);
  });
}

export function useGoogleSignIn({
  onCredential,
  onError,
  appearance,
  enabled = true,
}: UseGoogleSignInOptions): UseGoogleSignIn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<GoogleSignInStatus>(
    clientId() ? "loading" : "unconfigured"
  );

  // Keep the handlers in refs so remounting the button is driven only by the
  // things that actually change how it looks.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const appearanceKey = JSON.stringify(appearance ?? {});

  const mount = useCallback(() => {
    const gid = window.google?.accounts?.id;
    const container = containerRef.current;
    if (!gid || !container) return;

    gid.initialize({
      client_id: clientId(),
      callback: async (response) => {
        if (!response.credential) {
          onErrorRef.current?.("Google did not return a sign-in token. Please try again.");
          return;
        }
        try {
          await onCredentialRef.current(response.credential);
        } catch (err) {
          onErrorRef.current?.(
            err instanceof Error ? err.message : "Google sign-in failed. Please try again."
          );
        }
      },
    });

    container.innerHTML = "";

    // Google renders into an element of a fixed pixel width, so a hardcoded
    // number is only ever right at one viewport: it left the button visibly
    // narrower than the email and password fields directly beneath it, which
    // reads as a third-party widget bolted on rather than part of the form.
    // Measuring the space the caller actually gave us keeps the two edges
    // aligned at every width. The clamp is Google's own supported range.
    const measured = Math.round(container.getBoundingClientRect().width);
    const fitted = measured >= 200 ? { width: Math.min(400, measured) } : {};

    gid.renderButton(container, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      shape: "pill",
      logo_alignment: "center",
      ...fitted,
      // An explicit appearance from the caller still wins over the measurement.
      ...(appearance ?? {}),
    });
    setStatus("ready");
  }, [appearance]);

  useEffect(() => {
    if (!enabled || !clientId()) {
      if (!clientId()) setStatus("unconfigured");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    loadGis()
      .then(() => {
        if (!cancelled) mount();
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });

    return () => {
      cancelled = true;
    };
    // `appearanceKey` stands in for the appearance object so a fresh literal on
    // every render does not remount Google's button each time.
  }, [enabled, appearanceKey, mount]);

  // A misconfigured origin is the single most common reason this silently does
  // nothing: Google refuses to run on an origin the console has not authorised,
  // and says so only in the browser console. Point at it in development.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !clientId()) return;
    const origin = window.location.origin;
    if (origin.startsWith("http://localhost") && !origin.endsWith(":3000")) {
      console.warn(
        `[Aegis] Google sign-in is served from ${origin}, but the OAuth client ` +
          `authorises http://localhost:3000. Google will refuse to sign in here. ` +
          `Run the app on port 3000, or add ${origin} to "Authorised JavaScript origins".`
      );
    }
  }, []);

  // Google's button is drawn once at a fixed pixel width, so it does not follow
  // the form when the window changes — rotate a phone or drag a window wider and
  // it stays the size it was born at, no longer flush with the fields under it.
  // Redrawing on a real width change keeps them aligned. The threshold avoids
  // reacting to sub-pixel noise, and re-rendering does not itself alter the
  // container's width, so this cannot feed itself.
  useEffect(() => {
    const container = containerRef.current;
    if (status !== "ready" || !container || typeof ResizeObserver === "undefined") return;

    let last = container.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const now = container.getBoundingClientRect().width;
      if (Math.abs(now - last) < 8) return;
      last = now;
      mount();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [status, mount]);

  return { containerRef, status };
}
