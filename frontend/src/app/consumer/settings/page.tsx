"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Clock, Globe } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { intelligenceService, type NotificationPreferences } from "@/services/api";

/** Categories a customer may silence, in the words they read elsewhere. */
const MUTABLE = [
  { id: "POLICY", label: "Policy updates" },
  { id: "CLAIM", label: "Claim progress" },
  { id: "DOCUMENT", label: "Documents" },
  { id: "RENEWAL", label: "Renewal reminders" },
  { id: "AI_SUGGESTION", label: "Suggestions from Aegis" },
  { id: "ANNOUNCEMENT", label: "Announcements" },
];

const FREQUENCIES = [
  { id: "IMMEDIATE", label: "As they happen" },
  { id: "DAILY", label: "A daily summary" },
  { id: "WEEKLY", label: "A weekly summary" },
];

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "ta", label: "தமிழ் (Tamil)" },
];

/**
 * Notification settings.
 *
 * Two things this page will not do. It will not offer a channel that does not
 * work — SMS and push have no provider, and a switch that silently does nothing
 * is worse than an absent one, so an unavailable channel is shown disabled with
 * the server's own reason beside it. And it will not offer to silence security
 * alerts: the API refuses that, because a setting whose only effect is to help
 * an attacker stay unnoticed is not a feature.
 */
export default function SettingsPage() {
  const { user, isReady } = useRequireAuth();
  const router = useRouter();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isReady || !user) return;
    let cancelled = false;

    intelligenceService
      .getPreferences()
      .then((data) => {
        if (!cancelled) setPrefs(data);
      })
      .catch(() => {
        if (!cancelled) setError("We could not load your settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isReady, user]);

  const save = useCallback(
    async (next: NotificationPreferences) => {
      setPrefs(next);
      setSaving(true);
      setError(null);
      setSaved(false);
      try {
        const stored = await intelligenceService.savePreferences(next);
        setPrefs(stored);
        setSaved(true);
      } catch {
        setError("That did not save. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  if (!isReady || !user) return null;

  const channelState = (id: string) =>
    prefs?.channels.find((c) => c.channel === id) ?? { available: true, reason: undefined };

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 bg-surface text-content">
      <Navbar />
      <main id="main-content">
        <section className="relative pt-36 pb-24 flex-grow flex items-center justify-center z-10">
          <div className="max-w-xl w-full mx-auto px-6">
            <button
              onClick={() => router.push("/consumer-dashboard")}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-purple-400 mb-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </button>

            <div className="p-8 sm:p-10 rounded-[32px] border bg-slate-900/60 border-white/5 backdrop-blur-xl shadow-2xl relative text-left">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500" />

              <h1 className="text-xl font-black text-white">Notification settings</h1>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                How and when we get in touch.
              </p>

              {error ? (
                <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-xs font-bold text-danger">
                  {error}
                </p>
              ) : null}

              {/* Announced politely: a save confirmation should not interrupt. */}
              <p role="status" aria-live="polite" className="sr-only">
                {saving ? "Saving" : saved ? "Settings saved" : ""}
              </p>

              {loading || !prefs ? (
                <p className="mt-6 text-xs font-bold text-slate-400">Loading…</p>
              ) : (
                <div className="mt-8 space-y-8">
                  <fieldset>
                    <legend className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      <Bell className="w-3.5 h-3.5" />
                      How we reach you
                    </legend>

                    <div className="mt-3 space-y-2">
                      {[
                        { id: "inApp", channel: "IN_APP", label: "In the app" },
                        { id: "email", channel: "EMAIL", label: "Email" },
                        { id: "sms", channel: "SMS", label: "Text message" },
                        { id: "push", channel: "PUSH", label: "Push notification" },
                      ].map((row) => {
                        const state = channelState(row.channel);
                        const key = row.id as "inApp" | "email" | "sms" | "push";
                        return (
                          <div
                            key={row.id}
                            className="p-3.5 bg-white/[0.01] border border-white/5 rounded-xl"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                id={row.id}
                                type="checkbox"
                                checked={prefs[key]}
                                disabled={!state.available || saving}
                                onChange={(e) => void save({ ...prefs, [key]: e.target.checked })}
                                className="h-4 w-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-40"
                              />
                              <label
                                htmlFor={row.id}
                                className={`text-xs font-bold ${state.available ? "text-white" : "text-slate-500"}`}
                              >
                                {row.label}
                              </label>
                            </div>
                            {/* The server's own reason, passed through rather
                                than smoothed over. A switch that silently does
                                nothing is worse than one that is not there. */}
                            {!state.available && state.reason ? (
                              <p className="mt-1.5 ml-7 text-[10px] font-semibold text-amber-400 leading-snug">
                                Not available yet — {state.reason}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      How often
                    </legend>
                    <label htmlFor="frequency" className="sr-only">
                      Reminder frequency
                    </label>
                    <select
                      id="frequency"
                      value={prefs.reminderFrequency}
                      disabled={saving}
                      onChange={(e) => void save({ ...prefs, reminderFrequency: e.target.value })}
                      className="mt-3 w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </fieldset>

                  <fieldset>
                    <legend className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      <Globe className="w-3.5 h-3.5" />
                      Language
                    </legend>
                    <label htmlFor="language" className="sr-only">
                      Language
                    </label>
                    <select
                      id="language"
                      value={prefs.language}
                      disabled={saving}
                      onChange={(e) => void save({ ...prefs, language: e.target.value })}
                      className="mt-3 w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </fieldset>

                  <fieldset>
                    <legend className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      What to tell you about
                    </legend>
                    <div className="mt-3 space-y-2">
                      {MUTABLE.map((category) => {
                        const muted = prefs.mutedCategories.includes(category.id);
                        return (
                          <div key={category.id} className="flex items-center gap-3">
                            <input
                              id={`cat-${category.id}`}
                              type="checkbox"
                              checked={!muted}
                              disabled={saving}
                              onChange={(e) =>
                                void save({
                                  ...prefs,
                                  mutedCategories: e.target.checked
                                    ? prefs.mutedCategories.filter((c) => c !== category.id)
                                    : [...prefs.mutedCategories, category.id],
                                })
                              }
                              className="h-4 w-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                            />
                            <label htmlFor={`cat-${category.id}`} className="text-xs font-bold text-white">
                              {category.label}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    {/* Security is deliberately absent from the list above. The
                        API refuses to mute it, and offering a switch that will
                        be rejected is worse than not offering one. */}
                    <p className="mt-3 text-[10px] font-semibold text-slate-500 leading-snug">
                      Security alerts cannot be switched off. They tell you when somebody signs in
                      as you.
                    </p>
                  </fieldset>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
