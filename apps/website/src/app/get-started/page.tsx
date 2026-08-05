import Link from "next/link";
import { cn } from "@aegis/utils";
import { buttonVariants } from "@aegis/ui";
import { pageMetadata } from "@/lib/seo";
import { PORTALS, type Portal } from "@/lib/site";
import { Section, SectionHeading } from "@/components/sections/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Icon, type IconName } from "@/components/ui/Icon";

export const metadata = pageMetadata({
  title: "Get started",
  description:
    "Choose the portal that matches how you work with Aegis AI — customer, employee, enterprise or platform administration.",
  path: "/get-started",
});

/**
 * The portal gateway.
 *
 * This page deliberately does not sign anyone in. It routes them to the
 * application that owns their kind of session, and each application runs its
 * own authentication.
 *
 * That is not a UX preference, it is the platform's identity model made
 * visible. A customer and a member of staff are different kinds of principal
 * with genuinely conflicting session policies — a customer wants a long,
 * forgiving session renewed silently, while staff need a short one behind a
 * second factor. One login form serving both would have to pick, and a string
 * comparison would end up being the only thing standing between public
 * self-registration and administrative access. Separate front doors mean the
 * staff API never even receives a customer's session.
 */

const ICONS: Record<Portal["id"], IconName> = {
  customer: "users",
  employee: "briefcase",
  enterprise: "building",
  "platform-admin": "layers",
};

const TONES: Record<Portal["tone"], string> = {
  brand: "text-brand",
  accent: "text-accent",
  info: "text-info",
  muted: "text-content-muted",
};

export default function GetStartedPage() {
  return (
    <>
      <Section spacing="loose" width="narrow" aria-labelledby="start-title">
        <SectionHeading
          id="start-title"
          as="h1"
          overline="Get started"
          title="Choose your portal"
          description="Aegis runs as separate applications rather than one with different menus, because a customer and a member of staff need genuinely different sessions. Pick the one that describes you and it will take you to the right sign-in."
          align="center"
        />
      </Section>

      <Section spacing="tight" aria-labelledby="portals-title">
        <h2 id="portals-title" className="sr-only">
          Available portals
        </h2>

        <ul className="grid gap-5 md:grid-cols-2">
          {PORTALS.map((portal, index) => (
            <li key={portal.id} className="flex">
              <Reveal delay={Math.min(index, 3) * 70} className="flex w-full">
                <PortalCard portal={portal} />
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      <Section width="narrow" spacing="tight" aria-labelledby="unsure-title">
        <div className="rounded-panel p-8 glass glass-sheen">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
            <Icon name="compass" size={22} />
          </span>
          <h2 id="unsure-title" className="mt-5 text-h3 font-semibold text-content">
            Not sure, or just looking?
          </h2>
          <p className="mt-3 text-pretty text-body text-content-secondary">
            You do not need an account to read about cover, compare products or work out what you
            need. Signing in is what makes your documents and your progress available next time — it
            is not a gate in front of the information.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/products" className={buttonVariants({ variant: "secondary", size: "md" })}>
              Browse products
            </Link>
            <Link href="/resources" className={buttonVariants({ variant: "ghost", size: "md" })}>
              Read the guides
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}

function PortalCard({ portal }: { portal: Portal }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex h-12 w-12 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60",
            TONES[portal.tone]
          )}
        >
          <Icon name={ICONS[portal.id]} size={24} />
        </span>
        {portal.available ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-success/40 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            Open
          </span>
        ) : (
          <span className="rounded-pill border border-line/70 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-content-muted">
            Coming soon
          </span>
        )}
      </div>

      <p className="mt-5 text-overline font-semibold uppercase text-content-muted">
        {portal.audience}
      </p>
      <h3 className="mt-1.5 text-h3 font-semibold text-content">{portal.name}</h3>
      <p className="mt-3 text-pretty text-body-sm text-content-secondary">{portal.description}</p>

      <ul className="mt-5 flex flex-col gap-2">
        {portal.points.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-body-sm text-content-secondary">
            <Icon
              name="check"
              size={16}
              className={cn(
                "mt-0.5 shrink-0",
                portal.available ? "text-success" : "text-content-muted"
              )}
            />
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        {portal.available ? (
          <span
            className={cn(
              buttonVariants({ variant: "primary", size: "md", fullWidth: true }),
              "pointer-events-none"
            )}
          >
            Continue to sign in
            <Icon name="arrowRight" size={16} />
          </span>
        ) : (
          <p className="text-caption text-content-muted">
            Not yet accepting sign-ins.{" "}
            <span className="text-content-secondary">
              Contact us if you need access for your organisation.
            </span>
          </p>
        )}
      </div>
    </>
  );

  const shell = cn(
    "flex h-full w-full flex-col rounded-panel p-6 glass glass-sheen sm:p-8",
    portal.available
      ? "focus-ring transition-transform duration-base ease-enter hover:-translate-y-1 motion-reduce:hover:translate-y-0"
      : "opacity-75"
  );

  // An unavailable portal is not a link. Rendering it as one that goes nowhere
  // is worse than saying plainly that it is not open yet.
  if (!portal.available) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <a
      href={portal.href}
      className={shell}
      // The portals are separate applications on separate origins. `noopener`
      // is set even though this is our own property, because the destination is
      // configured by environment and a misconfigured value should not inherit
      // a handle to this window.
      rel="noopener"
    >
      {body}
    </a>
  );
}
