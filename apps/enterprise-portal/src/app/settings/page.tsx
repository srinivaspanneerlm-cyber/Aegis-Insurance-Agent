"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Empty, Panel, Skeleton } from "@/components/Cards";
import { useConsole } from "@/context/ConsoleProvider";
import { API_URL } from "@/lib/console";

interface Channel {
  channel: string;
  available: boolean;
  reason?: string;
}

interface Preferences {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  reminderFrequency: string;
  channels: Channel[];
}

const CHANNEL_LABELS: Record<string, string> = {
  IN_APP: "In the console",
  EMAIL: "Email",
  SMS: "Text message",
  PUSH: "Push",
  REALTIME: "Live (socket)",
};

/** Which preference field each channel writes to. REALTIME has none. */
const FIELD: Record<string, "inApp" | "email" | "sms" | "push"> = {
  IN_APP: "inApp",
  EMAIL: "email",
  SMS: "sms",
  PUSH: "push",
};

const FREQUENCIES = [
  { value: "IMMEDIATE", label: "As they happen" },
  { value: "DAILY", label: "Once a day" },
  { value: "WEEKLY", label: "Once a week" },
];

/**
 * Settings.
 *
 * What an administrator may actually change is how the platform contacts them.
 * Everything about the organisation itself — plan, seats, status, contact
 * details — belongs to the platform operator and is shown read-only on the
 * Organisation page. Splitting them this way keeps the screen honest: every
 * control here does something.
 *
 * A channel with no provider is disabled with the deployment's own reason
 * rather than offered as a switch that silently does nothing.
 */
export default function SettingsPage() {
  const { session } = useConsole();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/communication/preferences`, { credentials: "include" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Could not load your settings.");
      setPrefs(body.data as Preferences);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your settings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (patch: Record<string, unknown>) => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${API_URL}/communication/preferences`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "That did not save.");
      // Render what was stored, not what was clicked — they differ whenever the
      // server declines part of a change.
      setPrefs(body.data as Preferences);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  }, []);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Empty icon="close">{error}</Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Settings</h1>
        <p className="mt-1 text-body-sm text-content-secondary">How the platform contacts you.</p>
      </header>

      {session ? (
        <Panel title="You">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-caption text-content-muted">Name</dt>
              <dd className="text-body-sm text-content">{session.user.name}</dd>
            </div>
            <div>
              <dt className="text-caption text-content-muted">Email</dt>
              <dd className="break-words text-body-sm text-content">{session.user.email}</dd>
            </div>
          </dl>
        </Panel>
      ) : null}

      {!prefs ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <Panel title="Where to reach you">
            <ul className="flex flex-col gap-3">
              {prefs.channels.map((c) => {
                const field = FIELD[c.channel];
                return (
                  <li key={c.channel} className="flex flex-col gap-1">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={field ? prefs[field] : true}
                        disabled={!c.available || !field || saving}
                        onChange={(e) => {
                          if (field) void save({ [field]: e.target.checked });
                        }}
                        className="focus-ring rounded border-line/50"
                      />
                      <span className="text-body-sm text-content">
                        {CHANNEL_LABELS[c.channel] ?? c.channel}
                      </span>
                    </label>
                    {!c.available && c.reason ? (
                      <p className="ml-7 text-pretty text-caption text-content-muted">{c.reason}</p>
                    ) : null}
                    {c.available && !field ? (
                      <p className="ml-7 text-caption text-content-muted">
                        Always on while the console is open. No preference is stored for it.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="How often">
            <div className="flex flex-wrap gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  disabled={saving}
                  onClick={() => void save({ reminderFrequency: f.value })}
                  className={
                    prefs.reminderFrequency === f.value
                      ? "focus-ring rounded-control border border-brand/40 bg-brand/10 px-3 py-1.5 text-body-sm font-medium text-content disabled:opacity-50"
                      : "focus-ring rounded-control border border-line/50 px-3 py-1.5 text-body-sm text-content-secondary disabled:opacity-50"
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Panel>

          <div aria-live="polite" className="text-body-sm text-content-secondary">
            {saving ? "Saving…" : saved ? "Saved." : null}
          </div>
        </>
      )}

      <p className="text-pretty text-caption text-content-muted">
        Your organisation&rsquo;s plan, seats and contact details are set by the platform operator
        and shown on{" "}
        <Link
          href="/organisation"
          className="focus-ring rounded text-brand underline underline-offset-4"
        >
          Organisation
        </Link>
        .
      </p>
    </div>
  );
}
