"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyAdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin-dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-955 flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
