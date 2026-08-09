"use client";

import Link from "next/link";
import { Badge, Empty } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import {
  KIND_LABELS,
  STATUS_LABELS,
  isOverdue,
  raisedByAssistant,
  type WorkItem,
} from "@/lib/workspace";

const PRIORITY_TONE = {
  URGENT: "danger",
  HIGH: "warning",
  NORMAL: "neutral",
  LOW: "neutral",
} as const;

/**
 * A queue, as a table.
 *
 * A real `<table>` rather than a grid of divs: this is tabular data, screen
 * readers announce row and column position for it, and sorting by column is the
 * obvious next feature. Below `sm` the same rows render as stacked cards —
 * horizontally scrolling a table on a phone is how people miss the due date.
 */
export function QueueTable({ items }: { items: readonly WorkItem[] }) {
  if (items.length === 0) {
    return <Empty>Nothing in this queue. When work is routed to you it appears here.</Empty>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line/50 text-caption text-content-muted">
              <th scope="col" className="pb-2 pr-4 font-medium uppercase tracking-wide">
                Reference
              </th>
              <th scope="col" className="pb-2 pr-4 font-medium uppercase tracking-wide">
                Work
              </th>
              <th scope="col" className="pb-2 pr-4 font-medium uppercase tracking-wide">
                Status
              </th>
              <th scope="col" className="pb-2 pr-4 font-medium uppercase tracking-wide">
                Priority
              </th>
              <th scope="col" className="pb-2 font-medium uppercase tracking-wide">
                Due
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-line/30 last:border-0">
                <td className="py-3 pr-4">
                  <Link
                    href={`/work/${item.id}`}
                    className="focus-ring rounded text-body-sm font-medium tabular-nums text-brand"
                  >
                    {item.reference}
                  </Link>
                </td>
                <td className="py-3 pr-4">
                  <p className="text-body-sm text-content">{item.title}</p>
                  <p className="text-caption text-content-muted">
                    {KIND_LABELS[item.kind] ?? item.kind}
                  </p>
                  {raisedByAssistant(item) ? <AssistantMark /> : null}
                </td>
                <td className="py-3 pr-4">
                  <Badge>{STATUS_LABELS[item.status] ?? item.status}</Badge>
                </td>
                <td className="py-3 pr-4">
                  <Badge
                    tone={PRIORITY_TONE[item.priority as keyof typeof PRIORITY_TONE] ?? "neutral"}
                  >
                    {item.priority}
                  </Badge>
                </td>
                <td className="py-3">
                  <DueCell item={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 sm:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-card border border-line/50 p-4">
            <Link
              href={`/work/${item.id}`}
              className="focus-ring rounded text-body-sm font-medium tabular-nums text-brand"
            >
              {item.reference}
            </Link>
            <p className="mt-1 text-body-sm text-content">{item.title}</p>
            {raisedByAssistant(item) ? <AssistantMark /> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge>{STATUS_LABELS[item.status] ?? item.status}</Badge>
              <Badge tone={PRIORITY_TONE[item.priority as keyof typeof PRIORITY_TONE] ?? "neutral"}>
                {item.priority}
              </Badge>
              <DueCell item={item} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Says the assistant raised this piece of work.
 *
 * In words, not as an icon or a colour: the point of the label is that somebody
 * can weigh the suggestion differently from a colleague's request, and a symbol
 * they have to learn does not do that. The reason itself is on the case — it is
 * a sentence, and a queue row is not where a sentence belongs.
 */
function AssistantMark() {
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-caption text-content-muted">
      <Icon name="spark" size={12} aria-hidden="true" />
      Raised by the assistant
    </span>
  );
}

/**
 * Overdue is stated in words, not only in colour.
 *
 * A red date is invisible to a colour-blind reader, and this is the field the
 * whole queue is sorted by.
 */
function DueCell({ item }: { item: WorkItem }) {
  if (!item.dueAt) return <span className="text-caption text-content-muted">—</span>;

  const due = new Date(item.dueAt);
  const overdue = isOverdue(item);
  const label = due.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <span
      className={
        overdue ? "text-caption font-semibold text-danger" : "text-caption text-content-secondary"
      }
    >
      {overdue ? `Overdue — ${label}` : label}
    </span>
  );
}
