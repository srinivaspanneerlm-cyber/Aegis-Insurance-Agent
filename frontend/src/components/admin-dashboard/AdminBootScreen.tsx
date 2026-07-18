import { Shield } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Spinner } from "@/components/shared/Spinner";
import Footer from "@/components/Footer";

/** Full-page loading state shown while auth resolves and data syncs. */
export function AdminBootScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      <Navbar />
      <div className="flex-grow flex items-center justify-center flex-col gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-900" />
          <Spinner className="absolute inset-0 border-cyan-400" />
          <Shield className="absolute inset-0 m-auto w-6 h-6 text-cyan-400 animate-pulse" />
        </div>
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest animate-pulse">Initializing Cyber telemetry nodes...</h3>
      </div>
      <Footer />
    </div>
  );
}
