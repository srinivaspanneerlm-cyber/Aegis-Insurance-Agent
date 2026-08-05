"use client";

import { useEffect, useState } from "react";
import { Button } from "@aegis/ui";
import { AuthShell } from "@/components/AuthShell";
import { Icon } from "@/components/Icon";
import { ApiError, identityApi, type PortalsPayload } from "@/lib/api";
import { WEBSITE_URL } from "@/lib/identity";

/** ⚠️ Placeholder, like the rest of the contact details — replace before launch. */
const ADMIN_EMAIL = "support@aegis.ai";

/**
 * 403 — signed in, and this is not yours.
 *
 * The two actions the brief asks for are only useful if the first one is
 * *specific*: "Return to my portal" has to know which portal that is. So this
 * asks the server rather than guessing, and falls back to the gateway when the
 * answer does not arrive — a generic way onward beats a button that might send
 * somebody to another door they cannot open.
 *
 * It never says which permission was missing. That would map the access model
 * out for whoever is probing, and it tells a legitimate person nothing they can
 * act on — which is what the administrator link is for.
 */
export function AccessDenied({ portalName }: { portalName: string | null }) {
  const [home, setHome] = useState<PortalsPayload | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    identityApi
      .portals()
      .then(setHome)
      .catch((error) => {
        // A 401 here means the session went too. The gateway link still works —
        // it will bounce them to sign-in, which is the right destination.
        if (!(error instanceof ApiError)) return;
      })
      .finally(() => setChecked(true));
  }, []);

  const mine = home?.portals.find((portal) => portal.entitled) ?? null;

  const subject = encodeURIComponent("Access request — Aegis AI");
  const body = encodeURIComponent(
    [
      "Hello,",
      "",
      `I was refused access to${portalName ? ` the ${portalName}` : " a workspace"} and I believe I should have it.`,
      "",
      "My account:",
      "Reason I need access:",
      "",
      "Thank you.",
    ].join("\n")
  );

  return (
    <AuthShell
      icon="shield"
      title="You do not have access to this area"
      description={
        portalName
          ? `Your account is signed in, but it is not set up for the ${portalName}.`
          : "Your account is signed in, but it is not set up for that workspace."
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-pretty rounded-control border border-line/50 bg-surface-raised/40 px-4 py-3 text-body-sm text-content-secondary">
          Nothing is wrong with your account — this workspace simply belongs to a different kind of
          user. If you should have access, the person who administers Aegis for your organisation
          can arrange it.
        </p>

        <div className="flex flex-col gap-2">
          {/* Rendered as soon as we know, and as the gateway until then. The
              gateway is always a correct answer; a specific portal is a better
              one when we have it. */}
          <Button
            size="lg"
            fullWidth
            loading={!checked}
            onClick={() => window.location.assign(mine?.url ?? "/gateway")}
          >
            {mine ? `Return to the ${mine.name}` : "Return to my portal"}
          </Button>

          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`}
            className="focus-ring inline-flex h-control-lg w-full items-center justify-center gap-2 rounded-control border border-line bg-surface-raised font-semibold text-content transition-colors hover:border-line-strong"
          >
            <Icon name="mail" size={18} />
            Contact your administrator
          </a>

          <a
            href={WEBSITE_URL}
            className="focus-ring mt-1 rounded py-2 text-center text-body-sm text-content-secondary hover:text-content"
          >
            Back to the Aegis website
          </a>
        </div>
      </div>
    </AuthShell>
  );
}
