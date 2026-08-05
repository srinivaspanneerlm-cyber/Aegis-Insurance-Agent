import Link from "next/link";
import { buttonVariants } from "@aegis/ui";
import { Section } from "@/components/sections/Section";
import { Icon, type IconName } from "@/components/ui/Icon";

export interface ComingSoonProps {
  icon: IconName;
  overline: string;
  title: string;
  description: string;
  /** What will be here. Concrete, so the page is worth the visit today. */
  planned: readonly string[];
  /** Where to go instead, since a dead end is the actual failure of these pages. */
  alternative: { label: string; href: string; description: string };
}

/**
 * A page that does not exist yet, said plainly.
 *
 * The temptation is a single line reading "Coming soon", which tells a visitor
 * nothing and wastes the click. This says what is planned, and — the part that
 * matters — offers the thing they can do right now, because someone who
 * navigated to Careers or Blog was looking for a reason to take us seriously.
 */
export function ComingSoon({
  icon,
  overline,
  title,
  description,
  planned,
  alternative,
}: ComingSoonProps) {
  return (
    <Section spacing="loose" width="narrow">
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
          <Icon name={icon} size={26} />
        </span>

        <p className="mt-6 text-overline font-semibold uppercase text-brand">{overline}</p>
        <h1 className="mt-3 text-balance text-display font-bold tracking-tight text-content">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-body text-content-secondary">{description}</p>
      </div>

      <div className="mt-12 rounded-panel p-6 glass glass-sheen sm:p-8">
        <h2 className="text-h4 font-semibold text-content">What will be here</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {planned.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-body-sm text-content-secondary">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-success" />
              <span className="text-pretty">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-col items-start gap-4 rounded-card border border-line/50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-body font-medium text-content">{alternative.description}</p>
        </div>
        <Link
          href={alternative.href}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {alternative.label}
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </Section>
  );
}
