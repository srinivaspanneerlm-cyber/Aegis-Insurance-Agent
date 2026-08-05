import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";
import { readAuthParams, type RawSearchParams } from "@/lib/searchParams";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { token } = await readAuthParams(searchParams);
  return <ResetPasswordForm token={token ?? ""} />;
}
