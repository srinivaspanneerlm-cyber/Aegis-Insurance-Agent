/**
 * The shared communication module.
 *
 * One notification centre, one inbox, one thread view and one timeline, used by
 * every portal. A customer and an advisor looking at the same conversation see
 * the same messages rendered the same way — except for the internal notes,
 * which the server never sends to the customer at all.
 *
 * Nothing here fetches. Each component renders what it is handed.
 */
export * from "./lib/types";

export { NotificationCenter, type NotificationCenterProps } from "./components/NotificationCenter";
export { ActivityTimeline, type ActivityTimelineProps } from "./components/ActivityTimeline";
export { InboxList, type InboxListProps } from "./components/InboxList";
export { MessageThread, type MessageThreadProps } from "./components/MessageThread";
