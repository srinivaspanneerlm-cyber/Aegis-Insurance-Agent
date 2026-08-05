import type { Metadata } from "next";
import { VerifyEmailFlow } from "@/components/forms/VerifyEmailFlow";
import { readAuthParams, type RawSearchParams } from "@/lib/searchParams";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { token } = await readAuthParams(searchParams);
  return <VerifyEmailFlow token={token} />;
}
