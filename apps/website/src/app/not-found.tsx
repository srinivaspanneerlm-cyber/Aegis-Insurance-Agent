import Link from "next/link";
import { buttonVariants } from "@aegis/ui";
import { PRIMARY_NAV } from "@/lib/site";
import { Section } from "@/components/sections/Section";
import { Icon } from "@/components/ui/Icon";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * A 404 that helps rather than apologises.
 *
 * Someone arriving here has a goal and a broken link between them and it, so
 * the useful response is the list of places they might have meant. A dead end
 * with a status code is where people leave.
 *
 * The actions are real `<a>` elements wearing the button's styling — not
 * `<button>` wrapping a link. Navigation must stay navigation: middle-click,
 * "open in new tab" and a screen reader announcing "link" all depend on it.
 */
export default function NotFound() {
  return (
    <Section spacing="loose" width="narrow">
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-content-muted">
          <Icon name="compass" size={26} />
        </span>
        <p className="mt-6 text-overline font-semibold uppercase text-content-muted">Error 404</p>
        <h1 className="mt-3 text-balance text-display font-bold tracking-tight text-content">
          We could not find that page
        </h1>
        <p className="mt-4 max-w-lg text-pretty text-body text-content-secondary">
          The link may be out of date, or the address may have a typo in it. Nothing is wrong with
          your account. Here is everything else on the site.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className={buttonVariants({ variant: "primary", size: "lg" })}>
            Back to home
          </Link>
          <Link href="/contact" className={buttonVariants({ variant: "secondary", size: "lg" })}>
            Tell us what broke
          </Link>
        </div>
      </div>

      <nav aria-label="All pages" className="mt-14">
        <ul className="grid gap-3 sm:grid-cols-2">
          {PRIMARY_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="focus-ring flex flex-col gap-1 rounded-card p-4 transition-colors duration-fast glass hover:border-line"
              >
                <span className="text-body font-medium text-content">{item.label}</span>
                {item.description ? (
                  <span className="text-caption text-content-muted">{item.description}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Section>
  );
}
