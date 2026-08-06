"use client";

import { QueuePage } from "@/components/QueuePage";

const KINDS = null;

export default function Page() {
  return (
    <QueuePage
      title="My Tasks"
      description="Everything assigned to you, most urgent first."
      kinds={KINDS}
      emptyMessage="Nothing is assigned to you right now."
    />
  );
}
