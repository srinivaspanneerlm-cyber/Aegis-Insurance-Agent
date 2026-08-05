import type { Metadata } from "next";
import { LoginForm } from "@/components/forms/LoginForm";
import { readAuthParams, type RawSearchParams } from "@/lib/searchParams";

export const metadata: Metadata = { title: "Sign in" };

/**
 * A server component, so the sign-in form is in the HTML rather than assembled
 * after hydration. The realm and return path are resolved here and handed down
 * as plain values.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { realm, next } = await readAuthParams(searchParams);
  return <LoginForm realm={realm} next={next} />;
}
