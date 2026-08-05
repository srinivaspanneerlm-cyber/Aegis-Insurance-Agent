import { pageMetadata } from "@/lib/seo";
import { Section, SectionHeading } from "@/components/sections/Section";
import { FeatureGrid, type Feature } from "@/components/sections/FeatureGrid";
import { CTABand } from "@/components/sections/CTABand";
import { Reveal } from "@/components/ui/Reveal";
import { Icon } from "@/components/ui/Icon";

export const metadata = pageMetadata({
  title: "Solutions",
  description:
    "For individuals and for insurers: guided cover, claims automation, renewal intelligence, fraud detection and the enterprise AI platform underneath.",
  path: "/solutions",
});

const AUDIENCES = [
  {
    id: "individuals",
    icon: "users" as const,
    eyebrow: "For individuals and families",
    title: "Understand what you hold, before you need it",
    description:
      "Most people cannot say what their policy excludes. That is not their failure — it is a document problem. Aegis reads the cover you have, explains it in your language, and tells you where the gaps are.",
    points: [
      "Plain-language explanations in English and Tamil",
      "Comparison on exclusions and limits, not only price",
      "Renewal and expiry tracked so nothing lapses quietly",
      "Told when your existing cover is already enough",
    ],
  },
  {
    id: "insurers",
    icon: "building" as const,
    eyebrow: "For insurance companies",
    title: "Fewer mis-sold policies, fewer disputed claims",
    description:
      "A customer who understood their cover at purchase is a customer who does not dispute it at claim. The economics of explaining properly are better than they look — and the regulatory direction is only going one way.",
    points: [
      "Suitability evidenced at the point of sale",
      "Lower claim-stage disputes and complaints",
      "Reach into languages and segments you do not serve today",
      "Deploy alongside existing systems rather than replacing them",
    ],
  },
];

const CAPABILITIES: readonly Feature[] = [
  {
    icon: "bolt",
    title: "Claims automation",
    description:
      "Intake, document handling and assessment support, so a straightforward claim moves without a person having to chase it — and a complex one reaches an assessor with the context already gathered.",
    points: [
      "Guided intake that asks for the right documents once",
      "Automatic completeness checks before submission",
      "Straightforward cases routed away from manual queues",
      "Every decision traceable end to end",
    ],
  },
  {
    icon: "refresh",
    title: "Renewal intelligence",
    description:
      "Most lapses are not decisions — they are a missed message. Renewals are surfaced early, with what has changed since last year, in time for the customer to act.",
    points: [
      "Expiry and grace periods tracked per policy",
      "What changed since the last term, in plain terms",
      "Reminders timed to be useful rather than annoying",
      "Re-assessment when circumstances have moved",
    ],
  },
  {
    icon: "search",
    title: "Fraud detection",
    description:
      "Pattern and consistency signals across an application and its documents, so investigators spend their time on the cases that warrant it.",
    points: [
      "Document and declaration consistency checks",
      "Anomaly signals surfaced with their reasoning",
      "Flags a human decides on — never an automatic refusal",
      "Full audit trail behind every signal",
    ],
  },
  {
    icon: "layers",
    title: "Enterprise AI platform",
    description:
      "The layer the rest of this runs on: typed contracts, provider-agnostic language models, per-account isolation and a complete audit trail.",
    points: [
      "Provider-agnostic — no single vendor lock-in",
      "Strict isolation between accounts and domains",
      "Capability-based access, granted rather than assumed",
      "Audit trail across every automated decision",
    ],
  },
];

export default function SolutionsPage() {
  return (
    <>
      <Section spacing="loose" width="narrow" aria-labelledby="solutions-title">
        <SectionHeading
          id="solutions-title"
          as="h1"
          overline="Solutions"
          title="Two audiences, one platform"
          description="What an individual needs from insurance and what an insurer needs from their portfolio look different. They turn out to be the same problem seen from two ends."
          align="center"
        />
      </Section>

      {/* ── Audiences ────────────────────────────────────────────────────── */}
      <Section spacing="tight" aria-labelledby="audiences-title">
        <h2 id="audiences-title" className="sr-only">
          Who it is for
        </h2>
        <div className="grid gap-5 lg:grid-cols-2">
          {AUDIENCES.map((audience, index) => (
            <Reveal key={audience.id} delay={index * 80}>
              <article
                id={audience.id}
                className="flex h-full scroll-mt-24 flex-col rounded-panel p-8 glass glass-sheen"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
                  <Icon name={audience.icon} size={24} />
                </span>
                <p className="mt-5 text-overline font-semibold uppercase text-brand">
                  {audience.eyebrow}
                </p>
                <h3 className="mt-2 text-balance text-h2 font-bold tracking-tight text-content">
                  {audience.title}
                </h3>
                <p className="mt-4 text-pretty text-body text-content-secondary">
                  {audience.description}
                </p>
                <ul className="mt-6 flex flex-col gap-3">
                  {audience.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 text-body-sm text-content-secondary"
                    >
                      <Icon name="check" size={16} className="mt-0.5 shrink-0 text-success" />
                      <span className="text-pretty">{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── Capabilities ─────────────────────────────────────────────────── */}
      <Section tone="sunken" aria-labelledby="capabilities-title">
        <SectionHeading
          id="capabilities-title"
          overline="Capabilities"
          title="What the platform does for an insurer"
          description="Four capabilities that can be adopted one at a time. None of them requires replacing the systems you already run."
        />
        <FeatureGrid className="mt-12" features={CAPABILITIES} columns={2} />
      </Section>

      {/* ── Deployment honesty ───────────────────────────────────────────── */}
      <Section width="narrow" aria-labelledby="maturity-title">
        <div className="rounded-panel p-8 glass glass-sheen">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-accent">
            <Icon name="eye" size={22} />
          </span>
          <h2 id="maturity-title" className="mt-5 text-h3 font-semibold text-content">
            Where each capability stands
          </h2>
          <p className="mt-3 text-pretty text-body text-content-secondary">
            These capabilities are at different stages of maturity, and we would rather tell you
            which on a call than imply on a web page that they are all equally finished. Ask us
            directly — a specific answer about what is production-ready today is more useful to your
            evaluation than a page of green ticks.
          </p>
        </div>
      </Section>

      <CTABand
        title="See it against your own portfolio"
        description="The useful version of a demo uses your products and your edge cases. Tell us what you run and we will prepare accordingly."
        primary={{ label: "Request a demo", href: "/request-demo" }}
        secondary={{ label: "Which industries", href: "/industries" }}
      />
    </>
  );
}
