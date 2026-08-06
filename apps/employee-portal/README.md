# @aegis/employee-portal — the employee workspace

Where insurance employees do their work: their queue, the processes behind it,
the numbers they are measured on, and the material they need to answer a
customer.

**Not an admin dashboard.** It has no view of the platform, no user
administration and no configuration. Those belong to Platform Administration,
which is a different application with a different realm.

```
pnpm --filter @aegis/employee-portal dev     # http://localhost:3102
pnpm --filter @aegis/employee-portal build
pnpm --filter @aegis/employee-portal lint
pnpm --filter @aegis/employee-portal typecheck
```

---

## 1. Who gets in

Three checks, and they refuse in three different ways because they are three
different problems:

| State                      | What happens                                                          |
| -------------------------- | --------------------------------------------------------------------- |
| No session                 | → identity platform sign-in, carrying `?next=`                        |
| Session, wrong realm       | → identity platform `/access-denied`                                  |
| EMPLOYEE realm, no profile | Stays here and says so — a provisioning gap, not an authorisation one |

The guard lives in `WorkspaceProvider`, wrapping every screen. A page-level
check is one somebody can forget to add on a new screen, and that failure is
silent and in the wrong direction.

The client guard is a courtesy. The API enforces the same thing on every
request: `requireRealm("EMPLOYEE")` walls the whole route file, and each route
additionally names the capability it needs.

---

## 2. Two questions, two checks

```
requireRealm("EMPLOYEE")     — do you belong on this side of the platform?
requirePermission("…")       — may you do this particular thing?
```

Both, on every employee route. A realm check alone would let any employee
approve any claim. A permission check alone would let a customer through if a
stray capability ever reached their role — a bad migration, a misconfigured
bundle, a future self-service feature. The wall contains that mistake to the
realm it happened in.

Scope is narrower still: `work.read` is your own queue, `work.read.all` is the
team's. The narrow path is the default, so forgetting to scope produces "no
results" rather than "every customer's claim".

---

## 3. Workflows, and the human gate

Four processes — claim approval, KYC, renewal, complaint — defined in
`backend/src/employee/workflows.ts` as code, not rows. A claim approved in
March has to be explainable in September, and a workflow anybody could edit at
runtime has no stable answer to "which steps did this actually go through".

Every definition must end at a person, and **`workflows.ts` refuses to load if
one does not**:

```
Claim approval
  intake                SYSTEM
  document_validation   ASSISTANT
  risk_analysis         ASSISTANT
  recommendation        ASSISTANT
  human_approval        EMPLOYEE   ← decision required, workflow.approve
  settlement            EMPLOYEE
```

The assistant analyses and recommends. It never decides — not out of caution
about model quality, but because somebody has to be answerable, and "the
software decided" is not an answer a regulator or a customer accepts. Where an
employee disagrees with a recommendation, their decision is what is recorded
and the disagreement is kept.

A rejection ends the run rather than continuing past the no.

---

## 4. The operations manager

`backend/src/employee/operationsManager.ts` — deterministic, not generative.
Task distribution is the kind of decision people ask "why did I get this one"
about, and a rule can answer that while a generation cannot.

- **Routing** — least-loaded within the owning department. Not round-robin,
  which distributes count evenly and workload unevenly.
- **Capacity** — a full department leaves work _unassigned_ rather than piling
  one more onto the least-drowning person, because that is how an over-capacity
  team stays invisible until something breaches.
- **Workload** — overdue weighs separately from volume. Thirty items none of
  which are late is a productive day; five all late is somebody stuck.
- **Escalation** — warns before the promise breaks. An escalation that only
  fires on breach is a report.

---

## 5. Folder structure

```
src/
  app/                     dashboard · tasks · claims · kyc · renewals
                           support · analytics · knowledge · assistant
                           work/[id]  (one case, its process, its history)
  components/              WorkspaceShell · Cards · QueueTable · QueuePage
  context/WorkspaceProvider  session, guard, permissions
  lib/workspace.ts         navigation, API shapes, labels
  lib/api.ts               the only place this app calls the API
```

Backend: `src/employee/{workflows,operationsManager}.ts`,
`src/services/employee.service.ts`, `src/routes/employee.routes.ts`.

---

## 6. Known gaps

- **The assistant has no language model behind it.** Its place in the work is
  real and enforced; the conversational surface is not wired, because that
  lives in the protected customer-facing engine and extending it needs sign-off.
  `/assistant` says so rather than shipping a chat box that would invent claim
  procedure — the most dangerous possible placeholder in an insurance product.
- **Six sidebar sections are marked "Soon"** — documents, customers,
  appointments, policies, reports, notifications. They are listed because the
  navigation is honest about the shape of the product, and they say Soon rather
  than 404ing.
- **No staff provisioning UI.** Employee profiles are created directly today.
  Creating them is Platform Administration's job, not this app's.
- **Knowledge search is a `contains` scan**, bounded by `take`. Honest about
  what it is; it earns a real index at scale.
