import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui";

/**
 * 404 surface. Rendered inside RootLayout (so it keeps the theme + providers)
 * but without the per-page Navbar/Footer, so it stands alone and centred.
 */
export default function NotFound() {
  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-surface text-content px-6">
      <EmptyState
        icon={<Compass className="w-6 h-6" />}
        title="We couldn't find that page"
        description="The link may be broken, or the page may have moved. Let's get you back on track."
        action={
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-navy-900 hover:bg-navy-950 text-white border border-navy-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-white py-3.5 px-7 text-xs font-bold uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Back to home
          </Link>
        }
      />
    </main>
  );
}
