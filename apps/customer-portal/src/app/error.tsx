"use client";

import { useEffect } from "react";
import { Button } from "@aegis/ui";

/**
 * Route-level error boundary.
 *
 * Next renders this in place of the segment that threw, so the shell — header,
 * navigation, theme — survives and the customer is not stranded on a blank page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reporting hook. The digest correlates this screen with the server log
    // that holds the detail we deliberately do not show the customer.
    console.error("[aegis] Route error:", error.digest ?? error.message);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center"
    >
      <h1 className="text-h2 font-bold">Something went wrong</h1>
      <p className="max-w-md text-body text-content-secondary">
        This is our fault, not yours. Nothing you entered has been lost — please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
      {error.digest ? (
        <p className="text-caption text-content-muted">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
