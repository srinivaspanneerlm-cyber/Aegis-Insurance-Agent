import Link from "next/link";
import { CONTACT, FOOTER_SECTIONS, SITE, SOCIALS } from "@/lib/site";
import { Wordmark } from "@/components/layout/Wordmark";
import { Icon } from "@/components/ui/Icon";

/**
 * The site footer.
 *
 * A server component with no state, so it costs nothing on the client. The
 * shared `Footer` in `@aegis/ui` is a single row built for an application
 * chrome; a company site needs the full directory, which is what most visitors
 * actually navigate by once they have scrolled past a page.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-line/50 bg-surface-sunken/50">
      <div className="mx-auto w-full max-w-7xl px-gutter py-14 sm:py-20">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="flex flex-col gap-4 md:col-span-4">
            <Wordmark />
            <p className="max-w-xs text-pretty text-body-sm text-content-secondary">
              {SITE.description}
            </p>

            <ul className="mt-2 flex flex-col gap-2">
              <li>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="focus-ring inline-flex items-center gap-2 rounded text-body-sm text-content-secondary hover:text-content"
                >
                  <Icon name="mail" size={16} />
                  {CONTACT.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}
                  className="focus-ring inline-flex items-center gap-2 rounded text-body-sm text-content-secondary hover:text-content"
                >
                  <Icon name="phone" size={16} />
                  {CONTACT.phone}
                </a>
              </li>
            </ul>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.title} aria-label={section.title} className="md:col-span-2">
              <h2 className="mb-4 text-caption font-semibold uppercase tracking-wide text-content">
                {section.title}
              </h2>
              <ul className="flex flex-col gap-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="focus-ring inline-flex items-center gap-2 rounded text-body-sm text-content-secondary hover:text-content"
                    >
                      {link.label}
                      {link.comingSoon ? (
                        <span className="rounded-pill border border-line/70 px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-content-muted">
                          Soon
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="md:col-span-2">
            <h2 className="mb-4 text-caption font-semibold uppercase tracking-wide text-content">
              Follow
            </h2>
            <ul className="flex flex-col gap-2.5">
              {SOCIALS.map((social) => (
                <li key={social.href}>
                  <a
                    href={social.href}
                    // External and untrusted: `noopener` closes the window.opener
                    // hole, `noreferrer` stops leaking where the visitor came from.
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring rounded text-body-sm text-content-secondary hover:text-content"
                  >
                    {social.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line/40 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caption text-content-muted">
            © {year} {SITE.legalName}. All rights reserved.
          </p>
          <p className="max-w-2xl text-pretty text-caption text-content-muted">
            Aegis AI provides guidance and comparison tools to help you understand insurance
            products. It is not a substitute for the policy wording, which is what governs your
            cover. Always read the policy document before you buy.
          </p>
        </div>
      </div>
    </footer>
  );
}
