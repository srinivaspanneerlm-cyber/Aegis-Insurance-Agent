"use client";

import { QUICK_ACTIONS } from "@/lib/consumer/quickActions";
import { QuickActionCard } from "./QuickActionCard";

/**
 * The five quick actions.
 *
 * One column on a phone and two from the small breakpoint up. Mobile-first in
 * the literal sense: the single-column stack is the base rule and the wider
 * layouts are the exceptions, so the narrow case cannot be the one nobody
 * checked.
 *
 * A list, semantically, because that is what it is — five choices of equal
 * standing. A screen reader announces how many there are before reading them,
 * which on a screen that is the whole navigation is worth having.
 */
export function QuickActionGrid() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      {QUICK_ACTIONS.map((action) => (
        <li key={action.id} className="flex">
          <QuickActionCard action={action} />
        </li>
      ))}
    </ul>
  );
}
