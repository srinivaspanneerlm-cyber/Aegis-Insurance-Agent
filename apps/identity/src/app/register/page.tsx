import type { Metadata } from "next";
import { RegisterForm } from "@/components/forms/RegisterForm";
import { readAuthParams, type RawSearchParams } from "@/lib/searchParams";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { realm } = await readAuthParams(searchParams);
  return <RegisterForm realm={realm} />;
}
