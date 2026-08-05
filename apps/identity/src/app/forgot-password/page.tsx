import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm";
import { readAuthParams, type RawSearchParams } from "@/lib/searchParams";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { realm } = await readAuthParams(searchParams);
  return <ForgotPasswordForm realm={realm} />;
}
