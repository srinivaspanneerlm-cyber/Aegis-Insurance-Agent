import { pageMetadata } from "@/lib/seo";
import { CONTACT, SOCIALS } from "@/lib/site";
import { Section, SectionHeading } from "@/components/sections/Section";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { Icon, type IconName } from "@/components/ui/Icon";

export const metadata = pageMetadata({
  title: "Contact",
  description:
    "Talk to the Aegis AI team — by email, by phone, or by sending us a note about what you are trying to work out.",
  path: "/contact",
});

const DETAILS: readonly {
  icon: IconName;
  label: string;
  value: string;
  href?: string;
  note?: string;
}[] = [
  {
    icon: "mail",
    label: "General enquiries",
    value: CONTACT.email,
    href: `mailto:${CONTACT.email}`,
  },
  {
    icon: "briefcase",
    label: "Sales and partnerships",
    value: CONTACT.salesEmail,
    href: `mailto:${CONTACT.salesEmail}`,
  },
  {
    icon: "phone",
    label: "Phone",
    value: CONTACT.phone,
    href: `tel:${CONTACT.phone.replace(/\s/g, "")}`,
    note: CONTACT.hours,
  },
];

export default function ContactPage() {
  return (
    <>
      <Section spacing="loose" width="narrow" aria-labelledby="contact-title">
        <SectionHeading
          id="contact-title"
          as="h1"
          overline="Contact"
          title="Talk to a person"
          description="Whether you are trying to understand a policy, evaluating Aegis for an organisation, or just want to know whether we can help — this reaches us."
          align="center"
        />
      </Section>

      <Section spacing="tight" aria-labelledby="form-title">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 id="form-title" className="sr-only">
              Send us a message
            </h2>
            <EnquiryForm
              kind="contact"
              submitLabel="Send message"
              successTitle="Thank you — that reached us"
              successBody="We reply to everything within one working day. If it is urgent, the phone number on this page is faster."
            />
          </div>

          <div className="flex flex-col gap-5 lg:col-span-5">
            <div className="rounded-panel p-6 glass glass-sheen sm:p-8">
              <h2 className="text-h4 font-semibold text-content">Reach us directly</h2>
              <ul className="mt-5 flex flex-col gap-5">
                {DETAILS.map((detail) => (
                  <li key={detail.label} className="flex items-start gap-3.5">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
                      <Icon name={detail.icon} size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-caption font-semibold uppercase tracking-wide text-content-muted">
                        {detail.label}
                      </p>
                      {detail.href ? (
                        <a
                          href={detail.href}
                          className="focus-ring mt-0.5 block truncate rounded text-body font-medium text-content hover:text-brand"
                        >
                          {detail.value}
                        </a>
                      ) : (
                        <p className="mt-0.5 text-body font-medium text-content">{detail.value}</p>
                      )}
                      {detail.note ? (
                        <p className="mt-1 text-caption text-content-muted">{detail.note}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-panel p-6 glass glass-sheen sm:p-8">
              <h2 className="text-h4 font-semibold text-content">Office</h2>
              <div className="mt-4 flex items-start gap-3.5">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
                  <Icon name="pin" size={18} />
                </span>
                {/* An address is a real address — <address> is the element for it,
                    and it gives assistive technology the right context. */}
                <address className="text-body not-italic text-content-secondary">
                  {CONTACT.address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
            </div>

            <div className="rounded-panel p-6 glass glass-sheen sm:p-8">
              <h2 className="text-h4 font-semibold text-content">Elsewhere</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {SOCIALS.map((social) => (
                  <li key={social.href}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring inline-flex items-center gap-1.5 rounded-pill border border-line/60 bg-surface-raised/40 px-3.5 py-2 text-body-sm text-content-secondary transition-colors duration-fast hover:border-line hover:text-content"
                    >
                      {social.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
