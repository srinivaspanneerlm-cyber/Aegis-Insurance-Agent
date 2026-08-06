"use client";

import { QueuePage } from "@/components/QueuePage";

const KINDS = ["KYC"];

export default function Page() {
  return (
    <QueuePage
      title="KYC Verification"
      description="Identity checks waiting on you."
      kinds={KINDS}
      emptyMessage="No KYC checks are assigned to you."
    />
  );
}
