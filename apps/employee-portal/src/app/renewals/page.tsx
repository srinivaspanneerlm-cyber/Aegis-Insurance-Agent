"use client";

import { QueuePage } from "@/components/QueuePage";

const KINDS = ["RENEWAL"];

export default function Page() {
  return (
    <QueuePage
      title="Renewals"
      description="Policies approaching expiry that need a decision."
      kinds={KINDS}
      emptyMessage="No renewals are assigned to you."
    />
  );
}
