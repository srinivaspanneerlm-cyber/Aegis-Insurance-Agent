/**
 * Shared domain models for loosely-typed API/mock data.
 *
 * These replace scattered `any[]` / `any` state in the admin and consumer
 * dashboards. Fields are optional where the UI already guards with `||` / `?.`
 * fallbacks, so typing them changes no runtime behaviour — it only makes the
 * shapes explicit and catches mistakes at compile time.
 */

/** A sales/underwriting lead shown in the admin dashboard. */
export interface Lead {
  id: string;
  customerName?: string;
  email?: string;
  phone?: string;
  insuranceType?: string;
  budget?: string;
  status?: string;
}

/** The advisor half of a chat exchange. */
export interface AdvisorMessage {
  message?: string;
  text?: string;
}

/** A stored chat exchange (admin monitor + consumer history). */
export interface ChatLog {
  id?: string | number;
  createdAt?: string | number;
  message?: string;
  text?: string;
  advisorMessage?: AdvisorMessage;
}

/** An uploaded document record. */
export interface DocumentRecord {
  id?: string;
  name?: string;
  filename?: string;
  size?: string;
  sizeBytes?: number;
  createdAt?: string | number;
}

/** Aggregate counters shown on the admin analytics/overview panels. */
export interface AdminStats {
  totalLeads: number;
  totalChats: number;
  uploadedDocuments: number;
  activeUsers?: number;
}
