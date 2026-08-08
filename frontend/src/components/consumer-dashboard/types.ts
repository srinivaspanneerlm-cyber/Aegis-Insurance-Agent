/** Shared types for the consumer dashboard and its viewport components. */

/** The selectable dashboard sections. */
export type NavId =
  | "dashboard"
  | "policies"
  | "advisor"
  | "claims"
  | "documents"
  | "notifications";

/** A message in the dashboard's Sarah AI chat thread. */
export interface DashboardMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
}

/** A policy row — either loaded from the API or the premium default. */
export interface DashboardPolicy {
  policyName: string;
  premium?: number | string;
  coverage?: string;
  status?: string;
  claimRatio?: string;
}

/** An uploaded document in the secure vault. */
export interface DashboardDoc {
  id: string;
  name: string;
  size: string;
  type: string;
  date: string;
  /**
   * Where the document has reached, from the Sprint 8 pipeline.
   *
   * A list of filenames tells a customer nothing about whether their claim is
   * blocked. The status, and the reason on a rejection, are the two things
   * they actually came to find out.
   */
  status?: string;
  rejectionReason?: string | null;
}

/** A security-bulletin notification. */
export interface DashboardNotification {
  id: number;
  title: string;
  message: string;
  time: string;
  type: string;
  read: boolean;
}
