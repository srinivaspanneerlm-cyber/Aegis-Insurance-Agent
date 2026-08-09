"use client";

import { useCallback, useEffect, useState } from "react";
import { Empty, Panel, Skeleton } from "@/components/Cards";
import { useWorkspace } from "@/context/WorkspaceProvider";
import { workspaceApi, type NotificationPreferences } from "@/lib/api";

const CHANNEL_LABELS: Record<string, string> = {
  IN_APP: "In the portal",
  EMAIL: "Email",
  SMS: "Text message",
  PUSH: "Push",
  REALTIME: "Live (socket)",
};

/** Which preference field each channel writes to. REALTIME has none. */
const CHANNEL_FIELD: Record<string, "inApp" | "email" | "sms" | "push"> = {
  IN_APP: "inApp",
  EMAIL: "email",
  SMS: "sms",
  PUSH: "push",
};

const CATEGORY_LABELS: Record<string, string> = {
  POLICY: "Policy updates",
  CLAIM: "Claims",
  DOCUMENT: "Documents",
  RENEWAL: "Renewals",
  ANNOUNCEMENT: "Announcements",
  MAINTENANCE: "Maintenance windows",
  AI_SUGGESTION: "Assistant suggestions",
  TASK: "Work assigned to you",
  MESSAGE: "Messages",
};

/**
 * Categories somebody may switch off.
 *
 * SECURITY is absent, and that is the point: the API refuses to mute it, so a
 * switch here could only ever fail — and a setting whose sole effect would be
 * helping an attacker stay unnoticed should not be drawn at all.
 */
const MUTABLE = Object.keys(CATEGORY_LABELS);

const FREQUENCIES = [
  { value: "IMMEDIATE", label: "As they happen" },
  { value: "DAILY", label: "Once a day" },
  { value: "WEEKLY", label: "Once a week" },
] as const;

/**
 * Settings.
 *
 * The nav has said "coming soon" while GET and PUT /communication/preferences
 * were live. This reads and writes them.
 *
 * A channel with no provider is shown disabled with the server's stated reason
 * rather than as a working switch. Somebody who turns on text messages for a
 * breaching claim and then hears nothing has been lied to by the interface, and
 * the reason — "no SMS provider is configured" — is a fact about the
 * deployment, not about them.
 */
export default function SettingsPage() {
  const { session } = useWorkspace();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    workspaceApi
      .preferences()
      .then((data) => {
        if (!cancelled) setPrefs(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not load your settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (patch: Partial<NotificationPreferences>) => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      // The server returns the saved state, so the screen shows what was
      // stored rather than what was clicked. They differ whenever the server
      // declines part of a change.
      const next = await workspaceApi.savePreferences(patch);
      setPrefs(next);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "That did not save.");
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

  const toggleCategory = (category: string) => {
    if (!prefs) return;
    const muted = prefs.mutedCategories.includes(category)
      ? prefs.mutedCategories.filter((c) => c !== category)
      : [...prefs.mutedCategories, category];
    void save({ mutedCategories: muted });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Settings</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          How and when Aegis contacts you about your work.
        </p>
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
          {/* Said, not offered. There is no endpoint in this portal that changes
              either, and a disabled field with no explanation reads as a bug. */}
          <p className="mt-4 text-pretty text-caption text-content-muted">
            Your name and address come from your staff record. Changing them is done by whoever
            administers your account, not here.
          </p>
        </Panel>
      ) : null}

      {!prefs ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {!prefs.exists ? (
            <p className="text-pretty text-caption text-content-muted">
              You have not changed anything yet, so these are the defaults. Saving once makes them
              yours.
            </p>
          ) : null}

          <Panel title="Where to reach you">
            <ul className="flex flex-col gap-3">
              {prefs.channels.map((channel) => {
                const field = CHANNEL_FIELD[channel.channel];
                return (
                  <li key={channel.channel} className="flex flex-col gap-1">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`channel-${channel.channel}`}
                        checked={field ? prefs[field] : true}
                        disabled={!channel.available || !field || saving}
                        onChange={(event) => {
                          if (field) void save({ [field]: event.target.checked });
                        }}
                        className="focus-ring rounded border-line/50"
                      />
                      <span className="text-body-sm text-content">
                        {CHANNEL_LABELS[channel.channel] ?? channel.channel}
                      </span>
                    </label>
                    {/* The deployment's reason, verbatim. */}
                    {!channel.available && channel.reason ? (
                      <p className="ml-7 text-pretty text-caption text-content-muted">
                        {channel.reason}
                      </p>
                    ) : null}
                    {channel.available && !field ? (
                      <p className="ml-7 text-pretty text-caption text-content-muted">
                        Always on while you have the portal open. There is no preference stored for
                        it.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="How often">
            <div className="flex flex-wrap gap-2">
              {FREQUENCIES.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  disabled={saving}
                  onClick={() => void save({ reminderFrequency: entry.value })}
                  className={
                    prefs.reminderFrequency === entry.value
                      ? "focus-ring rounded-control border border-brand/40 bg-brand/10 px-3 py-1.5 text-body-sm font-medium text-content disabled:opacity-50"
                      : "focus-ring rounded-control border border-line/50 px-3 py-1.5 text-body-sm text-content-secondary disabled:opacity-50"
                  }
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="What to tell you about">
            <ul className="flex flex-col gap-2">
              {MUTABLE.map((category) => (
                <li key={category}>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!prefs.mutedCategories.includes(category)}
                      disabled={saving}
                      onChange={() => toggleCategory(category)}
                      className="focus-ring rounded border-line/50"
                    />
                    <span className="text-body-sm text-content">
                      {CATEGORY_LABELS[category] ?? category}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-pretty text-caption text-content-muted">
              Security alerts are not listed. They tell you when somebody signs in as you, and
              cannot be switched off.
            </p>
          </Panel>

          <div className="flex flex-wrap items-center gap-3" aria-live="polite">
            {saving ? <span className="text-body-sm text-content-secondary">Saving…</span> : null}
            {saved && !saving ? (
              <span className="text-body-sm text-content-secondary">Saved.</span>
            ) : null}
            {saveError ? (
              <span role="alert" className="text-body-sm text-danger">
                {saveError}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
