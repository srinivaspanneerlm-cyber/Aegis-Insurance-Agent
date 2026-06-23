"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/consumer-dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-650 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
