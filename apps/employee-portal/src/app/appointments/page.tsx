"use client";

import { useState } from "react";
import { QueuePage } from "@/components/QueuePage";
import { RaiseTicket } from "@/components/RaiseTicket";

const KINDS = ["APPOINTMENT"];

const RAISABLE = [{ value: "APPOINTMENT", label: "Appointment" }] as const;

/**
 * Appointments.
 *
 * The nav has linked here since the portal was built and no page existed, so
 * the link 404'd — it carried a "Soon" badge while APPOINTMENT was a work kind
 * with routing, an SLA and a queue, listed inside Customer Support.
 *
 * Splitting it out rather than dropping the nav entry, because the two are
 * different work: a complaint is somebody unhappy, an appointment is a time
 * somebody is expecting you. Support now shows complaints only, so each entry
 * means one thing.
 */
export default function Page() {
  const [reloadToken, setReloadToken] = useState(0);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <RaiseTicket kinds={RAISABLE} onCreated={() => setReloadToken((n) => n + 1)} />

      <QueuePage
        title="Appointments"
        description="Times customers are expecting you."
        kinds={KINDS}
        emptyMessage="No appointments are assigned to you."
        reloadToken={reloadToken}
      />
    </div>
  );
}
