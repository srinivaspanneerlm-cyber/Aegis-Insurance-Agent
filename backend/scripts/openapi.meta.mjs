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
 * Covers §5.1–5.15 of API_REFERENCE.md — the whole served surface.
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
  { name: "Employee Workspace", description: "The queue an employee works, realm-walled as a whole. A customer's session reaches none of it." },
  { name: "Documents", description: "The document platform. Scoped by caller rather than realm-walled — a customer legitimately manages their own documents." },
  { name: "Intelligence", description: "A customer's insurance profile, the advice derived from it, and aggregate views for staff." },
  { name: "Communication", description: "Notifications, conversations, timelines and announcements." },
  { name: "Knowledge", description: "Approved guidance and institutional memory. Provenance is the point: advice traced to nothing is advice the business cannot defend." },
  { name: "Platform", description: "Platform operation — tenants, licences, settings and sessions. The narrowest door on the API." },
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
  // ── Employee workspace ─────────────────────────────────────────────────────
  // `requireRealm("EMPLOYEE")` is the wall; the per-route capability is the
  // second question. A customer's session reaches none of this.
  "GET /api/v1/employee/me": { tag: "Employee Workspace", realm: "EMPLOYEE", summary: "The signed-in employee and how their queue is doing." },
  "GET /api/v1/employee/work": { tag: "Employee Workspace", realm: "EMPLOYEE", permission: "work.read", summary: "The queue assigned to this employee." },
  "POST /api/v1/employee/work": { tag: "Employee Workspace", realm: "EMPLOYEE", permission: "work.write", summary: "Raise a work item." },
  "GET /api/v1/employee/work/{id}": { tag: "Employee Workspace", realm: "EMPLOYEE", permission: "work.read", summary: "One work item, with its workflow run." },
  "POST /api/v1/employee/work/{id}/advance": { tag: "Employee Workspace", realm: "EMPLOYEE", permission: "workflow.advance", summary: "Advance a workflow step.", description: "A step marked as requiring a decision can only be completed by a person — the engine will not complete one on an employee's behalf." },
  "GET /api/v1/employee/escalations": { tag: "Employee Workspace", realm: "EMPLOYEE", permission: "work.read.all", summary: "Escalations across the operation.", description: "Needs the wider read by definition: `work.read` is one person's queue, this is everybody's." },
  "GET /api/v1/employee/analytics": { tag: "Employee Workspace", realm: "EMPLOYEE", permission: "analytics.read", summary: "Operational figures for the team." },
  "GET /api/v1/employee/knowledge": { tag: "Employee Workspace", realm: "EMPLOYEE", permission: "knowledge.read", summary: "Guidance relevant to the work in hand." },
  "GET /api/v1/employee/workflows": { tag: "Employee Workspace", realm: "EMPLOYEE", summary: "The workflow definitions the platform runs." },

  // ── Documents ──────────────────────────────────────────────────────────────
  // Scoped by caller rather than realm-walled: a customer manages their own
  // documents, and staff routes carry a capability instead.
  "GET /api/v1/documents": { tag: "Documents", summary: "Documents the caller may see.", description: "Always the caller's own. An employee reaching a customer's documents goes through the work item, which is already scoped." },
  "GET /api/v1/documents/requirements": { tag: "Documents", summary: "What this caller still owes." },
  "GET /api/v1/documents/{id}": { tag: "Documents", summary: "One document." },
  "DELETE /api/v1/documents/{id}": { tag: "Documents", summary: "Delete a document the caller owns." },
  "POST /api/v1/documents/{id}/process": { tag: "Documents", permission: "work.write", summary: "Re-run the extraction pipeline.", description: "The only way a document that failed processing gets another attempt." },
  "GET /api/v1/documents/queue/pending": { tag: "Documents", permission: "work.read", summary: "Documents awaiting verification." },
  "POST /api/v1/documents/{id}/decision": { tag: "Documents", permission: "work.write", summary: "Verify or reject a document.", description: "The only path to VERIFIED or REJECTED, and it always records who decided." },
  "POST /api/v1/documents/requests": { tag: "Documents", permission: "work.write", summary: "Ask a customer for documents.", description: "A person decides the facts; the resolver decides what those facts require." },
  "GET /api/v1/documents/stats/overview": { tag: "Documents", permission: "analytics.read", summary: "Throughput counts.", description: "Counts only — no contents, no filenames. Monitoring throughput needs no sight of what a customer uploaded." },

  // ── Intelligence ───────────────────────────────────────────────────────────
  "GET /api/v1/intelligence/profile": { tag: "Intelligence", summary: "The caller's insurance profile." },
  "PUT /api/v1/intelligence/profile": { tag: "Intelligence", summary: "Update the caller's profile.", description: "Changing the profile invalidates advice derived from it — a recommendation is cached against a hash of the profile it was built from." },
  "POST /api/v1/intelligence/policies": { tag: "Intelligence", summary: "Declare a policy the caller holds." },
  "DELETE /api/v1/intelligence/policies/{id}": { tag: "Intelligence", summary: "Remove a declared policy." },
  "GET /api/v1/intelligence/report": { tag: "Intelligence", summary: "The full analysis for the caller.", description: "Needs, gaps, risk and recommendations, each carrying its own explanation." },
  "GET /api/v1/intelligence/history": { tag: "Intelligence", summary: "Previous analyses, so advice can be traced to when it was given." },
  "GET /api/v1/intelligence/customers": { tag: "Intelligence", permission: "customer.read", summary: "Customers an employee may advise." },
  "GET /api/v1/intelligence/customer/{userId}/brief": { tag: "Intelligence", permission: "customer.read", summary: "One customer's position, for the person advising them." },
  "GET /api/v1/intelligence/analytics/overview": { tag: "Intelligence", permission: "analytics.read", summary: "Aggregate intelligence figures." },
  "GET /api/v1/intelligence/analytics/risk-distribution": { tag: "Intelligence", permission: "analytics.read", summary: "How risk is spread across profiles." },
  "GET /api/v1/intelligence/analytics/coverage-gaps": { tag: "Intelligence", permission: "analytics.read", summary: "Where customers are underinsured." },
  "GET /api/v1/intelligence/analytics/renewals": { tag: "Intelligence", permission: "analytics.read", summary: "Renewal exposure across the book." },

  // ── Communication ──────────────────────────────────────────────────────────
  // Authenticated as a whole; each route is scoped to the caller, so authority
  // comes from who they are rather than a capability. The three at the end are
  // the exceptions and say so.
  "GET /api/v1/communication/notifications": { tag: "Communication", summary: "The caller's notifications." },
  "GET /api/v1/communication/notifications/unread-count": { tag: "Communication", summary: "How many are unread." },
  "POST /api/v1/communication/notifications/read": { tag: "Communication", summary: "Mark notifications read." },
  "POST /api/v1/communication/notifications/archive": { tag: "Communication", summary: "Archive notifications." },
  "GET /api/v1/communication/preferences": { tag: "Communication", summary: "How the caller wants to be contacted." },
  "PUT /api/v1/communication/preferences": { tag: "Communication", summary: "Change contact preferences." },
  "GET /api/v1/communication/inbox": { tag: "Communication", summary: "Conversations the caller is part of." },
  "POST /api/v1/communication/conversations": { tag: "Communication", summary: "Start a conversation." },
  "GET /api/v1/communication/conversations/{id}": { tag: "Communication", summary: "One conversation and its messages." },
  "POST /api/v1/communication/conversations/{id}/messages": { tag: "Communication", summary: "Send a message." },
  "POST /api/v1/communication/conversations/{id}/participants": { tag: "Communication", summary: "Add a participant." },
  "POST /api/v1/communication/conversations/{id}/read": { tag: "Communication", summary: "Mark a conversation read." },
  "GET /api/v1/communication/conversations/{id}/summary": { tag: "Communication", summary: "A summary of the exchange." },
  "GET /api/v1/communication/conversations/{id}/triage": { tag: "Communication", summary: "What the conversation appears to need." },
  "POST /api/v1/communication/conversations/{id}/draft": { tag: "Communication", summary: "Draft a reply for a person to send.", description: "A draft, never a send — the assistant proposes and a person decides." },
  "GET /api/v1/communication/timeline": { tag: "Communication", summary: "What has happened, for the caller." },
  "GET /api/v1/communication/timeline/{subjectKind}/{subjectId}": { tag: "Communication", summary: "The timeline of one subject." },
  "GET /api/v1/communication/announcements": { tag: "Communication", summary: "Announcements addressed to the caller." },
  "POST /api/v1/communication/announcements": { tag: "Communication", summary: "Publish an announcement.", permission: "staff.manage | platform.configure (enforced in the service, not by route middleware)", description: "Publishing requires `staff.manage` or `platform.configure`; an audience of ALL or CUSTOMER requires `platform.configure`, so an enterprise administrator can address their own staff and only an Aegis operator can reach beyond one organisation. The audience realm comes from the request body and is validated against the known realms — the caller's authority decides which they may name. Announcements carry no organisation of their own, so they are platform-wide records." },
  "POST /api/v1/communication/announcements/{id}/read": { tag: "Communication", summary: "Mark an announcement read." },
  "GET /api/v1/communication/activity": { tag: "Communication", permission: "work.read", summary: "Recent activity across the operation." },
  "GET /api/v1/communication/analytics/overview": { tag: "Communication", permission: "analytics.read", summary: "Delivery and engagement figures." },
  "GET /api/v1/communication/analytics/health": { tag: "Communication", permission: "platform.configure", summary: "Whether the delivery channels are working.", description: "A platform capability: channel health is infrastructure, not a tenant's business." },

  // ── Knowledge ──────────────────────────────────────────────────────────────
  // Reading is open to any signed-in account; writing needs `knowledge.write`.
  // Guidance nobody approved is the failure this section exists to prevent, so
  // the write path runs through submit → review rather than straight to live.
  "GET /api/v1/knowledge/categories": { tag: "Knowledge", summary: "The category tree." },
  "POST /api/v1/knowledge/categories/seed": { tag: "Knowledge", permission: "knowledge.write", summary: "Create the default categories." },
  "GET /api/v1/knowledge/tags": { tag: "Knowledge", summary: "Tags in use." },
  "GET /api/v1/knowledge/search": { tag: "Knowledge", summary: "Search approved guidance.", description: "Lexical, over an inverted index — deterministic and explainable, so a result can be justified." },
  "POST /api/v1/knowledge/route": { tag: "Knowledge", summary: "Find the guidance that answers a question." },
  "GET /api/v1/knowledge/articles": { tag: "Knowledge", summary: "Articles the caller may read." },
  "POST /api/v1/knowledge/articles": { tag: "Knowledge", permission: "knowledge.write", summary: "Draft an article." },
  "GET /api/v1/knowledge/articles/{idOrSlug}": { tag: "Knowledge", summary: "One article, by id or slug." },
  "PATCH /api/v1/knowledge/articles/{id}": { tag: "Knowledge", permission: "knowledge.write", summary: "Edit a draft.", description: "Every edit writes a version, so what changed and who changed it survives the edit." },
  "POST /api/v1/knowledge/articles/{id}/submit": { tag: "Knowledge", permission: "knowledge.write", summary: "Submit for review." },
  "POST /api/v1/knowledge/articles/{id}/review": { tag: "Knowledge", permission: "knowledge.write", summary: "Approve or reject a submission.", description: "The gate that makes the difference between guidance and opinion." },
  "POST /api/v1/knowledge/articles/{id}/archive": { tag: "Knowledge", permission: "knowledge.write", summary: "Withdraw an article from use." },
  "GET /api/v1/knowledge/articles/{id}/history": { tag: "Knowledge", summary: "Every version, and who approved which." },
  "GET /api/v1/knowledge/articles/{id}/permissions": { tag: "Knowledge", permission: "knowledge.write", summary: "Who may read this article." },
  "POST /api/v1/knowledge/articles/{id}/permissions": { tag: "Knowledge", permission: "knowledge.write", summary: "Grant read access." },
  "DELETE /api/v1/knowledge/permissions/{id}": { tag: "Knowledge", permission: "knowledge.write", summary: "Revoke a grant." },
  "POST /api/v1/knowledge/parse": { tag: "Knowledge", permission: "knowledge.write", summary: "Turn a document into a draft article." },
  "GET /api/v1/knowledge/analytics": { tag: "Knowledge", permission: "knowledge.write", summary: "What is read, and what is going stale." },
  "POST /api/v1/knowledge/memory": { tag: "Knowledge", summary: "Record a fact, with its source.", description: "A fact about a customer with no recorded source is one the business cannot defend when challenged, so provenance is required rather than optional." },
  "GET /api/v1/knowledge/memory/{scope}/{subjectId}": { tag: "Knowledge", summary: "What is known about a subject." },
  "GET /api/v1/knowledge/memory/{scope}/{subjectId}/history/{key}": { tag: "Knowledge", summary: "How one fact changed over time." },
  "GET /api/v1/knowledge/memory/{scope}/{subjectId}/export": { tag: "Knowledge", summary: "Everything held about a subject.", description: "A subject access request answered from one place." },
  "DELETE /api/v1/knowledge/memory/{scope}/{subjectId}/{key}": { tag: "Knowledge", summary: "Forget one fact." },
  "POST /api/v1/knowledge/conversation-memory": { tag: "Knowledge", summary: "Record something worth keeping from a conversation." },
  "GET /api/v1/knowledge/conversation-memory/{sessionRef}": { tag: "Knowledge", summary: "What was kept from a session." },
  "POST /api/v1/knowledge/conversation-memory/{id}/pin": { tag: "Knowledge", summary: "Keep an item in view." },
  "POST /api/v1/knowledge/conversation-memory/{id}/promote": { tag: "Knowledge", summary: "Promote a conversation note into institutional memory." },
  "GET /api/v1/knowledge/organization-memory/{organizationId}": { tag: "Knowledge", summary: "What the organisation knows about itself." },
  "POST /api/v1/knowledge/organization-memory/{organizationId}": { tag: "Knowledge", summary: "Record an organisational fact." },

  // ── Platform ───────────────────────────────────────────────────────────────
  // The narrowest door on the API: PLATFORM realm *and* `platform.configure`,
  // applied to the router as a whole. Anything that changes a tenant's standing
  // additionally requires fresh authentication — a stolen cookie must not be
  // enough to suspend an organisation.
  "GET /api/v1/platform/overview": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "The platform at a glance." },
  "GET /api/v1/platform/backup": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Backup state." },
  "GET /api/v1/platform/integrations": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Which external services are configured." },
  "GET /api/v1/platform/organizations": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Every tenant." },
  "POST /api/v1/platform/organizations": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Create a tenant.", description: "Requires fresh authentication." },
  "POST /api/v1/platform/organizations/{id}/members": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Add a member to a tenant.", description: "Requires fresh authentication." },
  "PATCH /api/v1/platform/organizations/{id}/status": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Suspend, restore or archive a tenant.", description: "Requires fresh authentication." },
  "PATCH /api/v1/platform/organizations/{id}/licence": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Change a tenant's licence.", description: "Seats cannot be cut below the accounts that already exist. Requires fresh authentication." },
  "GET /api/v1/platform/licences": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Licences across tenants." },
  "GET /api/v1/platform/identities": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Configured identity providers." },
  "GET /api/v1/platform/roles": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "The role model, as code defines it.", description: "Read from the same table the middleware enforces, so it cannot describe a model the platform is not applying." },
  "GET /api/v1/platform/sessions": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Sessions held across the platform." },
  "DELETE /api/v1/platform/sessions/{id}": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Revoke a session.", description: "Requires fresh authentication." },
  "GET /api/v1/platform/settings": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Platform settings." },
  "PATCH /api/v1/platform/settings/{key}": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Change a setting.", description: "Requires fresh authentication." },
  "GET /api/v1/platform/security": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "Security posture across the platform." },
  "GET /api/v1/platform/ai-governance": { tag: "Platform", realm: "PLATFORM", permission: "platform.configure", summary: "How the AI estate is behaving.", description: "Observability only. Nothing here changes a model, a prompt or a routing rule." },
};
