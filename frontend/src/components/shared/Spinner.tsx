/**
 * Circular loading spinner. The size and ring colour are supplied by the
 * caller via `className` (e.g. "w-10 h-10 border-cyan-400" or
 * "absolute inset-0 border-purple-550"); the spin recipe lives here once.
 */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-full border-4 border-t-transparent animate-spin ${className}`} />
  );
}
