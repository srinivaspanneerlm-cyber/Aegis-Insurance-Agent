"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { StepUpDialog } from "@/components/StepUpDialog";
import { platformApi, PlatformError, type SettingsPayload } from "@/lib/api";

/**
 * Platform configuration.
 *
 * Grouped by category, typed per setting, and every change re-confirmed. What
 * lives in environment is listed alongside, so an operator does not hunt for a
 * control that should never exist.
 */
export default function SettingsPage() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<null | { action: string; run: () => Promise<void> }>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await platformApi.settings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    (key: string, label: string, value: string) => {
      const run = async () => {
        await platformApi.updateSetting(key, value);
        setNotice(`${label} saved.`);
        await load();
      };
      void (async () => {
        try {
          await run();
          setError(null);
        } catch (e) {
          if (e instanceof PlatformError && e.code === "REAUTH_REQUIRED") {
            setPending({ action: `Changing “${label}”`, run });
            return;
          }
          setError(e instanceof Error ? e.message : "That did not save.");
        }
      })();
    },
    [load]
  );

  if (error && !data) return <Empty icon="close">{error}</Empty>;
  if (!data)
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );

  const categories = [...new Set(data.settings.map((s) => s.category))];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Platform Configuration</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Changes take effect without a deployment, and every one is recorded with its previous
          value.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="rounded-control bg-success/10 px-4 py-3 text-body-sm text-success"
        >
          {notice}
        </p>
      ) : null}

      {categories.map((category) => (
        <Panel key={category} title={category.charAt(0).toUpperCase() + category.slice(1)}>
          <ul className="flex flex-col gap-5">
            {data.settings
              .filter((s) => s.category === category)
              .map((setting) => (
                <li
                  key={setting.key}
                  className="border-b border-line/30 pb-5 last:border-0 last:pb-0"
                >
                  <label
                    htmlFor={`s-${setting.key}`}
                    className="text-body-sm font-medium text-content"
                  >
                    {setting.label}
                  </label>
                  {setting.description ? (
                    <p className="mt-1 text-pretty text-caption text-content-secondary">
                      {setting.description}
                    </p>
                  ) : null}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const value = String(new FormData(e.currentTarget).get("value") ?? "");
                      save(setting.key, setting.label, value);
                    }}
                    className="mt-3 flex gap-2"
                  >
                    {setting.type === "boolean" ? (
                      <select
                        id={`s-${setting.key}`}
                        name="value"
                        defaultValue={setting.value}
                        className="h-10 flex-1 rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    ) : (
                      <input
                        id={`s-${setting.key}`}
                        name="value"
                        defaultValue={setting.value}
                        type={setting.type === "number" ? "number" : "text"}
                        className="h-10 flex-1 rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                      />
                    )}
                    <button
                      type="submit"
                      className="focus-ring h-10 rounded-control border border-line px-4 text-body-sm font-medium text-content transition-colors hover:border-line-strong"
                    >
                      Save
                    </button>
                  </form>
                  <p className="mt-1 text-caption text-content-muted">
                    <code>{setting.key}</code> · {setting.type}
                  </p>
                </li>
              ))}
          </ul>
        </Panel>
      ))}

      <Panel title="Held in environment, not here">
        <ul className="flex flex-col gap-3">
          {data.environmentOnly.map((e) => (
            <li
              key={e.key}
              className="flex flex-wrap items-start gap-2 border-b border-line/30 pb-3 last:border-0 last:pb-0"
            >
              <Badge>{e.key}</Badge>
              <span className="flex-1 text-pretty text-caption text-content-secondary">
                {e.reason}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-pretty text-caption text-content-muted">
          Secrets stay in environment: not readable from a console, not written to an audit trail,
          and not one injection away from disclosure.
        </p>
      </Panel>

      <StepUpDialog
        open={pending !== null}
        action={pending?.action ?? ""}
        onCancel={() => setPending(null)}
        onConfirmed={() => {
          const p = pending;
          setPending(null);
          if (p) void p.run().catch(() => setError("That did not save."));
        }}
      />
    </div>
  );
}
