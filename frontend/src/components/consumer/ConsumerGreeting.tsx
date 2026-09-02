"use client";

import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand";

/**
 * The chat-style opening.
 *
 * Written as a spoken greeting rather than a dashboard header because the
 * product is meant to feel like asking someone knowledgeable for help, not like
 * operating a console. It is deliberately not a live chat thread: nothing here
 * takes input yet, and a text box that goes nowhere would be a worse lie than
 * an honest greeting.
 *
 * "Vanakkam" is used unqualified. The audience is Tamil-first, and a greeting
 * that stops to explain itself is not a greeting.
 */
export function ConsumerGreeting({ name }: { name: string | null }) {
  // First name only. "Vanakkam, Sri" is how a person speaks; the full name as
  // recorded on an account is how a form addresses you.
  const firstName = (name ?? "").trim().split(/\s+/)[0] || null;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="consumer-greeting">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/10">
          {/* `title={null}` because the greeting beside it is the accessible
              name — a second one here would be read out twice. */}
          <BrandMark brand="aegis" size={24} title={null} glow={false} />
        </span>

        {/* A speech bubble, tail on the left, so the greeting reads as
            something Aegis said rather than a banner the page is wearing. */}
        <div className="relative rounded-4xl rounded-tl-lg border border-line bg-surface-raised px-5 py-4 shadow-elevation-1">
          <h1 id="consumer-greeting" className="text-lg font-bold leading-snug text-content">
            {firstName ? `Vanakkam, ${firstName}.` : "Vanakkam."}
          </h1>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-content-muted">
            I can help you understand your insurance, check when it runs out, and find someone to
            help you renew it. Nothing here costs anything.
          </p>
        </div>
      </div>

      <p className="flex items-start gap-2 pl-1 text-xs font-medium leading-relaxed text-content-subtle">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Your details stay yours. Only you can see what you add here.</span>
      </p>
    </section>
  );
}
