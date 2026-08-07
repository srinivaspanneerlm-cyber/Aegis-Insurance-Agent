/**
 * The shared knowledge and memory workspace.
 *
 * One set of components across the customer, employee, admin and platform
 * portals. What differs between them is what the API returns — a customer sees
 * only PUBLIC, approved guidance because the server says so, not because a
 * portal remembered to filter.
 *
 * Nothing here fetches on its own. Components render what they are handed; the
 * hooks own loading, error and caching, and the client owns the wire format.
 */
export * from "./lib/types";
export { KnowledgeClient, KnowledgeError, type ClientOptions } from "./lib/client";
export * from "./hooks";

export { KnowledgeCard, type KnowledgeCardProps } from "./components/KnowledgeCard";
export { KnowledgeList, type KnowledgeListProps } from "./components/KnowledgeList";
export { KnowledgeSearchBar, type KnowledgeSearchBarProps } from "./components/KnowledgeSearchBar";
export {
  KnowledgeFilters,
  type KnowledgeFiltersProps,
  type KnowledgeFilterValues,
} from "./components/KnowledgeFilters";
export { KnowledgeTimeline, type KnowledgeTimelineProps } from "./components/KnowledgeTimeline";
export { VersionHistory, type VersionHistoryProps } from "./components/VersionHistory";
export { MemoryCard, type MemoryCardProps } from "./components/MemoryCard";
export { MemoryTimeline, type MemoryTimelineProps } from "./components/MemoryTimeline";
export { BookmarkButton, type BookmarkButtonProps } from "./components/BookmarkButton";
export { SearchPanel, type SearchPanelProps } from "./components/SearchPanel";
export { KnowledgePreview, type KnowledgePreviewProps } from "./components/KnowledgePreview";
