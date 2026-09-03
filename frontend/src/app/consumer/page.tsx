"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Spinner } from "@/components/shared/Spinner";
import { ConsumerGreeting, QuickActionGrid } from "@/components/consumer";
import { CONSUMER_TRUST_NOTE } from "@/lib/consumer/quickActions";
import { useRequireAuth } from "@/hooks/useRequireAuth";

/**
 * Aegis Consumer — the home screen.
 *
 * Deliberately a different surface from `/consumer-dashboard`, and not a
 * replacement for it. That console is built for someone comfortable with a
 * sidebar, six panels and language like "Overview Console"; this is built for a
 * first-time buyer on a phone, possibly a senior citizen, possibly reading in
 * their second language. Five choices, large type, one screen, nothing to
 * learn. Trying to serve both audiences from one layout is how you end up
 * serving neither.
 *
 * `/consumer` was already in `PROTECTED_PREFIXES` and already had a middleware
 * matcher covering it — the prefix existed for the pages beneath it and the
 * index simply had nothing to serve. So this page needed no routing change at
 * all: the edge guard turns anonymous visitors away before it is ever sent, and
 * `useRequireAuth` covers the session that ended while the tab sat open.
 */
export default function ConsumerHomePage() {
  const { user, isReady } = useRequireAuth();

  // Nothing renders until the session is actually known. A half-drawn screen
  // with an empty greeting, followed by a bounce to sign-in, is the exact
  // flicker `useRequireAuth` exists to prevent.
  if (!isReady) {
    return (
      <div className="flex min-h-screen flex-col justify-between bg-surface text-content">
        <Navbar />
        <main id="main-content" className="flex flex-grow items-center justify-center">
          <h1 className="sr-only">Aegis Consumer</h1>
          <Spinner className="h-8 w-8 border-2 border-brand" />
          <span className="sr-only">Loading your page</span>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-surface text-content">
      <Navbar />

      <main id="main-content" className="flex-grow">
        {/* Narrow by design. `max-w-2xl` keeps the line length readable on a
            desktop without the layout becoming a second, sparser console.
            `pt-32` clears the fixed navbar; `pb-20` keeps the last card off the
            bottom edge, where a thumb rests. */}
        <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-32 sm:px-6">
          <ConsumerGreeting name={user?.name ?? null} />

          <section className="mt-8" aria-labelledby="consumer-actions">
            <h2
              id="consumer-actions"
              className="mb-3 px-1 text-xs font-bold uppercase tracking-widest text-content-subtle"
            >
              What would you like to do?
            </h2>
            <QuickActionGrid />
          </section>

          {/* A line rather than a sixth card. The grid above is the whole
              navigation for somebody using an insurance product for the first
              time, and five choices is the reason it works. */}
          <p className="mt-6 px-1 text-sm font-medium text-content-muted">
            Not sure what something means?{" "}
            <Link
              href="/consumer/ask"
              data-testid="ask-link"
              className="font-bold text-brand underline-offset-4 hover:underline"
            >
              Ask about motor insurance
            </Link>{" "}
            — six things explained in plain words.
          </p>

          <p className="mt-8 rounded-4xl border border-line bg-surface-sunken/50 px-5 py-4 text-xs font-medium leading-relaxed text-content-muted">
            {CONSUMER_TRUST_NOTE}
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
