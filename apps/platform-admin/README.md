# @aegis/platform-admin — the platform console

The operator's console: tenancy, configuration, identity across every realm,
infrastructure, security and AI governance.

**The narrowest door on the platform.** `PLATFORM` realm _and_
`platform.configure`. An enterprise administrator — powerful inside their own
organisation — cannot reach any of it, because this console sits above every
organisation.

```
pnpm --filter @aegis/platform-admin dev     # http://localhost:3104
```

---

## 1. Access, verified live

|                    | overview | organizations | settings | ai-governance |
| ------------------ | -------- | ------------- | -------- | ------------- |
| Customer           | 403      | 403           | 403      | 403           |
| Employee           | 403      | 403           | 403      | 403           |
| `ENTERPRISE_ADMIN` | 403      | 403           | 403      | 403           |
| `PLATFORM_ADMIN`   | 200      | 200           | 200      | 200           |

**Reads need realm + capability. Writes additionally need a fresh
re-authentication.** Everything mutable here is structural — suspending a tenant
signs out their whole staff, changing a setting affects every request — and a
session cookie alone cannot tell the operator from whoever sat down at their
unlocked laptop.

---

## 2. What is real

Infrastructure telemetry is genuinely probed, not sampled from a metrics
service that does not exist:

- **Database** — `SELECT 1`, timed. Reports the dialect, never the connection
  string.
- **Cache / queue** — reports _what backs them_. An in-process fallback is
  `NOT_CONFIGURED`, not `UP`, because saying UP would hide that jobs are lost on
  restart.
- **Storage** — the uploads directory, walked with a depth limit.
- **Host** — memory and load average from the OS, with load-per-core as the
  comparable figure and an explicit note where load average is meaningless.

`IDLE` is separate from `HEALTHY` throughout. A system with no traffic reported
green is how an outage goes unnoticed over a quiet weekend.

---

## 3. What is declared missing

| Gap                                                | Why                                          | What it needs                                                              |
| -------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| Request rate, error rate, latency percentiles      | Nothing stores a time series                 | A metrics store, or a histogram in the request logger                      |
| AI token usage and cost                            | The engine does not report usage back        | Usage returned per completion, persisted per request                       |
| Agent version, deployment status, knowledge source | No registry, no retrieval trace              | A release record per agent; retrieved-source ids stored per response       |
| Revenue                                            | Licence plans exist; billing does not        | A billing integration or invoice record                                    |
| Backup and restore                                 | **Cannot be done safely from a web request** | A scheduled dump to object storage, restored by an operator with a runbook |

Each is rendered as its own card naming the record that would have to start
being written. None is a number.

---

## 4. Deliberate absences

- **No delete for organisations.** Removing a tenant would orphan every record
  their staff created. Suspension and archival are as far as this goes.
- **No unlock button.** A lockout is itself a denial-of-service vector — anybody
  who knows an address can trigger one, and a manual unlock would make that
  worth doing. Locks expire on their own.
- **No route that changes a model, prompt or routing rule.** Governance here
  means seeing what is running and what it has done.
- **No role editor.** Roles are code: a typo becomes a compile error rather than
  a silently missing capability, and changing what a role means is a reviewed
  change.
- **Secrets are environment-only** and listed as such, so an operator does not
  hunt for a control that should never exist.
