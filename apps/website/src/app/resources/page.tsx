import Link from "next/link";
import { buttonVariants } from "@aegis/ui";
import { pageMetadata } from "@/lib/seo";
import { Section, SectionHeading } from "@/components/sections/Section";
import { FeatureGrid, type Feature } from "@/components/sections/FeatureGrid";
import { CTABand } from "@/components/sections/CTABand";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";
import { Icon } from "@/components/ui/Icon";

export const metadata = pageMetadata({
  title: "Resources",
  description:
    "Insurance guides, frequently asked questions and a knowledge centre — written for people reading about cover for the first time.",
  path: "/resources",
});

const GUIDES: readonly Feature[] = [
  {
    icon: "heart",
    title: "Health insurance, from scratch",
    description:
      "Sum insured, waiting periods, room-rent limits and what a family floater really shares. The four things that decide most hospital claims.",
  },
  {
    icon: "car",
    title: "Motor cover without the jargon",
    description:
      "Third-party against comprehensive, what own-damage pays for, and which add-ons earn their premium.",
  },
  {
    icon: "home",
    title: "Protecting a home you rent or own",
    description:
      "Structure against contents, what a tenant actually needs, and how a sum insured is arrived at.",
  },
  {
    icon: "plane",
    title: "Travelling with cover that holds",
    description:
      "Medical limits abroad, what counts as a valid cancellation, and how pre-existing conditions are treated.",
  },
  {
    icon: "scales",
    title: "Reading a policy document",
    description:
      "Where the exclusions hide, which clauses decide a claim, and the five sections worth reading before you sign.",
  },
  {
    icon: "refresh",
    title: "Renewals, lapses and grace periods",
    description:
      "What you lose when a policy lapses, what a grace period does and does not protect, and when to re-assess.",
  },
];

/**
 * Questions written the way people actually ask them, and answered without
 * requiring the reader to already understand the answer. Each one is a real
 * question — none is a marketing line phrased as a question.
 */
const FAQ: readonly AccordionItem[] = [
  {
    question: "Do I need an account to use Aegis AI?",
    answer:
      "No. You can read, compare and get explanations without creating one. An account exists so that your documents and progress are there when you come back — it is not a gate in front of the information.",
  },
  {
    question: "Is Aegis AI an insurance company?",
    answer:
      "No. Aegis AI is a platform that helps you understand and compare cover offered by insurers. The policy itself is between you and the insurer, and the policy wording is what governs your claim.",
  },
  {
    question: "Does it cost anything to use?",
    answer:
      "Understanding and comparing cover on the platform is free to individuals. Where Aegis is deployed by an insurer or an employer, that organisation covers the cost.",
  },
  {
    question: "Can I use it in Tamil?",
    answer:
      "Yes. Explanations are available in English and Tamil, including mixed English-Tamil, which is how a great many people actually speak. You do not have to pick a language and stick to it.",
  },
  {
    question: "What happens to the documents I upload?",
    answer:
      "They are stored against your account and used to answer your questions. Every query that returns personal data is scoped to the account that owns it, so your documents never form part of someone else's answer.",
  },
  {
    question: "Will it tell me not to buy something?",
    answer:
      "Yes, and that is deliberate. If the cover you already hold is adequate, the useful answer is to say so. A platform that can only recommend buying is not advising you.",
  },
  {
    question: "How does it decide what to recommend?",
    answer:
      "It weighs your circumstances against the terms that decide claims — exclusions, waiting periods, limits — alongside price. Every recommendation shows what it weighed, so you can disagree with it where your own judgement differs.",
  },
  {
    question: "What if the explanation and the policy wording disagree?",
    answer:
      "The wording wins, always. Our explanation is there to help you read the document, not to replace it — and where the two appear to differ, we will point you at the clause so you can check.",
  },
  {
    question: "Can my organisation deploy this?",
    answer:
      "Yes. Aegis is built to run alongside the systems an insurer already operates rather than replacing them. A demo is the fastest way to work out what a deployment would look like for you.",
  },
];

const KNOWLEDGE: readonly Feature[] = [
  {
    icon: "book",
    title: "Terms, defined plainly",
    description:
      "Deductible, co-payment, sub-limit, sum insured, IDV, no-claim bonus — each defined in a sentence a person can use.",
  },
  {
    icon: "compass",
    title: "Choosing by situation",
    description:
      "What changes when you marry, have a child, buy a vehicle, turn sixty, or start supporting a parent.",
  },
  {
    icon: "bolt",
    title: "When you need to claim",
    description:
      "What to do first, which documents to gather, and the mistakes that most often delay a straightforward claim.",
  },
];

export default function ResourcesPage() {
  return (
    <>
      <Section spacing="loose" width="narrow" aria-labelledby="resources-title">
        <SectionHeading
          id="resources-title"
          as="h1"
          overline="Resources"
          title="Written for someone reading this for the first time"
          description="No prior knowledge assumed, no jargon left undefined. If a paragraph here needs a glossary, treat it as a fault in our writing."
          align="center"
        />
      </Section>

      {/* ── Guides ───────────────────────────────────────────────────────── */}
      <Section id="guides" spacing="tight" aria-labelledby="guides-title">
        <SectionHeading
          id="guides-title"
          overline="Insurance guides"
          title="Start with the product you are thinking about"
          description="Each guide covers what it protects, what it does not, and what decides the outcome when you claim."
        />
        <FeatureGrid className="mt-10" features={GUIDES} columns={3} />
        <p className="mt-6 text-caption text-content-muted">
          Guides open inside the platform, where they can be answered in your language and applied
          to cover you already hold.
        </p>
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Section id="faq" tone="sunken" width="narrow" aria-labelledby="faq-title">
        <SectionHeading
          id="faq-title"
          overline="Frequently asked"
          title="Questions people actually ask us"
        />
        <div className="mt-10">
          <Accordion items={FAQ} />
        </div>
      </Section>

      {/* ── Knowledge centre ─────────────────────────────────────────────── */}
      <Section id="knowledge" aria-labelledby="knowledge-title">
        <SectionHeading
          id="knowledge-title"
          overline="Knowledge centre"
          title="The reference material behind the guides"
        />
        <FeatureGrid className="mt-10" features={KNOWLEDGE} columns={3} />
      </Section>

      {/* ── Documentation (future) ───────────────────────────────────────── */}
      <Section id="documentation" tone="sunken" width="narrow" aria-labelledby="docs-title">
        <div className="flex flex-col items-start gap-5 rounded-panel p-8 glass glass-sheen sm:flex-row sm:items-center">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-content-muted">
            <Icon name="layers" size={24} />
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="docs-title" className="text-h3 font-semibold text-content">
                Technical documentation
              </h2>
              <span className="rounded-pill border border-line/70 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-content-muted">
                Coming soon
              </span>
            </div>
            <p className="mt-2 text-pretty text-body-sm text-content-secondary">
              API references, integration guides and deployment notes for teams building on Aegis.
              Until it is published, the demo call is where those questions get answered — and by
              someone who can answer them properly.
            </p>
          </div>
          <Link
            href="/request-demo"
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            Ask us directly
          </Link>
        </div>
      </Section>

      <CTABand
        title="Still not sure what you need?"
        description="Reading is a good start, but the platform can look at the cover you actually hold and tell you where the gaps are."
        primary={{ label: "Get started", href: "/get-started" }}
        secondary={{ label: "Contact us", href: "/contact" }}
      />
    </>
  );
}
