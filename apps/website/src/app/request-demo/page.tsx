import { pageMetadata } from "@/lib/seo";
import { Section, SectionHeading } from "@/components/sections/Section";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { Icon } from "@/components/ui/Icon";

export const metadata = pageMetadata({
  title: "Request a demo",
  description:
    "See Aegis AI against your own products and edge cases. Tell us what you run and we will prepare the demo accordingly.",
  path: "/request-demo",
});

const WHAT_TO_EXPECT = [
  {
    icon: "clock" as const,
    title: "Forty-five minutes",
    description:
      "Long enough to see the platform work on a real case, short enough to fit in a working day.",
  },
  {
    icon: "compass" as const,
    title: "Your products, not ours",
    description:
      "We prepare using the cover you actually sell and the cases that cause you the most trouble.",
  },
  {
    icon: "users" as const,
    title: "Bring whoever needs to see it",
    description:
      "Underwriting, claims, technology and compliance ask different questions. All of them are welcome.",
  },
  {
    icon: "eye" as const,
    title: "A straight answer on maturity",
    description:
      "We will tell you what is production-ready today and what is not. You will find out either way, so it may as well be now.",
  },
];

export default function RequestDemoPage() {
  return (
    <>
      <Section spacing="loose" width="narrow" aria-labelledby="demo-title">
        <SectionHeading
          id="demo-title"
          as="h1"
          overline="Request a demo"
          title="See it against your own portfolio"
          description="A generic demo tells you very little. Tell us what you run, and we will show you the platform doing your work rather than ours."
          align="center"
        />
      </Section>

      <Section spacing="tight" aria-labelledby="demo-form-title">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 id="demo-form-title" className="sr-only">
              Demo request form
            </h2>
            <EnquiryForm
              kind="demo"
              submitLabel="Request demo"
              successTitle="Request received"
              successBody="We will be in touch within one working day to arrange a time. If anything changes in the meantime, reply to that email and it reaches the same person."
            />
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-panel p-6 glass glass-sheen sm:p-8">
              <h2 className="text-h4 font-semibold text-content">What to expect</h2>
              <ul className="mt-6 flex flex-col gap-6">
                {WHAT_TO_EXPECT.map((item) => (
                  <li key={item.title} className="flex items-start gap-3.5">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
                      <Icon name={item.icon} size={18} />
                    </span>
                    <div>
                      <h3 className="text-body font-medium text-content">{item.title}</h3>
                      <p className="mt-1 text-pretty text-body-sm text-content-secondary">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-8 text-pretty border-t border-line/40 pt-6 text-caption text-content-muted">
                Not ready for a call? The{" "}
                <a
                  href="/resources"
                  className="focus-ring rounded text-brand underline underline-offset-4"
                >
                  resources
                </a>{" "}
                cover most of what a demo would, and nobody will follow up.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
