"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Database, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { intelligenceService } from "@/services/api";

export default function ConsumerProfilePage() {
  const { user, isReady } = useRequireAuth();
  const [completeness, setCompleteness] = useState(0);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Loaded after auth resolves, and never blocking the page: name and email are
  // already known, so a slow profile call must not hold back what is on hand.
  useEffect(() => {
    if (!isReady || !user) return;
    let cancelled = false;

    intelligenceService
      .getProfile()
      .then((data) => {
        if (!cancelled) setCompleteness(data.completeness);
      })
      .catch(() => {
        if (!cancelled) setProfileError("We could not load your insurance profile.");
      })
      .finally(() => {
        if (!cancelled) setIsProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isReady, user]);

  const router = useRouter();

  if (!isReady || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <Navbar />
        <main id="main-content">
        <div className="flex-grow flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-purple-650 border-t-transparent rounded-full animate-spin" />
        </div>
        </main>
        <Footer />
      </div>
    );
  }

  const wrapperClass = "bg-surface text-content";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />
      <main id="main-content">

      <section className="relative pt-36 pb-24 flex-grow flex items-center justify-center z-10">
        <div className="max-w-xl w-full mx-auto px-6">
          <button 
            onClick={() => router.push("/consumer-dashboard")}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-purple-400 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>

          <div className="p-8 sm:p-10 rounded-[32px] border bg-slate-900/60 border-white/5 backdrop-blur-xl shadow-2xl relative text-left">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500" />

            <div className="flex items-center gap-4 border-b border-white/5 pb-6 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-purple-950 text-purple-400 border border-purple-800/30 flex items-center justify-center">
                <User className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">{user.name}</h2>
                {/* Not "Verified Account": nothing on the client says whether
                    this account is verified, and asserting it is a security
                    claim the page cannot support. */}
                <p className="text-[9.5px] text-cyan-400 font-extrabold uppercase tracking-widest mt-1">
                  Signed in
                </p>
              </div>
            </div>

            <div className="space-y-6 text-slate-300">
              <div className="space-y-2">
                <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">
                  Email
                </label>
                <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex items-center gap-3">
                  <Mail className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">{user.email}</span>
                </div>
              </div>

              {/* How complete the insurance profile is, from the engine that
                  uses it. The three rows that used to sit here — an ECDSA key
                  hash, "DPDP verified", "Direct Client Layer Seeded" — were
                  invented, and the first two made security claims the platform
                  cannot support. */}
              <div className="space-y-2">
                <label
                  className="text-[9px] text-slate-500 font-black uppercase tracking-widest block"
                  id="profile-completeness-label"
                >
                  Insurance profile
                </label>
                <div
                  className="p-4 bg-white/[0.01] border border-white/5 rounded-xl"
                  aria-labelledby="profile-completeness-label"
                >
                  {profileError ? (
                    <p className="text-xs font-bold text-amber-400">{profileError}</p>
                  ) : isProfileLoading ? (
                    <p className="text-xs font-bold text-slate-400">Loading…</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <Database className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-white">
                          {completeness}% complete
                        </span>
                      </div>
                      <div
                        className="mt-3 h-1.5 w-full rounded-full bg-white/5 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={completeness}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Insurance profile completeness"
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-[width] duration-700 motion-reduce:transition-none"
                          style={{ width: `${completeness}%` }}
                        />
                      </div>
                      <p className="mt-3 text-[11px] font-bold text-slate-400">
                        {completeness >= 80
                          ? "Enough for us to advise you properly."
                          : "The more we know, the more specific our advice can be."}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/consumer/recommendations")}
                className="w-full rounded-xl border border-purple-800/40 bg-purple-950/30 px-4 py-3 text-xs font-black uppercase tracking-widest text-purple-300 transition-colors hover:bg-purple-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                See what this means for your cover
              </button>
            </div>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}
