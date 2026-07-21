"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { EmptyState, Button } from "@/components/ui";

/**
 * Route-level error boundary. Next renders this when a segment throws during
 * render/data-loading. `reset()` re-attempts the segment; we also offer a way
 * home in case the failure is persistent.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface it for logging/observability; details stay out of the UI.
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-surface text-content px-6">
      <EmptyState
        icon={<AlertTriangle className="w-6 h-6 text-rose-500" />}
        title="Something went wrong"
        description="We hit an unexpected error loading this page. You can try again, or head back home."
        action={
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={reset}>
              Try again
            </Button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-transparent border border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 py-3.5 px-7 text-xs font-bold uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              Back to home
            </Link>
          </div>
        }
      />
    </main>
  );
}
