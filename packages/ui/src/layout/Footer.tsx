import type { ReactNode } from "react";
import { cn } from "@aegis/utils";

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterProps {
  /** Regulatory and legal text. Insurance products must carry it. */
  legal?: ReactNode;
  links?: readonly FooterLink[];
  className?: string;
}

export function Footer({ legal, links = [], className }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn("mt-section border-line bg-surface-sunken border-t", className)}>
      <div className="px-gutter mx-auto flex w-full max-w-7xl flex-col gap-4 py-8">
        {links.length > 0 ? (
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="focus-ring text-body-sm text-content-secondary hover:text-content rounded"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {/* Regulatory text is small but never below 13px — a disclosure nobody
            can read is not a disclosure. */}
        {legal ? (
          <div className="text-caption text-content-muted leading-relaxed">{legal}</div>
        ) : null}

        <p className="text-caption text-content-muted">© {year} Aegis AI</p>
      </div>
    </footer>
  );
}
