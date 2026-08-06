"use client";

import { QueuePage } from "@/components/QueuePage";

const KINDS = ["COMPLAINT", "APPOINTMENT"];

export default function Page() {
  return (
    <QueuePage
      title="Customer Support"
      description="Complaints and appointments you are handling."
      kinds={KINDS}
      emptyMessage="No support cases are assigned to you."
    />
  );
}
