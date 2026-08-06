"use client";

import { cn } from "@aegis/utils";
import { RISK_BAND_META, type RiskSummary } from "../lib/types";

export interface RiskMatrixProps {
  risk: RiskSummary;
}

const BAND_BAR = {
  LOW: "bg-success",
  MODERATE: "bg-info",
  ELEVATED: "bg-warning",
  HIGH: "bg-danger",
  UNKNOWN: "bg-line",
} as const;

/**
 * The eight risk dimensions, as a table.
 *
 * A table rather than a chart, deliberately. A radar chart of eight axes looks
 * authoritative and communicates almost nothing — it cannot say *why* a
 * dimension is elevated or what would lower it, and it is unreadable to anyone
 * using a screen reader. The score bar here is decoration on top of a number
 * that is also written out.
 *
 * Unknown dimensions are listed alongside the rest at full contrast. Greying
 * them out would make the platform's ignorance look like a low score, which is
 * the exact confusion the engine's UNKNOWN band exists to prevent.
 */
export function RiskMatrix({ risk }: RiskMatrixProps) {
  const overall = RISK_BAND_META[risk.overall];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border-line/50 bg-surface-raised/30 border p-4">
        <p className="text-caption text-content-muted">Overall</p>
        <p className="text-h3 text-content mt-0.5 font-semibold">{overall.label}</p>
        <p className="text-body-sm text-content-secondary mt-1 text-pretty">{risk.narrative}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">
            Risk assessment across eight areas, with what drives each one
          </caption>
          <thead>
            <tr className="border-line/50 border-b">
              <th
                scope="col"
                className="text-caption text-content-muted pr-4 pb-2 font-semibold uppercase"
              >
                Area
              </th>
              <th
                scope="col"
                className="text-caption text-content-muted pr-4 pb-2 font-semibold uppercase"
              >
                Reading
              </th>
              <th
                scope="col"
                className="text-caption text-content-muted pb-2 font-semibold uppercase"
              >
                What drives it
              </th>
            </tr>
          </thead>
          <tbody>
            {risk.factors.map((factor) => {
              const meta = RISK_BAND_META[factor.band];
              return (
                <tr key={factor.dimension} className="border-line/30 border-b align-top">
                  <th
                    scope="row"
                    className="text-body-sm text-content py-3 pr-4 font-medium capitalize"
                  >
                    {factor.dimension}
                  </th>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn("rounded-pill h-1.5 w-10", BAND_BAR[factor.band])}
                        style={
                          factor.score !== null
                            ? { opacity: 0.4 + (factor.score / 100) * 0.6 }
                            : undefined
                        }
                      />
                      <span className="text-body-sm text-content">
                        {meta.label}
                        {factor.score !== null ? (
                          <span className="text-content-muted"> ({factor.score})</span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    <ul className="flex flex-col gap-1">
                      {factor.drivers.map((d) => (
                        <li key={d} className="text-caption text-content-secondary text-pretty">
                          {d}
                        </li>
                      ))}
                    </ul>
                    {factor.mitigations.length > 0 ? (
                      <p className="text-caption text-content-muted mt-1.5 text-pretty">
                        <span className="font-medium">What helps: </span>
                        {factor.mitigations[0]}
                      </p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
