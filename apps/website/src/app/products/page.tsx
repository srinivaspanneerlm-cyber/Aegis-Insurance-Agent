import { pageMetadata } from "@/lib/seo";
import { Section, SectionHeading } from "@/components/sections/Section";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { CTABand } from "@/components/sections/CTABand";
import { Icon } from "@/components/ui/Icon";
import { PRODUCTS } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Products",
  description:
    "Motor, health, property and travel cover — explained in plain language, compared on the terms that decide a claim.",
  path: "/products",
});

/**
 * Product copy is written around what decides a claim, not around what markets
 * well. The waiting period and the room-rent cap are what people find out too
 * late, so they are named here rather than left to the wording.
 */
const HOW = [
  {
    icon: "search" as const,
    title: "We ask what you need first",
    description:
      "Who is being covered, what they already hold, and what would actually hurt financially. Not a quote form.",
  },
  {
    icon: "scales" as const,
    title: "We compare on what decides claims",
    description:
      "Exclusions, waiting periods and limits sit next to price, because those are the terms people find out about too late.",
  },
  {
    icon: "book" as const,
    title: "We explain, then recommend",
    description:
      "You see the reasoning before the suggestion. If your existing cover is already adequate, we say so.",
  },
];

export default function ProductsPage() {
  return (
    <>
      <Section spacing="loose" width="narrow" aria-labelledby="products-title">
        <SectionHeading
          id="products-title"
          as="h1"
          overline="Products"
          title="Cover explained before it is sold"
          description="Four kinds of insurance today, with a fifth on the way. Each one is presented the same way: what it protects, what it does not, and what decides the outcome when you claim."
          align="center"
        />
      </Section>

      <Section spacing="tight" aria-labelledby="catalogue-title">
        <h2 id="catalogue-title" className="sr-only">
          Available products
        </h2>
        <FeatureGrid features={PRODUCTS} columns={2} />
      </Section>

      <Section tone="sunken" aria-labelledby="how-title">
        <SectionHeading
          id="how-title"
          overline="How we present them"
          title="The same three steps for every product"
          align="center"
        />
        <FeatureGrid className="mt-12" features={HOW} columns={3} />
      </Section>

      <Section width="narrow" aria-labelledby="honest-title">
        <div className="rounded-panel p-8 glass glass-sheen">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-accent">
            <Icon name="scales" size={22} />
          </span>
          <h2 id="honest-title" className="mt-5 text-h3 font-semibold text-content">
            What this page is not
          </h2>
          <p className="mt-3 text-pretty text-body text-content-secondary">
            Aegis AI helps you understand and compare cover. It is not the insurer, and nothing here
            replaces the policy wording — that document is what governs your claim. Where our
            explanation and the wording ever disagree, the wording wins, and we will tell you where
            to look.
          </p>
        </div>
      </Section>

      <CTABand
        title="Find out what you actually need"
        description="Start with a question rather than a quote. You can read and compare without creating an account."
        primary={{ label: "Get started", href: "/get-started" }}
        secondary={{ label: "See our solutions", href: "/solutions" }}
      />
    </>
  );
}
