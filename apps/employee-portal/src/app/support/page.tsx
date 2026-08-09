"use client";

import { useState } from "react";
import { QueuePage } from "@/components/QueuePage";
import { RaiseTicket } from "@/components/RaiseTicket";

const KINDS = ["COMPLAINT", "APPOINTMENT"];

/** What this screen may raise. A support desk does not open claims. */
const RAISABLE = [
  { value: "COMPLAINT", label: "Complaint" },
  { value: "APPOINTMENT", label: "Appointment" },
] as const;

/**
 * Customer support.
 *
 * The queue could only ever be read. Somebody taking a complaint on the phone
 * had nowhere to record it — `POST /employee/work` was live and no screen
 * called it — so the ticket either went into a colleague's notebook or was
 * never raised at all.
 */
export default function Page() {
  const [reloadToken, setReloadToken] = useState(0);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <RaiseTicket kinds={RAISABLE} onCreated={() => setReloadToken((n) => n + 1)} />

      <QueuePage
        title="Customer Support"
        description="Complaints and appointments you are handling."
        kinds={KINDS}
        emptyMessage="No support cases are assigned to you."
        reloadToken={reloadToken}
      />
    </div>
  );
}
