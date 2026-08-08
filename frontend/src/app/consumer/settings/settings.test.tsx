/**
 * Notification settings.
 *
 * Two properties matter more than the rest.
 *
 * A channel with no provider must not be offered as a working switch. SMS and
 * push have none, and a toggle that silently does nothing is worse than an
 * absent one — somebody who enables SMS for their claim and hears nothing has
 * been told a lie by the interface.
 *
 * Security alerts must not appear as something to silence. The API refuses it,
 * so a switch would only fail; and a setting whose sole effect is helping an
 * attacker stay unnoticed should not be drawn at all.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { NotificationPreferences } from "@/services/api";
import SettingsPage from "./page";

const getPreferences = vi.fn();
const savePreferences = vi.fn();

vi.mock("@/services/api", () => ({
  intelligenceService: {
    getPreferences: (...args: unknown[]) => getPreferences(...args),
    savePreferences: (...args: unknown[]) => savePreferences(...args),
  },
}));
vi.mock("@/hooks/useRequireAuth", () => ({
  useRequireAuth: () => ({ user: { name: "Meena", email: "m@example.com" }, isReady: true }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const prefs = (over: Partial<NotificationPreferences> = {}): NotificationPreferences => ({
  inApp: true,
  email: true,
  sms: false,
  push: false,
  reminderFrequency: "IMMEDIATE",
  language: "en",
  mutedCategories: [],
  quietHoursStart: null,
  quietHoursEnd: null,
  channels: [
    { channel: "IN_APP", available: true },
    { channel: "EMAIL", available: true },
    { channel: "SMS", available: false, reason: "No SMS provider is configured." },
    { channel: "PUSH", available: false, reason: "No push provider is configured." },
  ],
  ...over,
});

describe("settings", () => {
  it("disables a channel that has no provider, and says why", async () => {
    getPreferences.mockResolvedValue(prefs());
    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByLabelText("Text message")).toBeDisabled());
    expect(screen.getByText(/No SMS provider is configured/i)).toBeInTheDocument();
  });

  it("leaves a working channel enabled", async () => {
    getPreferences.mockResolvedValue(prefs());
    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByLabelText("Email")).toBeEnabled());
  });

  it("does not offer to silence security alerts", async () => {
    getPreferences.mockResolvedValue(prefs());
    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByLabelText("Policy updates")).toBeInTheDocument());
    expect(screen.queryByLabelText(/security/i)).not.toBeInTheDocument();
    expect(screen.getByText(/cannot be switched off/i)).toBeInTheDocument();
  });

  it("says so when the settings could not be loaded", async () => {
    getPreferences.mockRejectedValue(new Error("nope"));
    render(<SettingsPage />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/could not load your settings/i)
    );
  });
});
