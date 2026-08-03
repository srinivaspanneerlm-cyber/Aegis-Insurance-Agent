/**
 * Shared domain models for loosely-typed API/mock data.
 *
 * These replace scattered `any[]` / `any` state in the consumer
 * dashboards. Fields are optional where the UI already guards with `||` / `?.`
 * fallbacks, so typing them changes no runtime behaviour — it only makes the
 * shapes explicit and catches mistakes at compile time.
 */

/** Offset-pagination envelope returned alongside a bounded list endpoint. */
export interface PageInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** A policy record as returned by the backend policy service. */
export interface PolicyRecord {
  id: string;
  policyName: string;
  coverage: string;
  premium: number;
}

/** A sales/underwriting lead captured from the customer apply flow. */
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

/** A stored chat exchange, shown in the customer's conversation history. */
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

