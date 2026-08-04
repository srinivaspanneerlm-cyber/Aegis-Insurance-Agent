import { describe, it, expect } from "vitest";
import { resolveApiUrl } from "./config";

/**
 * `localhost` and `127.0.0.1` are one machine but two sites. A page on one
 * calling an API pinned to the other sends a cross-site request, and the
 * `SameSite=Lax` session cookie is withheld — sign-in succeeds, then every
 * authenticated call 401s and the customer is asked to log in again.
 */

const LOCAL = "http://localhost:5000/api";

describe("resolveApiUrl", () => {
  it("follows the page's hostname when the API is pinned to loopback", () => {
    expect(resolveApiUrl(LOCAL, "127.0.0.1")).toBe("http://127.0.0.1:5000/api");
  });

  it("follows a LAN address, so the app works from another device", () => {
    expect(resolveApiUrl(LOCAL, "192.168.1.20")).toBe("http://192.168.1.20:5000/api");
  });

  it("leaves the URL alone when the page is already on that host", () => {
    expect(resolveApiUrl(LOCAL, "localhost")).toBe(LOCAL);
  });

  it("keeps port, protocol and path exactly as configured", () => {
    expect(resolveApiUrl("https://localhost:8443/v2/api", "127.0.0.1")).toBe(
      "https://127.0.0.1:8443/v2/api"
    );
  });

  it("does not redirect a real API host at the page's origin", () => {
    const deployed = "https://api.aegis.example.com/api";
    expect(resolveApiUrl(deployed, "127.0.0.1")).toBe(deployed);
    expect(resolveApiUrl(deployed, "app.aegis.example.com")).toBe(deployed);
  });

  it("leaves a relative base alone — it is already same-origin", () => {
    expect(resolveApiUrl("/api", "127.0.0.1")).toBe("/api");
  });

  it("keeps the configured value when there is no page to follow (SSR)", () => {
    expect(resolveApiUrl(LOCAL, undefined)).toBe(LOCAL);
  });
});
