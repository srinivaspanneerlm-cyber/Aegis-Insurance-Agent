import Link from "next/link";
import { buttonVariants } from "@aegis/ui";

/**
 * 404.
 *
 * Says what happened in plain words and offers a way onward. A dead end with a
 * status code is where people leave.
 *
 * The action is a real `<a>` wearing the button's styling — not a `<button>`
 * wrapping a link. Navigation must stay navigation: middle-click, "open in new
 * tab" and a screen reader announcing "link" all depend on it.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-overline uppercase text-content-muted">404</p>
      <h1 className="text-h2 font-bold">We couldn&apos;t find that page</h1>
      <p className="max-w-md text-body text-content-secondary">
        The link may be old, or the page may have moved. Nothing is wrong with your account.
      </p>
      <Link href="/" className={buttonVariants({ variant: "primary", size: "md" })}>
        Go to the homepage
      </Link>
    </div>
  );
}
