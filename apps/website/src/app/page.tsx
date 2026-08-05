import Link from "next/link";
import { buttonVariants } from "@aegis/ui";
import { cn } from "@aegis/utils";
import { pageMetadata } from "@/lib/seo";
import { Section, SectionHeading } from "@/components/sections/Section";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { CTABand } from "@/components/sections/CTABand";
import { Reveal } from "@/components/ui/Reveal";
import { Icon } from "@/components/ui/Icon";

export const metadata = pageMetadata({
  title: "Aegis AI — Insurance that explains itself",
  description:
    "An enterprise insurance platform built to educate, guide and protect. Understand cover before you buy it — in plain language, in your language.",
  path: "/",
});

const BENEFITS = [
  {
    icon: "translate" as const,
    title: "Plain language, and your language",
    description:
      "Cover explained the way a person would explain it, in English or Tamil, without asking you to already know what a deductible is.",
  },
  {
    icon: "scales" as const,
    title: "Comparison you can check",
    description:
      "Every recommendation shows what it weighed and why one option came out ahead — so you can disagree with it.",
  },
  {
    icon: "eye" as const,
    title: "No pressure to buy",
    description:
      "You can read, compare and leave. Understanding what you already hold is a perfectly good reason to be here.",
  },
  {
    icon: "users" as const,
    title: "Built for who is usually left out",
    description:
      "First-time buyers, senior citizens and families on a budget — designed for them first rather than adapted for them later.",
  },
  {
    icon: "bolt" as const,
    title: "Answers in seconds",
    description:
      "Guidance arrives as you read it rather than after a wait, and the whole site is built to work on a slow connection.",
  },
  {
    icon: "lock" as const,
    title: "Your records stay yours",
    description:
      "Every request is scoped to the person who made it. Your documents are never part of somebody else's answer.",
  },
];

const PLATFORM = [
  {
    icon: "compass" as const,
    title: "Understand",
    description:
      "Start with a question rather than a form. The platform works out what you actually need to know before it recommends anything.",
  },
  {
    icon: "scales" as const,
    title: "Compare",
    description:
      "Options set side by side on the terms that matter to you — cost, exclusions, waiting periods and what happens at claim time.",
  },
  {
    icon: "shield" as const,
    title: "Decide",
    description:
      "A recommendation with its reasoning attached, so the decision stays yours and you can explain it to your family.",
  },
  {
    icon: "refresh" as const,
    title: "Stay covered",
    description:
      "Renewals, expiry and the paperwork that goes with them, tracked so a lapse never comes as a surprise.",
  },
];

const SECURITY = [
  {
    icon: "lock" as const,
    title: "Sessions that expire",
    description:
      "Short-lived credentials renewed silently while you work, and ended when you stop — including on a shared device.",
    points: ["Renewal without re-login", "Idle sign-out", "Every tab in step"],
  },
  {
    icon: "shield" as const,
    title: "Reused credentials are revoked",
    description:
      "A session credential that turns up twice is treated as a stolen one, and every session it belongs to ends immediately.",
    points: ["Single-use rotation", "Reuse detection", "Recorded for review"],
  },
  {
    icon: "users" as const,
    title: "Separated by design",
    description:
      "Customers and staff sign in through different front doors with different session policies. Access is granted by capability, never by job title.",
    points: [
      "Separate portals",
      "Capability-based access",
      "Re-confirmation before irreversible actions",
    ],
  },
  {
    icon: "layers" as const,
    title: "Scoped to you",
    description:
      "Every query that returns personal data is bound to the person who asked for it. Cross-account access is treated as a critical defect.",
    points: ["Per-account scoping", "Audit trail", "Generic errors in production"],
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Section spacing="loose" width="wide" aria-labelledby="hero-title">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-pill border border-line/60 bg-surface-raised/50 px-4 py-1.5 text-caption text-content-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              Enterprise insurance platform
            </p>
          </Reveal>

          <Reveal delay={60}>
            <h1
              id="hero-title"
              className="mt-6 text-balance text-display font-bold tracking-tight text-content sm:text-display-lg"
            >
              Insurance that{" "}
              <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
                explains itself
              </span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-body text-content-secondary sm:text-lg">
              Most people buy cover they do not understand, from a document written for somebody
              else. Aegis AI is built to change that — to educate, guide and protect, in the
              language you actually speak.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/get-started"
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                Get started
                <Icon name="arrowRight" size={18} />
              </Link>
              <Link
                href="/request-demo"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                Request a demo
              </Link>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-5 text-caption text-content-muted">
              No account needed to read and compare.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* ── Mission & Vision ─────────────────────────────────────────────── */}
      <Section tone="sunken" aria-labelledby="purpose-title">
        <SectionHeading
          id="purpose-title"
          overline="Why we exist"
          title="Our mission and our vision"
          description="Two sentences we hold every engineering and design decision against."
          align="center"
        />

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Reveal>
            <article className="h-full rounded-panel p-8 glass glass-sheen">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
                <Icon name="compass" size={22} />
              </span>
              <h3 className="mt-5 text-h3 font-semibold text-content">Mission</h3>
              <p className="mt-3 text-pretty text-body text-content-secondary">
                To make insurance understandable to the people it most often fails — first-time
                buyers, senior citizens, rural families and anyone who has ever signed a policy they
                could not read. We educate first, guide second, and sell last.
              </p>
            </article>
          </Reveal>

          <Reveal delay={80}>
            <article className="h-full rounded-panel p-8 glass glass-sheen">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-accent">
                <Icon name="spark" size={22} />
              </span>
              <h3 className="mt-5 text-h3 font-semibold text-content">Vision</h3>
              <p className="mt-3 text-pretty text-body text-content-secondary">
                A market where nobody discovers what their policy does not cover at the moment they
                need it. Where the explanation arrives before the signature, and protection is
                something people choose knowingly rather than something sold to them.
              </p>
            </article>
          </Reveal>
        </div>
      </Section>

      {/* ── Why Aegis / Benefits ─────────────────────────────────────────── */}
      <Section aria-labelledby="benefits-title">
        <SectionHeading
          id="benefits-title"
          overline="Why Aegis AI"
          title="Built around the questions people actually ask"
          description="Not “which plan is cheapest”, but “what happens if I need this, and will it be there”."
        />
        <FeatureGrid className="mt-12" features={BENEFITS} columns={3} />
      </Section>

      {/* ── Platform overview ────────────────────────────────────────────── */}
      <Section tone="sunken" aria-labelledby="platform-title">
        <SectionHeading
          id="platform-title"
          overline="The platform"
          title="How it works, end to end"
          description="Four stages. Nothing here requires you to already understand insurance."
          align="center"
        />

        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM.map((stage, index) => (
            <li key={stage.title} className="flex">
              <Reveal delay={index * 70} className="flex w-full">
                <article className="relative flex h-full w-full flex-col rounded-panel p-6 glass glass-sheen">
                  <span
                    aria-hidden="true"
                    className="absolute right-6 top-5 text-h2 font-bold text-content-muted/40"
                  >
                    {index + 1}
                  </span>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
                    <Icon name={stage.icon} size={22} />
                  </span>
                  <h3 className="mt-5 text-h4 font-semibold text-content">{stage.title}</h3>
                  <p className="mt-2 text-pretty text-body-sm text-content-secondary">
                    {stage.description}
                  </p>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>

        <div className="mt-10 text-center">
          <Link
            href="/solutions"
            className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
          >
            See what it does for insurers
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      </Section>

      {/* ── Enterprise security ──────────────────────────────────────────── */}
      <Section aria-labelledby="security-title">
        <SectionHeading
          id="security-title"
          overline="Enterprise security"
          title="Built to hold personal records safely"
          description="Insurance data is medical history, income and family detail. These are the protections that are in place today, described plainly rather than as a badge."
        />
        <FeatureGrid className="mt-12" features={SECURITY} columns={2} />

        <p className="mt-8 max-w-3xl text-pretty text-caption text-content-muted">
          We describe what the platform does rather than claim certifications it has not been
          audited for. If you need a formal security review for a procurement process, ask us on the
          demo call and we will tell you exactly where we stand.
        </p>
      </Section>

      {/* ── Customer success (honest placeholder) ────────────────────────── */}
      <Section tone="sunken" aria-labelledby="success-title">
        <SectionHeading
          id="success-title"
          overline="Customer success"
          title="This is where our customers will speak"
          description="We have not published testimonials yet, and we are not going to invent them. When real customers have real results, their words will be here — with their names on them."
          align="center"
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="flex h-full flex-col gap-4 rounded-panel border border-dashed border-line/40 p-6"
            >
              <div className="h-3 w-3/4 rounded-pill bg-surface-raised/40" />
              <div className="h-3 w-full rounded-pill bg-surface-raised/30" />
              <div className="h-3 w-5/6 rounded-pill bg-surface-raised/30" />
              <div className="mt-auto flex items-center gap-3 pt-4">
                <div className="h-9 w-9 rounded-full bg-surface-raised/40" />
                <div className="flex flex-col gap-1.5">
                  <div className="h-2.5 w-24 rounded-pill bg-surface-raised/40" />
                  <div className="h-2.5 w-16 rounded-pill bg-surface-raised/25" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-pretty text-center text-body-sm text-content-secondary">
          Would you like to be one of them?{" "}
          <Link
            href="/request-demo"
            className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
          >
            Talk to us about an early deployment
          </Link>
          .
        </p>
      </Section>

      <CTABand
        title="Start where it suits you"
        description="Read and compare without an account, or sign in to pick up where you left off. If you are evaluating Aegis for an organisation, a demo is the faster route."
        primary={{ label: "Get started", href: "/get-started" }}
        secondary={{ label: "Request a demo", href: "/request-demo" }}
        note="We reply to demo requests within one working day."
      />
    </>
  );
}
