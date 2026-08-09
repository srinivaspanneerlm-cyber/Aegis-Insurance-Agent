"use client";

import { QueuePage } from "@/components/QueuePage";

const KINDS = null;

/**
 * Everything assigned to you.
 *
 * The only screen showing every kind at once, and the one where the queue is
 * long enough that "sorted by due date" stops being enough — so this is where
 * the filters are switched on.
 *
 * The order is the server's: due date ascending. That is not the same as "most
 * urgent first", which is what this screen used to claim — SQLite sorts nulls
 * first, so an item with no due date at all sits above an overdue URGENT claim.
 * The wording now says what the order is, and "Overdue only" is the control
 * that answers the question the old wording implied.
 *
 * No "add a task" button, deliberately. TASK work routes to the operations
 * department by workload like every other kind, so raising one here would hand
 * your own to-do to whoever in operations is least busy. A personal task needs
 * a self-assignment path that does not exist, and a button that quietly gives
 * your work to a colleague is worse than no button.
 */
export default function Page() {
  return (
    <QueuePage
      title="My Tasks"
      description="Everything assigned to you, soonest due first."
      kinds={KINDS}
      emptyMessage="Nothing is assigned to you right now."
      filterable
    />
  );
}
