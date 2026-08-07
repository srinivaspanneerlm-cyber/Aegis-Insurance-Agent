import { pageMetadata } from "@/lib/seo";
import { Section, SectionHeading } from "@/components/sections/Section";
import { CTABand } from "@/components/sections/CTABand";
import { Icon } from "@/components/ui/Icon";
import { CONTACT } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Support",
  description: "How to get help with Aegis AI — and how quickly you can expect an answer.",
  path: "/support",
});

/**
 * Getting help.
 *
 * Leads with the channel that resolves a problem fastest rather than the one
 * cheapest to staff. A support page whose first offer is a form is a support
 * page written for the company.
 */
const CHANNELS = [
  {
    icon: "spark" as const,
    title: "Ask the advisor",
    body: "Fastest for questions about cover, claims and renewals. Available whenever you are, and it will hand you to a person when the question needs one.",
    action: { label: "Open the advisor", href: "/get-started" },
  },
  {
    icon: "mail" as const,
    title: "Email us",
    body: "Best for anything involving documents or an existing case. Include your policy number if you have one.",
    action: { label: CONTACT.email, href: `mailto:${CONTACT.email}` },
  },
  {
    icon: "phone" as const,
    title: "Call us",
    body: "For anything urgent, and for anyone who would simply rather speak to somebody.",
    action: { label: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s+/g, "")}` },
  },
];

export default function SupportPage() {
  return (
    <>
      <Section spacing="loose" width="narrow" aria-labelledby="support-title">
        <SectionHeading
          id="support-title"
          overline="Support"
          title="Getting help"
          description="Three ways to reach us. Use whichever suits you — none of them puts you further back in a queue."
        />
      </Section>

      <Section tone="sunken" aria-labelledby="support-channels">
        <h2 id="support-channels" className="sr-only">
          Support channels
        </h2>
        <ul className="grid gap-5 md:grid-cols-3">
          {CHANNELS.map((channel) => (
            <li
              key={channel.title}
              className="flex flex-col rounded-card border border-line/50 bg-surface-raised/30 p-6"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand"
              >
                <Icon name={channel.icon} />
              </span>
              <h3 className="mt-4 text-body font-semibold text-content">{channel.title}</h3>
              <p className="mt-2 flex-1 text-pretty text-body-sm text-content-secondary">
                {channel.body}
              </p>
              <a
                href={channel.action.href}
                className="focus-ring mt-4 inline-block rounded text-body-sm font-medium text-brand"
              >
                {channel.action.label}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section aria-labelledby="support-expect">
        <SectionHeading
          id="support-expect"
          overline="What to expect"
          title="Response times, stated plainly"
          description="These are the times we hold ourselves to. If we are going to miss one, we tell you rather than letting it pass quietly."
        />
        <dl className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { term: "Advisor", detail: "Immediate" },
            { term: "Email", detail: "One working day" },
            { term: "Phone", detail: `${CONTACT.hours}` },
          ].map((row) => (
            <div
              key={row.term}
              className="rounded-card border border-line/50 bg-surface-raised/30 p-5"
            >
              <dt className="text-caption uppercase tracking-wide text-content-muted">
                {row.term}
              </dt>
              <dd className="mt-1 text-body font-semibold text-content">{row.detail}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section spacing="tight">
        <CTABand
          title="Still stuck?"
          description="Send us the details and a person will pick it up."
          primary={{ label: "Contact us", href: "/contact" }}
        />
      </Section>
    </>
  );
}
