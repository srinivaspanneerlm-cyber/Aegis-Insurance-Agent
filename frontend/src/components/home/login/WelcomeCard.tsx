"use client";

import { MessagesSquare, ShieldCheck, FileText, LifeBuoy } from "lucide-react";

/**
 * Left column of the sign-in modal.
 *
 * This used to be a login-type chooser — customer on one row, admin on the
 * other. The customer portal has one kind of account, so a chooser with a
 * single option is just a button that does nothing, and removing the admin row
 * left the card two-thirds empty beside a full-height form.
 *
 * It now says what signing in actually gets you. Same purpose (orient the
 * customer before they type), same design language, and it fills its half of
 * the grid so the two cards balance.
 */

const WHAT_YOU_GET = [
  {
    icon: MessagesSquare,
    title: "Specialist AI advisors",
    detail: "Health, motor, travel and home — in plain language",
  },
  {
    icon: ShieldCheck,
    title: "Your policies in one place",
    detail: "Cover, premiums and renewal dates at a glance",
  },
  {
    icon: FileText,
    title: "Secure document vault",
    detail: "Upload from your phone; a clear photo is enough",
  },
  {
    icon: LifeBuoy,
    title: "Claims you can follow",
    detail: "Track progress without chasing anyone",
  },
];

export function WelcomeCard() {
  return (
    <div className="lg:col-span-5 flex flex-col">
      <div className="p-8 rounded-[32px] border flex-grow flex flex-col justify-between relative overflow-hidden text-left bg-white border-slate-200 shadow-lg dark:bg-slate-900/60 dark:border-white/5 dark:shadow-2xl">
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-black flex items-center gap-2 text-content">
              <span>Welcome to Aegis AI</span>
              <span>👋</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Sign in to your account
            </p>
          </div>

          <ul className="space-y-3 pt-2">
            {WHAT_YOU_GET.map(({ icon: Icon, title, detail }) => (
              <li
                key={title}
                className="p-3.5 rounded-2xl border flex items-start gap-3 transition-colors bg-purple-50 border-purple-100 text-purple-900 dark:bg-purple-950/20 dark:border-purple-500/20 dark:text-purple-200"
              >
                <span className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black">{title}</span>
                  <span className="block text-[10px] font-semibold opacity-70 leading-relaxed">
                    {detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-8 border-t border-slate-200 dark:border-white/5 flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          <span className="text-emerald-500">🔒</span>
          <span>Secure &amp; Encrypted Connection</span>
        </div>
      </div>
    </div>
  );
}
