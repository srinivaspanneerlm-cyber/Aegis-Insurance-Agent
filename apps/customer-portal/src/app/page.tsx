import { Card, CardDescription, CardHeader, CardTitle } from "@aegis/ui";

/**
 * Sprint 1 placeholder.
 *
 * Signed-in customers. Long forgiving sessions, an idle timeout for shared devices. Principal kind: customer.
 *
 * Deliberately carries no business logic — this sprint builds the foundation
 * only, and a half-built feature here would be the first thing to rot.
 */
export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-overline uppercase text-brand">Aegis Platform</p>
        <h1 className="text-h1 font-bold tracking-tight">Your account</h1>
        <p className="max-w-2xl text-body text-content-secondary">
          Policies, claims and documents in one place.
        </p>
      </header>

      <Card variant="glass" padding="lg">
        <CardHeader>
          <CardTitle>Foundation ready</CardTitle>
          <CardDescription>
            Design system, layout, theming, error boundaries and strict TypeScript are wired up.
            Features land here from Sprint 2 onwards.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
