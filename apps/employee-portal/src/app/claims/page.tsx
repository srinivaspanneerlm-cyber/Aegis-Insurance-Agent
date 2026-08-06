"use client";

import { QueuePage } from "@/components/QueuePage";

const KINDS = ["CLAIM"];

export default function Page() {
  return (
    <QueuePage
      title="Claims Management"
      description="Claims in your queue, and where each one has reached."
      kinds={KINDS}
      emptyMessage="No claims are assigned to you."
    />
  );
}
