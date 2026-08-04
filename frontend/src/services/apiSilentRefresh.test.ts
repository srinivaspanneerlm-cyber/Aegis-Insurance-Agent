import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { apiClient, authService } from "./api";

/**
 * An access token that has expired is the ordinary state of a long session, not
 * a reason to interrupt anyone. The backend has always been able to renew one
 * — the client simply never asked, so a customer who stayed signed in past the
 * token's lifetime was returned to the sign-in screen for no reason.
 */

const realAdapter = apiClient.defaults.adapter;

interface Call {
  url: string;
  config: InternalAxiosRequestConfig;
}

/** Every request the adapter saw, in order. */
let calls: Call[] = [];
/** URLs the adapter should answer 401 to; anything else succeeds. */
let unauthorized: Set<string>;
let authErrors = 0;

const countAuthError = () => {
  authErrors += 1;
};

function ok(config: InternalAxiosRequestConfig, data: unknown = {}): AxiosResponse {
  return {
    data: { status: "success", data },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

/**
 * Stands in for the API. A URL in `unauthorized` answers 401 the way an expired
 * access token does; everything else succeeds. A custom adapter must reject on
 * its own — axios only applies `validateStatus` to its built-in transports.
 */
const adapter: AxiosAdapter = async (config) => {
  const url = config.url ?? "";
  calls.push({ url, config });

  if (unauthorized.has(url)) {
    throw new AxiosError("Request failed with status code 401", AxiosError.ERR_BAD_REQUEST, config, null, {
      data: { message: "You are not logged in. Please log in to gain access." },
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      config,
    });
  }

  return ok(config);
};

beforeEach(() => {
  calls = [];
  authErrors = 0;
  unauthorized = new Set();
  apiClient.defaults.adapter = adapter;
  window.addEventListener("aegis_auth_error", countAuthError);
});

afterEach(() => {
  window.removeEventListener("aegis_auth_error", countAuthError);
  apiClient.defaults.adapter = realAdapter;
});

/** How many times the renewal endpoint was called. */
const renewals = () => calls.filter((c) => c.url === "/auth/refresh").length;

describe("silent renewal", () => {
  it("renews and replays the request, so the customer never notices", async () => {
    // Expired access token: the first attempt 401s, the renewal succeeds, and
    // the replay is allowed through.
    let firstAttempt = true;
    apiClient.defaults.adapter = async (config) => {
      calls.push({ url: config.url ?? "", config });
      if (config.url === "/policies" && firstAttempt) {
        firstAttempt = false;
        throw new AxiosError("401", AxiosError.ERR_BAD_REQUEST, config, null, {
          data: { message: "Invalid security token. Please log in again." },
          status: 401,
          statusText: "Unauthorized",
          headers: {},
          config,
        });
      }
      return ok(config);
    };

    const res = await apiClient.get("/policies");

    expect(res.status).toBe(200);
    expect(calls.map((c) => c.url)).toEqual(["/policies", "/auth/refresh", "/policies"]);
    expect(authErrors).toBe(0);
  });

  it("renews once for a burst of requests, not once each", async () => {
    // Renewal rotates the refresh token, so a second concurrent renewal would
    // invalidate the first and sign the customer out. They share one.
    const expired = new Set(["/policies", "/leads", "/chat"]);
    apiClient.defaults.adapter = async (config) => {
      const url = config.url ?? "";
      calls.push({ url, config });
      if (expired.has(url) && !config.wasRetriedAfterRefresh) {
        throw new AxiosError("401", AxiosError.ERR_BAD_REQUEST, config, null, {
          data: { message: "Invalid security token." },
          status: 401,
          statusText: "Unauthorized",
          headers: {},
          config,
        });
      }
      return ok(config);
    };

    await Promise.all([
      apiClient.get("/policies"),
      apiClient.get("/leads"),
      apiClient.get("/chat"),
    ]);

    expect(renewals()).toBe(1);
    expect(authErrors).toBe(0);
  });

  it("signs out exactly once when the session cannot be renewed", async () => {
    // Refresh token expired, revoked or already used: this really is the end.
    unauthorized = new Set(["/policies", "/auth/refresh"]);

    await expect(apiClient.get("/policies")).rejects.toThrow();

    expect(renewals()).toBe(1);
    // Once — from the request that was refused, not also from the renewal.
    expect(authErrors).toBe(1);
  });

  it("does not retry a request forever", async () => {
    // A 401 that survives a successful renewal is a real refusal, not an
    // expired token. One replay, then stop.
    unauthorized = new Set(["/policies"]);

    await expect(apiClient.get("/policies")).rejects.toThrow();

    expect(calls.filter((c) => c.url === "/policies")).toHaveLength(2);
    expect(renewals()).toBe(1);
  });

  it("lets a returning visitor back in without a sign-in screen", async () => {
    // The boot probe finds the access token expired. Renewal succeeds, the
    // probe is replayed, and the session survives — this is the auto-login.
    let firstProbe = true;
    apiClient.defaults.adapter = async (config) => {
      calls.push({ url: config.url ?? "", config });
      if (config.url === "/auth/me" && firstProbe) {
        firstProbe = false;
        throw new AxiosError("401", AxiosError.ERR_BAD_REQUEST, config, null, {
          data: { message: "Invalid security token." },
          status: 401,
          statusText: "Unauthorized",
          headers: {},
          config,
        });
      }
      return ok(config, { user: { id: "u1", name: "Meena Rajan" } });
    };

    const me = await authService.getMe();

    expect(me.user.name).toBe("Meena Rajan");
    expect(renewals()).toBe(1);
    expect(authErrors).toBe(0);
  });

  it("stays quiet for a visitor who was never signed in", async () => {
    // Nobody signed in: the probe 401s and so does renewal. That is the
    // ordinary state of every reader of the public pages, not a lost session.
    unauthorized = new Set(["/auth/me", "/auth/refresh"]);

    await expect(authService.getMe()).rejects.toThrow();

    expect(authErrors).toBe(0);
  });
});
