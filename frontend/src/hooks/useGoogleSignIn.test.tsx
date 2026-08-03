import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { useGoogleSignIn } from "./useGoogleSignIn";

/**
 * The bug this suite exists for: the homepage login modal used to render a
 * *simulated* Google button that waited a moment and then told the customer to
 * use their password instead. It looked like Google sign-in and never once
 * spoke to Google. These tests assert the real contract — a credential from
 * Google reaches the caller — so a lookalike cannot come back.
 */

interface Captured {
  callback?: (r: { credential?: string }) => void;
  clientId?: string;
  rendered: number;
}

const captured: Captured = { rendered: 0 };

const installGis = () => {
  captured.rendered = 0;
  captured.callback = undefined;
  (window as unknown as { google: unknown }).google = {
    accounts: {
      id: {
        initialize: (cfg: { client_id: string; callback: (r: { credential?: string }) => void }) => {
          captured.clientId = cfg.client_id;
          captured.callback = cfg.callback;
        },
        renderButton: () => {
          captured.rendered += 1;
        },
      },
    },
  };
};

function Harness({
  onCredential,
  onError,
  enabled = true,
}: {
  onCredential: (c: string) => void | Promise<void>;
  onError?: (m: string) => void;
  enabled?: boolean;
}) {
  const { containerRef, status } = useGoogleSignIn({ onCredential, onError, enabled });
  return (
    <div>
      <span data-testid="status">{status}</span>
      <div data-testid="slot" ref={containerRef} />
    </div>
  );
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  installGis();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  delete (window as unknown as { google?: unknown }).google;
});

describe("useGoogleSignIn", () => {
  it("mounts Google's own button rather than one of ours", async () => {
    render(<Harness onCredential={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(captured.rendered).toBeGreaterThan(0);
  });

  it("initialises against the configured client id", async () => {
    render(<Harness onCredential={vi.fn()} />);
    await waitFor(() => expect(captured.callback).toBeDefined());
    expect(captured.clientId).toBe("test-client-id.apps.googleusercontent.com");
  });

  it("hands the credential straight to the caller", async () => {
    const onCredential = vi.fn();
    render(<Harness onCredential={onCredential} />);
    await waitFor(() => expect(captured.callback).toBeDefined());

    captured.callback!({ credential: "a.signed.google.token" });
    await waitFor(() => expect(onCredential).toHaveBeenCalledWith("a.signed.google.token"));
  });

  it("reports a reply with no token instead of silently doing nothing", async () => {
    const onError = vi.fn();
    render(<Harness onCredential={vi.fn()} onError={onError} />);
    await waitFor(() => expect(captured.callback).toBeDefined());

    captured.callback!({});
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringMatching(/token/i)));
  });

  it("surfaces a rejected exchange to the caller", async () => {
    const onError = vi.fn();
    const onCredential = vi.fn().mockRejectedValue(new Error("This account has been deactivated."));
    render(<Harness onCredential={onCredential} onError={onError} />);
    await waitFor(() => expect(captured.callback).toBeDefined());

    captured.callback!({ credential: "tok" });
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith("This account has been deactivated.")
    );
  });

  it("does not mount while disabled, so a closed modal costs nothing", async () => {
    render(<Harness onCredential={vi.fn()} enabled={false} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(captured.rendered).toBe(0);
  });
});
