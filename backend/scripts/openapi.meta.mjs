/**
 * What each route is for, and who may call it.
 *
 * The only hand-written half of the specification. The inventory comes from the
 * router itself (see `openapi.mjs`), so nothing here can invent an endpoint —
 * an entry whose key matches no route is dead weight the drift test rejects,
 * and a route with no entry appears anyway, marked undocumented.
 *
 * `permission` and `realm` are transcribed from the guards on each route, not
 * inferred from what an endpoint seems like it ought to need. Where they
 * disagree, the route file is right and this is a bug.
 *
 * Covers §5.1–5.9 of API_REFERENCE.md. The six routers documented in neither
 * place — communication, documents, employee, intelligence, knowledge,
 * platform — are the next task; until then they are listed as undocumented
 * rather than described from a guess.
 */

export const TAGS = [
  { name: "Health", description: "Liveness and readiness probes. Unauthenticated by necessity." },
  { name: "Auth", description: "Registration, sign-in, sessions, verification and recovery." },
  { name: "Leads", description: "The sales pipeline." },
  { name: "Policies", description: "The public product catalogue." },
  { name: "Chat", description: "The customer-facing AI conversation, including the streaming path." },
  { name: "Upload", description: "Customer document upload." },
  { name: "Company", description: "Insurers — shared reference data across tenants." },
  { name: "Admin", description: "Aggregate figures for administrators." },
  { name: "UI Action", description: "Structured actions the AI asks the interface to take." },
  { name: "Enterprise Console", description: "Tenant administration. Read-heavy by design: it watches and reports, and decides nothing a person is answerable for." },
  { name: "Undocumented", description: "Served, but not yet described. A gap, shown rather than hidden." },
];

const paginated = [
  { name: "page", type: "integer", description: "1-based page number." },
  { name: "limit", type: "integer", description: "Rows per page; capped at 100." },
];

/** The row cap the console pages with, in place of page/limit. */
const take = [
  { name: "take", type: "integer", description: "Rows to return; clamped server-side to 100." },
];

export const ROUTE_META = {
  // ── Health ─────────────────────────────────────────────────────────────────
  "GET /health": { tag: "Health", auth: false, summary: "Legacy minimal probe." },
  "GET /health/live": { tag: "Health", auth: false, summary: "The process is up." },
  "GET /health/ready": {
    tag: "Health",
    auth: false,
    summary: "Ready to serve traffic.",
    description: "Gated on database connectivity, so a booted process with no database reports unready rather than accepting requests it cannot answer.",
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  "POST /api/v1/auth/register": {
    tag: "Auth",
    auth: false,
    summary: "Create an account.",
    description: "Always creates a `customer`. Realm and role are never taken from the request — a client that could name its own role could name itself an administrator.",
  },
  "POST /api/v1/auth/login": { tag: "Auth", auth: false, summary: "Sign in; sets an httpOnly JWT cookie." },
  "POST /api/v1/auth/logout": { tag: "Auth", auth: false, summary: "Clear the session cookie.", description: "Deliberately unauthenticated: signing out must work even from a session the server no longer accepts." },
  "POST /api/v1/auth/logout-all": { tag: "Auth", summary: "Revoke every session for this account." },
  "POST /api/v1/auth/refresh": { tag: "Auth", auth: false, summary: "Exchange a refresh token for a new session.", description: "Unauthenticated by design — the expired access token is precisely what is being replaced. Replay of a used token is detected and revokes the family." },
  "GET /api/v1/auth/me": { tag: "Auth", summary: "The signed-in account, its realm and its permissions." },
  "PATCH /api/v1/auth/me/onboarding": { tag: "Auth", summary: "Record onboarding answers." },
  "PATCH /api/v1/auth/password": { tag: "Auth", summary: "Change the password of the signed-in account." },
  "GET /api/v1/auth/sessions": { tag: "Auth", summary: "Sessions currently held by this account." },
  "GET /api/v1/auth/login-history": { tag: "Auth", summary: "Recent sign-in attempts against this account." },
  "GET /api/v1/auth/portals": { tag: "Auth", summary: "Which portals this account may enter." },
  "POST /api/v1/auth/portals/{portal}/enter": { tag: "Auth", summary: "Enter a portal, subject to the account's realm." },
  "GET /api/v1/auth/providers": { tag: "Auth", auth: false, summary: "Identity providers this deployment has configured." },
  "POST /api/v1/auth/google": { tag: "Auth", auth: false, summary: "Sign in with Google.", description: "Predates the provider registry; `/oauth/{provider}` is the general form." },
  "POST /api/v1/auth/oauth/{provider}": { tag: "Auth", auth: false, summary: "Sign in with a configured identity provider." },
  "POST /api/v1/auth/step-up": {
    tag: "Auth",
    summary: "Re-authenticate to reach a guarded action.",
    description: "Freshness, not identity. Routes carrying `requireFreshAuth` need a recent proof of password — a stolen cookie should not be enough to delete a lead.",
  },
  "POST /api/v1/auth/verify-email/request": { tag: "Auth", auth: false, summary: "Send a verification mail." },
  "POST /api/v1/auth/verify-email": { tag: "Auth", auth: false, summary: "Verify an address with a token." },
  "POST /api/v1/auth/forgot-password": { tag: "Auth", auth: false, summary: "Begin password recovery." },
  "POST /api/v1/auth/reset-password": { tag: "Auth", auth: false, summary: "Complete password recovery with a token." },

  // ── Leads ──────────────────────────────────────────────────────────────────
  "POST /api/v1/leads": { tag: "Leads", summary: "Raise a lead.", description: "Any signed-in account may raise one; reading the pipeline is a capability." },
  "GET /api/v1/leads": { tag: "Leads", summary: "The pipeline, paginated.", permission: "lead.read", query: paginated },
  "GET /api/v1/leads/{id}": { tag: "Leads", summary: "One lead.", permission: "lead.read" },
  "PUT /api/v1/leads/{id}": { tag: "Leads", summary: "Update a lead.", permission: "lead.write", description: "Requires fresh authentication." },
  "DELETE /api/v1/leads/{id}": { tag: "Leads", summary: "Delete a lead.", permission: "lead.delete", description: "Requires fresh authentication." },

  // ── Policies ───────────────────────────────────────────────────────────────
  "GET /api/v1/policies": { tag: "Policies", auth: false, summary: "The product catalogue, paginated.", query: paginated, description: "Public: somebody comparing cover should not have to hold an account to do it." },
  "GET /api/v1/policies/{id}": { tag: "Policies", auth: false, summary: "One product." },
  "POST /api/v1/policies": { tag: "Policies", summary: "Add a product.", permission: "policy.write", description: "Requires fresh authentication." },

  // ── Chat ───────────────────────────────────────────────────────────────────
  "POST /api/v1/chat": { tag: "Chat", summary: "Send a message to the advisor.", description: "Rate-limited on the paid-LLM path." },
  "POST /api/v1/chat/stream": { tag: "Chat", summary: "Send a message and stream the reply (SSE).", description: "The voice path. Protected workflow — changes need sign-off." },
  "GET /api/v1/chat": { tag: "Chat", summary: "This account's conversation history." },

  // ── Upload ─────────────────────────────────────────────────────────────────
  "POST /api/v1/upload": { tag: "Upload", summary: "Upload documents.", description: "Bounded in count and size; files are scanned before they are stored." },
  "GET /api/v1/upload": { tag: "Upload", summary: "Documents this account may see.", query: paginated },

  // ── Company ────────────────────────────────────────────────────────────────
  "GET /api/v1/company": { tag: "Company", summary: "Insurers, paginated.", query: paginated },
  "POST /api/v1/company": { tag: "Company", summary: "Add an insurer.", permission: "company.write", description: "Requires fresh authentication." },

  // ── Admin ──────────────────────────────────────────────────────────────────
  "GET /api/v1/admin/stats": { tag: "Admin", summary: "Aggregate platform figures.", permission: "analytics.read" },

  // ── UI Action ──────────────────────────────────────────────────────────────
  "POST /api/v1/ui-action": { tag: "UI Action", summary: "Dispatch a structured action the AI requested.", description: "Rate-limited alongside the other AI paths." },

  // ── Enterprise console ─────────────────────────────────────────────────────
  // Realm-walled as a whole, then gated per route on the capability the section
  // needs. Both: the realm asks whether somebody belongs on this side of the
  // platform, the permission asks what they may do once here.
  "GET /api/v1/enterprise/dashboard": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "analytics.read", summary: "Every panel the dashboard needs, in one call.", description: "Cached per tenant for 30 seconds." },
  "GET /api/v1/enterprise/analytics": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "analytics.read", summary: "Overview, trend and branch comparison.", description: "Cached per tenant for 30 seconds." },
  "GET /api/v1/enterprise/organization": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "analytics.read", summary: "The tenant's own record.", description: "Read-only: plan, seats and status belong to the platform operator, not the tenant subject to them." },
  "GET /api/v1/enterprise/customers": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "customer.read", summary: "Customer records, searchable.", description: "Carries no conversation content, by construction.", query: [...take, { name: "search", description: "Matches name or email." }] },
  "GET /api/v1/enterprise/customers/{id}": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "customer.read", summary: "One customer's operational record." },
  "GET /api/v1/enterprise/employees": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "staff.manage", summary: "The workforce and its capacity.", query: [...take, { name: "department", description: "Filter to one department." }] },
  "GET /api/v1/enterprise/products": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "policy.read", summary: "The catalogue this tenant offers.", description: "Insurers are shared platform-wide; each insurer's product count is the caller's own.", query: take },
  "GET /api/v1/enterprise/policies": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "policy.read", summary: "The book customers actually hold.", description: "Cover held elsewhere is counted separately from cover this tenant sold.", query: [...take, { name: "status", description: "Filter by policy status." }] },
  "GET /api/v1/enterprise/claims": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "claim.read", summary: "Claims, as an operations view." },
  "GET /api/v1/enterprise/renewals": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "policy.read", summary: "Renewals raised, and renewals nobody has noticed yet." },
  "GET /api/v1/enterprise/documents": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "customer.read", summary: "Documents and identity checks." },
  "GET /api/v1/enterprise/intelligence": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "customer.read", summary: "Customer intelligence and cohorts." },
  "GET /api/v1/enterprise/support": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "work.read", summary: "Complaints and appointments, counted apart." },
  "GET /api/v1/enterprise/notifications": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "analytics.read", summary: "What the platform has been sending this tenant's people." },
  "GET /api/v1/enterprise/roles": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "staff.manage", summary: "Who holds what.", description: "Reports the shape of access; granting a role is not done from here." },
  "GET /api/v1/enterprise/ai-systems": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "platform.configure", summary: "AI estate monitoring.", description: "No ENTERPRISE role holds `platform.configure`, so this is unreachable for tenant administrators by design. Observability only — nothing here changes a model, a prompt or a routing rule." },
  "GET /api/v1/enterprise/workflows": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "analytics.read", summary: "The workflow catalogue and what is in flight." },
  "GET /api/v1/enterprise/compliance": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "audit.read", summary: "Compliance verdict and the findings behind it.", description: "The platform's own checks against its own records — not a statement of IRDAI compliance. Cached per tenant for 30 seconds." },
  "GET /api/v1/enterprise/audit": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "audit.read", summary: "The audit trail, filterable.", description: "Never cached — it is read during an incident.", query: [...take, { name: "action", description: "Substring match on the action name." }, { name: "actorId", description: "UUID of one actor." }] },
  "GET /api/v1/enterprise/security-events": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "audit.read", summary: "Sign-in security for this tenant.", description: "Undercounts by the attempts it cannot attribute; the payload says so. Never cached.", query: take },
  "GET /api/v1/enterprise/reports/{kind}": { tag: "Enterprise Console", realm: "ENTERPRISE", permission: "analytics.read", summary: "A report, as rows or CSV.", description: "`kind` is one of operations, compliance, branches. Every generation is written to the audit trail.", query: [{ name: "format", description: "`csv` for a download." }] },
};
