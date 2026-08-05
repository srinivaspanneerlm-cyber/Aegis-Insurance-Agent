import { pageMetadata } from "@/lib/seo";
import { Section, SectionHeading } from "@/components/sections/Section";
import { CTABand } from "@/components/sections/CTABand";
import { Reveal } from "@/components/ui/Reveal";
import { Icon, type IconName } from "@/components/ui/Icon";

export const metadata = pageMetadata({
  title: "Industries",
  description:
    "Insurance today; banking, healthcare and government are where the same explanation problem appears next.",
  path: "/industries",
});

interface Industry {
  icon: IconName;
  name: string;
  status: "Available today" | "Future";
  summary: string;
  detail: string;
  points: readonly string[];
}

/**
 * One industry is real and three are directions. Saying which is which on the
 * page itself is the difference between a roadmap and a claim — and a
 * procurement team can tell the difference in about four seconds.
 */
const INDUSTRIES: readonly Industry[] = [
  {
    icon: "shield",
    name: "Insurance",
    status: "Available today",
    summary: "Where the platform is built, deployed and proven.",
    detail:
      "Health, motor, property and travel cover, for individuals through to insurer portfolios. Everything else on this page is the same idea applied elsewhere; this is the one it was designed around.",
    points: [
      "Guided cover selection and comparison",
      "Claims intake and assessment support",
      "Renewal and lapse prevention",
      "Underwriting and portfolio oversight",
    ],
  },
  {
    icon: "bank",
    name: "Banking",
    status: "Future",
    summary: "Lending and deposit products have the same comprehension gap.",
    detail:
      "A loan agreement fails a borrower in the same way a policy fails a claimant: the terms that decide the outcome are disclosed but not understood. The explanation layer transfers almost directly.",
    points: [
      "Loan terms explained before signature",
      "Suitability evidenced at the point of sale",
      "Repayment and default consequences made concrete",
    ],
  },
  {
    icon: "stethoscope",
    name: "Healthcare",
    status: "Future",
    summary: "Where a health policy meets an actual hospital bill.",
    detail:
      "The gap between what a patient believes is covered and what the hospital will bill is where most financial distress in Indian healthcare begins. Closing it needs both sides of that conversation.",
    points: [
      "Cashless eligibility made clear in advance",
      "Estimate against cover, before admission",
      "Discharge and reimbursement guidance",
    ],
  },
  {
    icon: "landmark",
    name: "Government",
    status: "Future",
    summary: "Public schemes that people are eligible for and never claim.",
    detail:
      "Take-up of public insurance and welfare schemes is limited far more by comprehension and paperwork than by eligibility. The same guidance layer applies, with a much larger audience.",
    points: [
      "Scheme eligibility explained plainly",
      "Documentation guidance in regional languages",
      "Accessible on low-end devices and slow connections",
    ],
  },
];

export default function IndustriesPage() {
  return (
    <>
      <Section spacing="loose" width="narrow" aria-labelledby="industries-title">
        <SectionHeading
          id="industries-title"
          as="h1"
          overline="Industries"
          title="One industry today, three where the same problem waits"
          description="Aegis solves a comprehension problem that happens to live in insurance. We are clear about which of these we serve now and which are direction."
          align="center"
        />
      </Section>

      <Section spacing="tight" aria-labelledby="list-title">
        <h2 id="list-title" className="sr-only">
          Industries we serve and plan to serve
        </h2>

        <ul className="flex flex-col gap-5">
          {INDUSTRIES.map((industry, index) => (
            <li key={industry.name}>
              <Reveal delay={Math.min(index, 3) * 70}>
                <article className="grid gap-6 rounded-panel p-8 glass glass-sheen md:grid-cols-12">
                  <div className="md:col-span-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={[
                          "inline-flex h-12 w-12 items-center justify-center rounded-control border",
                          "border-line/60 bg-surface-raised/60",
                          industry.status === "Available today"
                            ? "text-brand"
                            : "text-content-muted",
                        ].join(" ")}
                      >
                        <Icon name={industry.icon} size={24} />
                      </span>
                      <div>
                        <h3 className="text-h3 font-semibold text-content">{industry.name}</h3>
                        <p
                          className={[
                            "mt-0.5 text-caption font-semibold uppercase tracking-wide",
                            industry.status === "Available today"
                              ? "text-success"
                              : "text-content-muted",
                          ].join(" ")}
                        >
                          {industry.status}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 text-pretty text-body-sm text-content-secondary">
                      {industry.summary}
                    </p>
                  </div>

                  <div className="md:col-span-8">
                    <p className="text-pretty text-body text-content-secondary">
                      {industry.detail}
                    </p>
                    <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                      {industry.points.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2.5 text-body-sm text-content-secondary"
                        >
                          <Icon
                            name={industry.status === "Available today" ? "check" : "chevronRight"}
                            size={16}
                            className={
                              industry.status === "Available today"
                                ? "mt-0.5 shrink-0 text-success"
                                : "mt-0.5 shrink-0 text-content-muted"
                            }
                          />
                          <span className="text-pretty">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      <CTABand
        title="Working in one of these, and recognise the problem?"
        description="If the comprehension gap is costing you at claim time, in disputes, or in take-up, we would like to hear how it shows up for you."
        primary={{ label: "Talk to us", href: "/contact" }}
        secondary={{ label: "Request a demo", href: "/request-demo" }}
      />
    </>
  );
}
