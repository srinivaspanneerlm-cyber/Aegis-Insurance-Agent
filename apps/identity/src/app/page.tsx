"use client";

import Link from "next/link";
import { cn } from "@aegis/utils";
import { AuthShell } from "@/components/AuthShell";
import { Icon, type IconName } from "@/components/Icon";
import { REALMS, REALM_PRESENTATION, type Realm } from "@/lib/identity";

const ICONS: Record<Realm, IconName> = {
  CUSTOMER: "users",
  EMPLOYEE: "briefcase",
  ENTERPRISE: "building",
  PLATFORM: "layers",
};

/**
 * Which door.
 *
 * The website's gateway normally sends people straight to `/login?portal=…`,
 * so most visitors never see this. It exists for the ones who arrive at the
 * identity platform directly, or who were told they knocked on the wrong door
 * — and for them a chooser is the difference between a way forward and a dead
 * end.
 *
 * The realms are described by what a person *is*, not by the permissions they
 * hold. "For branch and support staff" is a question somebody can answer about
 * themselves; "requires customer.read" is not.
 */
export default function PortalChooserPage() {
  return (
    <AuthShell
      width="wide"
      title="Which portal do you need?"
      description="Aegis runs as separate applications, because a customer and a member of staff need genuinely different sessions. Choose the one that describes you."
      icon="compass"
    >
      <ul className="flex flex-col gap-3">
        {REALMS.map((realm) => {
          const presentation = REALM_PRESENTATION[realm];
          return (
            <li key={realm}>
              <Link
                href={`/login?portal=${realm}`}
                className={cn(
                  "focus-ring flex items-start gap-4 rounded-card border border-line/50 bg-surface-raised/30 p-4",
                  "transition-colors duration-fast ease-enter hover:border-line hover:bg-surface-raised/50"
                )}
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
                  <Icon name={ICONS[realm]} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-content">
                    {presentation.label}
                  </span>
                  <span className="mt-0.5 block text-caption text-content-muted">
                    {presentation.audience}
                  </span>
                </span>
                <Icon
                  name="chevronRight"
                  size={18}
                  className="mt-2.5 shrink-0 text-content-muted"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </AuthShell>
  );
}
