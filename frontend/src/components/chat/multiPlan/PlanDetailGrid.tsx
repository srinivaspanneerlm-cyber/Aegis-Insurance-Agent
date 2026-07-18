import type { DetailRow } from "./detailRows";

/** Renders a plan's detail rows as a 2-column grid of label/value tiles. */
export function PlanDetailGrid({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map(({ label, value }) => (
        <div key={label} className="bg-white/[0.02] rounded-lg p-2">
          <p className="text-[8px] text-slate-600 font-bold uppercase tracking-wide mb-0.5">{label}</p>
          <p className="text-[10px] text-slate-300 font-semibold">{String(value)}</p>
        </div>
      ))}
    </div>
  );
}
