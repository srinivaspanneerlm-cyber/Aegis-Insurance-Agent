import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AxiosError, type AxiosAdapter } from "axios";
import { apiClient, authService } from "./api";

/**
 * A 401 means two different things depending on who asked.
 *
 * For a call that assumed a session, it means the session is gone and the
 * customer has to sign in again. For the boot-time "who am I?" probe it means
 * nothing more than "nobody is signed in" — which is the ordinary state of
 * every visitor reading the public pages. Treating the second as the first
 * bounced anonymous visitors to /login, and made a fresh sign-in look like it
 * had failed when it had in fact succeeded.
 */

const realAdapter = apiClient.defaults.adapter;

/**
 * Answers every request 401, the way the API does with no session cookie.
 * A custom adapter is responsible for rejecting on its own — axios only applies
 * `validateStatus` to its built-in transports — so this raises the same
 * `AxiosError` the real one would.
 */
const unauthorized: AxiosAdapter = async (config) => {
  throw new AxiosError(
    "Request failed with status code 401",
    AxiosError.ERR_BAD_REQUEST,
    config,
    null,
    {
      data: { message: "You are not logged in. Please log in to gain access." },
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      config,
    }
  );
};

let authErrors = 0;
const countAuthError = () => {
  authErrors += 1;
};

beforeEach(() => {
  authErrors = 0;
  apiClient.defaults.adapter = unauthorized;
  window.addEventListener("aegis_auth_error", countAuthError);
});

afterEach(() => {
  window.removeEventListener("aegis_auth_error", countAuthError);
  apiClient.defaults.adapter = realAdapter;
});

describe("401 handling", () => {
  it("signs out when a request that relied on a session is refused", async () => {
    await expect(apiClient.get("/policies")).rejects.toThrow();

    expect(authErrors).toBe(1);
  });

  it("stays put when the session probe reports nobody is signed in", async () => {
    await expect(authService.getMe()).rejects.toThrow();

    expect(authErrors).toBe(0);
  });

  it("still surfaces the server's message to the caller either way", async () => {
    await expect(authService.getMe()).rejects.toThrow(
      "You are not logged in. Please log in to gain access."
    );
  });
});
