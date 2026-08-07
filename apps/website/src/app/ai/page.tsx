import { pageMetadata } from "@/lib/seo";
import { Section, SectionHeading } from "@/components/sections/Section";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { CTABand } from "@/components/sections/CTABand";
import { CAPABILITIES } from "@/lib/site";

export const metadata = pageMetadata({
  title: "AI",
  description:
    "How the Aegis advisors work: what they can do, what they will not do, and who decides.",
  path: "/ai",
});

/**
 * What the AI actually does.
 *
 * Written to answer the question a cautious buyer asks first — not "how clever
 * is it" but "what happens when it is wrong". So the limits are given the same
 * weight as the capabilities, and the sentence that matters most is the one
 * about a person making the decision.
 */
export default function AIPage() {
  return (
    <>
      <Section spacing="loose" width="narrow" aria-labelledby="ai-title">
        <SectionHeading
          id="ai-title"
          overline="Artificial intelligence"
          title="Advisors that explain themselves"
          description="Aegis uses AI to make insurance legible — to ask what somebody needs before recommending anything, and to say why. It does not decide claims, and it does not sell."
        />
      </Section>

      <Section tone="sunken" aria-labelledby="ai-capabilities">
        <SectionHeading
          id="ai-capabilities"
          overline="What it does"
          title="Eight things, done properly"
        />
        <FeatureGrid className="mt-12" features={CAPABILITIES} columns={2} />
      </Section>

      <Section aria-labelledby="ai-limits">
        <SectionHeading
          id="ai-limits"
          overline="What it will not do"
          title="The limits are the point"
          description="An AI platform in insurance earns trust by what it refuses to do on its own."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "It never settles or refuses a claim",
              body: "The platform can gather, check and flag. A person decides, and their name is on the decision.",
            },
            {
              title: "It never quotes a price as final",
              body: "Estimates are labelled as estimates. A premium is what an insurer underwrites, not what a model guessed.",
            },
            {
              title: "It never hides its reasoning",
              body: "Every recommendation carries why it was made, what it does not cover, and what else you could do.",
            },
            {
              title: "It never invents a fact about you",
              body: "Anything the platform believes about a customer records where it came from, and can be challenged.",
            },
          ].map((item) => (
            <li
              key={item.title}
              className="rounded-card border border-line/50 bg-surface-raised/30 p-6"
            >
              <h3 className="text-pretty text-body font-semibold text-content">{item.title}</h3>
              <p className="mt-2 text-pretty text-body-sm text-content-secondary">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section spacing="tight">
        <CTABand
          title="See it answer a real question"
          description="Ask an advisor something you actually want to know about your cover. No sales call attached."
          primary={{ label: "Talk to an advisor", href: "/get-started" }}
          secondary={{ label: "Read how it works", href: "/solutions" }}
        />
      </Section>
    </>
  );
}
