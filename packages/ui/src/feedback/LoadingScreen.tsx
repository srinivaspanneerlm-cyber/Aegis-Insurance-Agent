import { Spinner } from "../components/Spinner";
import { cn } from "@aegis/utils";

export interface LoadingScreenProps {
  /** Say what is loading. "Loading…" alone tells the reader nothing. */
  message?: string;
  /** Fills the viewport rather than its container. */
  fullscreen?: boolean;
  className?: string;
}

/**
 * A whole-route wait.
 *
 * Reached for far less often than it looks — `Skeleton` is the better answer
 * whenever the layout is known. This is for the genuine unknowns: the first
 * session check, a route whose shape depends on what comes back.
 */
export function LoadingScreen({
  message = "Loading",
  fullscreen = false,
  className,
}: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        fullscreen ? "min-h-screen" : "min-h-[320px]",
        className
      )}
    >
      <Spinner size="lg" label={null} className="text-brand" />
      <p className="text-body-sm text-content-muted">{message}</p>
    </div>
  );
}
