import { Icon } from "@/components/ui/Icon";

export interface AccordionItem {
  question: string;
  answer: string;
}

/**
 * The FAQ list, built on `<details>` / `<summary>`.
 *
 * No JavaScript at all. The browser gives us open/close, keyboard operation,
 * the correct ARIA semantics and — importantly — the ability for a visitor to
 * use the browser's own in-page find to search inside a *closed* answer, which
 * a div-and-state accordion silently takes away.
 *
 * It also means the answers are readable before hydration, which on a slow
 * connection is the difference between a useful page and a list of headings.
 */
export function Accordion({ items }: { items: readonly AccordionItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <details
          key={item.question}
          className="group overflow-hidden rounded-card glass focus-within:ring-2 focus-within:ring-brand/40"
        >
          <summary
            className={[
              "flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4",
              "text-body font-medium text-content",
              // Safari renders a disclosure triangle unless this is removed.
              "[&::-webkit-details-marker]:hidden",
            ].join(" ")}
          >
            <span className="text-pretty">{item.question}</span>
            <Icon
              name="chevronDown"
              size={20}
              className="shrink-0 text-content-muted transition-transform duration-fast group-open:rotate-180"
            />
          </summary>
          <div className="text-pretty border-t border-line/40 px-5 py-4 text-body-sm text-content-secondary">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
