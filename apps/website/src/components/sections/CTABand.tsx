import Link from "next/link";
import { buttonVariants } from "@aegis/ui";
import { cn } from "@aegis/utils";
import { Section } from "@/components/sections/Section";
import { Icon } from "@/components/ui/Icon";

export interface CTABandProps {
  title: string;
  description: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  /** A reassurance line under the buttons — what happens next, or what it costs. */
  note?: string;
}

/**
 * The closing call to action, repeated at the foot of every page.
 *
 * Two actions, never three. A visitor who has read to the bottom has one
 * question left — "what do I do now" — and a third option turns an answer back
 * into a decision.
 */
export function CTABand({ title, description, primary, secondary, note }: CTABandProps) {
  return (
    <Section spacing="loose">
      <div className="relative isolate overflow-hidden rounded-panel px-6 py-14 text-center glass glass-sheen sm:px-12 sm:py-20">
        {/* Decorative only — it carries no information, so it is hidden from
            assistive technology rather than described. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-32 -z-10 h-64 bg-gradient-to-b from-brand/20 to-transparent blur-3xl"
        />

        <h2 className="mx-auto max-w-2xl text-balance text-h1 font-bold tracking-tight text-content">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-body text-content-secondary">
          {description}
        </p>

        {primary || secondary ? (
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {primary ? (
              <Link
                href={primary.href}
                className={cn(buttonVariants({ variant: "primary", size: "lg" }), "sm:w-auto")}
              >
                {primary.label}
                <Icon name="arrowRight" size={18} />
              </Link>
            ) : null}
            {secondary ? (
              <Link
                href={secondary.href}
                className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "sm:w-auto")}
              >
                {secondary.label}
              </Link>
            ) : null}
          </div>
        ) : null}

        {note ? <p className="mt-5 text-caption text-content-muted">{note}</p> : null}
      </div>
    </Section>
  );
}
