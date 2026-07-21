"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself. It replaces
 * the whole document, so it must render its own <html>/<body> and can't rely on
 * app styles or providers being present — hence the self-contained inline look.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f19",
          color: "#f1f5f9",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "26rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 800, margin: "0 0 0.5rem" }}>
            The app ran into a problem
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
            An unexpected error stopped the page from loading. Reloading usually clears it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: "0.75rem",
              background: "#2563eb",
              color: "#fff",
              padding: "0.85rem 1.75rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
