import { pageMetadata } from "@/lib/seo";
import { Section, SectionHeading } from "@/components/sections/Section";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { CTABand } from "@/components/sections/CTABand";
import { Reveal } from "@/components/ui/Reveal";
import { Icon } from "@/components/ui/Icon";

export const metadata = pageMetadata({
  title: "About us",
  description:
    "Why Aegis AI exists: the people insurance usually underserves, and what we are building for them.",
  path: "/about",
});

const VALUES = [
  {
    icon: "translate" as const,
    title: "Clarity outranks cleverness",
    description:
      "If a sentence needs a glossary, it is our sentence that is wrong. Every explanation is written for someone reading it for the first time, under pressure.",
  },
  {
    icon: "scales" as const,
    title: "Show the reasoning",
    description:
      "A recommendation without its reasoning is just an instruction. We show what was weighed so a person can disagree with it — and sometimes they should.",
  },
  {
    icon: "users" as const,
    title: "Design for the edge first",
    description:
      "If it works for a 70-year-old on a slow connection in Tamil, it works for everyone. The reverse is not true, which is why most products get this backwards.",
  },
  {
    icon: "shield" as const,
    title: "Protect before you sell",
    description:
      "Telling someone they already have adequate cover is a good outcome. A platform that cannot say that is not advising, it is selling.",
  },
  {
    icon: "lock" as const,
    title: "Earn the data",
    description:
      "Insurance records are medical history and family circumstances. We collect what we need to help, scope every query to its owner, and treat a leak as the worst thing we could do.",
  },
  {
    icon: "eye" as const,
    title: "Say what is true",
    description:
      "No invented testimonials, no certifications we have not passed, no capabilities that only exist in a slide. What this site claims, the platform does.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Section spacing="loose" width="narrow" aria-labelledby="about-title">
        <SectionHeading
          id="about-title"
          as="h1"
          overline="About us"
          title="We built this because the paperwork wins too often"
          description="Aegis AI is an enterprise insurance platform with an unusual priority order: educate, guide, then protect. Selling is what happens after all three."
          align="center"
        />
      </Section>

      {/* ── Founder story ────────────────────────────────────────────────── */}
      <Section tone="sunken" width="narrow" aria-labelledby="story-title">
        <SectionHeading id="story-title" overline="Founder story" title="Why we built Aegis AI" />

        <div className="mt-8 flex flex-col gap-5 text-pretty text-body text-content-secondary">
          <p>
            Almost everyone has a version of the same story. A family member buys a policy because
            somebody they trusted recommended it. Nobody reads the wording — it is twenty pages of
            language written for a regulator, not for them. Years of premiums go out. Then something
            happens, the claim is made, and a clause nobody had ever explained decides the answer.
          </p>
          <p>
            The failure is almost never fraud. It is a waiting period, an exclusion, a room-rent
            cap, a sum insured that made sense a decade ago. Small print that was technically
            disclosed and practically invisible. The person did everything they were told to do and
            still ended up unprotected at the exact moment protection was the point.
          </p>
          <p>
            What makes that worse is who it happens to most. Families where a hospital bill is the
            difference between stability and debt. First-time buyers with nobody to ask. Senior
            citizens navigating an interface designed for somebody thirty years younger. People
            reading English as a second or third language, in a market where the explanation is
            rarely offered in their first.
          </p>
          <p>
            Aegis AI started from a straightforward question: what would it take for the explanation
            to arrive <em>before</em> the signature? Not a chatbot bolted onto a catalogue — a
            platform whose first job is to make sure the person understands what they are about to
            hold, in their own language, and whose recommendation shows its working so it can be
            argued with.
          </p>
          <p>
            That is a harder product to build than a comparison table, and it is a slower one to
            sell. It is also the only version worth building.
          </p>
        </div>
      </Section>

      {/* ── Mission & vision ─────────────────────────────────────────────── */}
      <Section aria-labelledby="mv-title">
        <SectionHeading
          id="mv-title"
          overline="What we are for"
          title="Mission and vision"
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
                To make insurance understandable to the people it most often fails. We educate
                first, guide second, and sell last — and we measure ourselves on whether someone
                left knowing more than they arrived with.
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
                A market where nobody learns what their policy excludes at the moment they need it.
                Where protection is chosen knowingly, in the buyer&rsquo;s own language, and the
                document holds no surprises because all of them were explained up front.
              </p>
            </article>
          </Reveal>
        </div>
      </Section>

      {/* ── Values ───────────────────────────────────────────────────────── */}
      <Section tone="sunken" aria-labelledby="values-title">
        <SectionHeading
          id="values-title"
          overline="Core values"
          title="The six rules we actually argue about"
          description="These are not wall decorations. Each one has settled a real design disagreement, usually by making the work harder."
        />
        <FeatureGrid className="mt-12" features={VALUES} columns={3} />
      </Section>

      <CTABand
        title="Want to see whether we mean it?"
        description="The fastest way to judge a platform like this is to watch it explain something you already understand well — and see whether it gets it right."
        primary={{ label: "Request a demo", href: "/request-demo" }}
        secondary={{ label: "Talk to us", href: "/contact" }}
      />
    </>
  );
}
