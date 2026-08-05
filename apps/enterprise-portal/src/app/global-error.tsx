"use client";

/**
 * The 500 of last resort — when the root layout itself fails.
 *
 * It replaces the entire document, which is why it renders its own <html> and
 * <body> and uses inline styles: at this point the layout, the theme provider
 * and possibly the stylesheet are all gone, so it cannot rely on any of them.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#020617",
          color: "#f8fafc",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>
            Aegis is temporarily unavailable
          </h1>
          <p style={{ opacity: 0.75, lineHeight: 1.6, marginBottom: "1.5rem" }}>
            Something failed at the top level of the application. Our team is alerted automatically.
            Your account and your data are unaffected.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "0.75rem",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "#f8fafc",
              color: "#020617",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1rem", fontSize: "0.8125rem", opacity: 0.5 }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
