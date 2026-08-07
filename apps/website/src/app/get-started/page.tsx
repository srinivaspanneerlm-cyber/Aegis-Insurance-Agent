import Link from "next/link";
import { buttonVariants } from "@aegis/ui";
import { pageMetadata } from "@/lib/seo";
import { IDENTITY_URL } from "@/lib/site";
import { Section, SectionHeading } from "@/components/sections/Section";
import { Icon } from "@/components/ui/Icon";

export const metadata = pageMetadata({
  title: "Get started",
  description: "Sign in to Aegis AI. One account, and the platform takes you to the right place.",
  path: "/get-started",
});

/**
 * The portal gateway.
 *
 * This page deliberately does not sign anyone in. It routes them to the
 * application that owns their kind of session, and each application runs its
 * own authentication.
 *
 * That is not a UX preference, it is the platform's identity model made
 * visible. A customer and a member of staff are different kinds of principal
 * with genuinely conflicting session policies — a customer wants a long,
 * forgiving session renewed silently, while staff need a short one behind a
 * second factor. One login form serving both would have to pick, and a string
 * comparison would end up being the only thing standing between public
 * self-registration and administrative access. Separate front doors mean the
 * staff API never even receives a customer's session.
 */

export default function GetStartedPage() {
  return (
    <>
      <Section spacing="loose" width="narrow" aria-labelledby="start-title">
        <SectionHeading
          id="start-title"
          as="h1"
          overline="Get started"
          title="One sign-in, whoever you are"
          description="Customers, advisors, insurers and operators all sign in at the same place. What you see afterwards follows from your account — there is nothing to choose and nothing to get wrong."
          align="center"
        />

        {/* One destination, not four.
            This page used to list every workspace as a card, which handed a
            visitor a decision that is not theirs to make: which workspace
            somebody may enter is decided by the server from their account, and
            publishing the list told anyone passing what the internal structure
            is. The identity platform now answers both — it knows who signed in,
            and it takes them where they belong. */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href={`${IDENTITY_URL}/login`}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            Sign in
          </a>
          <a
            href={`${IDENTITY_URL}/register`}
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Create an account
          </a>
        </div>

        <p className="mt-6 text-center text-body-sm text-content-secondary">
          Staff accounts are created by your organisation — signing in is all you need to do.
        </p>
      </Section>

      <Section width="narrow" spacing="tight" aria-labelledby="unsure-title">
        <div className="rounded-panel p-8 glass glass-sheen">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
            <Icon name="compass" size={22} />
          </span>
          <h2 id="unsure-title" className="mt-5 text-h3 font-semibold text-content">
            Not sure, or just looking?
          </h2>
          <p className="mt-3 text-pretty text-body text-content-secondary">
            You do not need an account to read about cover, compare products or work out what you
            need. Signing in is what makes your documents and your progress available next time — it
            is not a gate in front of the information.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/products" className={buttonVariants({ variant: "secondary", size: "md" })}>
              Browse products
            </Link>
            <Link href="/resources" className={buttonVariants({ variant: "ghost", size: "md" })}>
              Read the guides
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
