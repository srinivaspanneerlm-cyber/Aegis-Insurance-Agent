import { Skeleton } from "@/components/ui";

/**
 * Dashboard-shaped loading skeleton shown while the consumer dashboard segment
 * streams in — a header band plus a stat row and content cards, so the shell is
 * recognisable before the data lands.
 */
export default function DashboardLoading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      aria-label="Loading your dashboard"
      className="min-h-screen bg-surface text-content px-6 pt-28 pb-16"
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full lg:col-span-2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </main>
  );
}
