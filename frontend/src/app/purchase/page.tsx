"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PurchaseRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/purchase/verify"); }, [router]);
  return null;
}
