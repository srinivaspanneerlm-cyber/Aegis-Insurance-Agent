import { realmFromParam, safeNextPath, type Realm } from "./identity";

/**
 * In Next 15 a page's `searchParams` is a Promise, so every screen here awaits
 * it and hands plain values to its client half.
 *
 * Reading them on the server rather than through `useSearchParams` is what
 * keeps these pages rendering real HTML. A client component calling
 * `useSearchParams` opts its whole subtree out of prerendering — which had this
 * app serving an empty document with a sign-in form that only existed once
 * JavaScript ran.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

export async function readAuthParams(
  searchParams: Promise<RawSearchParams>
): Promise<{ realm: Realm; next: string | null; token: string | null; reason: string | null }> {
  const params = await searchParams;
  return {
    realm: realmFromParam(params.portal),
    // Passed through the open-redirect guard here, once, so no screen has to
    // remember to do it.
    next: safeNextPath(first(params.next)),
    token: first(params.token),
    reason: first(params.reason),
  };
}
