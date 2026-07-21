import { Skeleton } from "@/components/ui";

/**
 * Route-transition fallback shown while a segment streams in. A calm content
 * skeleton (not a spinner) so the layout settles instead of flashing.
 */
export default function Loading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      aria-label="Loading"
      className="min-h-screen bg-surface text-content px-6 pt-28 pb-16"
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-3/4" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    </main>
  );
}
