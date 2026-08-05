import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { apiClient, ReauthRequiredError } from "./api";

/**
 * "Please confirm it's you" and "your session is over" arrive as the same 401.
 *
 * If the client cannot tell them apart it does the worst possible thing with
 * the first one: burns a single-use refresh token trying to fix a session that
 * was never broken, then signs the customer out — at the precise moment they
 * were being asked to be careful. These tests are about that distinction and
 * nothing else.
 */

const realAdapter = apiClient.defaults.adapter;

let calls: string[] = [];
let authErrors = 0;
const countAuthError = () => {
  authErrors += 1;
};

function ok(config: InternalAxiosRequestConfig): AxiosResponse {
  return {
    data: { status: "success", data: {} },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

function unauthorized(config: InternalAxiosRequestConfig, body: Record<string, unknown>) {
  return new AxiosError("401", AxiosError.ERR_BAD_REQUEST, config, null, {
    data: body,
    status: 401,
    statusText: "Unauthorized",
    headers: {},
    config,
  });
}

beforeEach(() => {
  calls = [];
  authErrors = 0;
  window.addEventListener("aegis_auth_error", countAuthError);
});

afterEach(() => {
  window.removeEventListener("aegis_auth_error", countAuthError);
  apiClient.defaults.adapter = realAdapter;
});

/** Answers every request with REAUTH_REQUIRED. */
const reauthAdapter: AxiosAdapter = async (config) => {
  calls.push(config.url ?? "");
  throw unauthorized(config, {
    status: "fail",
    code: "REAUTH_REQUIRED",
    message: "Please confirm it's you before completing this action.",
  });
};

describe("a 401 that means 'confirm it's you'", () => {
  it("is reported as its own kind of error", async () => {
    // A caller has to decide what to do about it. Folded into the generic
    // error path, a confirmation prompt silently becomes a failure message.
    apiClient.defaults.adapter = reauthAdapter;

    await expect(apiClient.delete("/leads/abc")).rejects.toBeInstanceOf(ReauthRequiredError);
  });

  it("does not spend the refresh token trying to fix it", async () => {
    // The session is fine. Renewing rotates a single-use token for nothing and
    // can strand the customer's other tabs.
    apiClient.defaults.adapter = reauthAdapter;

    await expect(apiClient.delete("/leads/abc")).rejects.toThrow();
    expect(calls).toEqual(["/leads/abc"]);
    expect(calls).not.toContain("/auth/refresh");
  });

  it("does not sign the customer out", async () => {
    apiClient.defaults.adapter = reauthAdapter;

    await expect(apiClient.delete("/leads/abc")).rejects.toThrow();
    expect(authErrors).toBe(0);
  });

  it("keeps the message the server sent, so the prompt can explain itself", async () => {
    apiClient.defaults.adapter = reauthAdapter;

    await expect(apiClient.delete("/leads/abc")).rejects.toThrow(
      "Please confirm it's you before completing this action."
    );
  });
});

describe("a 401 that really is the end of the session", () => {
  it("still renews and replays, unchanged", async () => {
    // The behaviour Phase A established must survive this: an ordinary expired
    // access token is not a confirmation prompt.
    let first = true;
    apiClient.defaults.adapter = async (config) => {
      calls.push(config.url ?? "");
      if (config.url === "/policies" && first) {
        first = false;
        throw unauthorized(config, { message: "Invalid security token." });
      }
      return ok(config);
    };

    const res = await apiClient.get("/policies");

    expect(res.status).toBe(200);
    expect(calls).toEqual(["/policies", "/auth/refresh", "/policies"]);
    expect(authErrors).toBe(0);
  });

  it("is not mistaken for a confirmation prompt when renewal fails", async () => {
    apiClient.defaults.adapter = async (config) => {
      calls.push(config.url ?? "");
      throw unauthorized(config, { message: "Invalid security token." });
    };

    await expect(apiClient.get("/policies")).rejects.not.toBeInstanceOf(ReauthRequiredError);
    expect(authErrors).toBe(1);
  });
});
