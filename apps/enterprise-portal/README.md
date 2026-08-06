# @aegis/enterprise-portal — the enterprise console

Business operations, governance and oversight for an insurance organisation.

**Read-heavy by design.** Administrators watch, investigate and report. The
things that change a customer's outcome — approving a claim, verifying an
identity — stay with the employees answerable for them. A console that could
quietly approve a claim would make the human gate in the workflow engine
decorative.

```
pnpm --filter @aegis/enterprise-portal dev     # http://localhost:3103
```

---

## 1. Who gets in

`requireRealm("ENTERPRISE")` walls the whole API surface, then each route names
the capability it needs. Verified live:

|                    | dashboard | customers | claims | audit | ai-systems |
| ------------------ | --------- | --------- | ------ | ----- | ---------- |
| Customer           | 403       | 403       | 403    | 403   | 403        |
| Employee           | 403       | 403       | 403    | 403   | 403        |
| `ENTERPRISE_ADMIN` | 200       | 200       | 200    | 200   | **403**    |
| `PLATFORM_ADMIN`   | 200       | 200       | 200    | 200   | 200        |

The employee row is the point of having both checks: an employee holds
`analytics.read`, and must still never reach this console. AI monitoring needs
`platform.configure`, which an organisation's administrator does not hold — the
realm gets you in the door, the permission decides the room.

---

## 2. Honesty about what is measured

Four figures the platform cannot produce are declared rather than invented:

| Figure                | Why not                                      | What it would need                          |
| --------------------- | -------------------------------------------- | ------------------------------------------- |
| Revenue               | List premiums exist; transactions do not     | A payment/issuance record with an amount    |
| Customer satisfaction | Nothing asks customers                       | A post-resolution survey or rating          |
| Fraud signals         | Risk analysis runs but persists no score     | A stored score on the risk_analysis step    |
| Document verification | Uploads record who and when, not who checked | `verifiedAt` + verifier on UploadedDocument |

They render as a distinct card that says "Not measured" and names the gap. A
dashboard that invents a satisfaction score is worse than one that admits it has
none — the invented one gets quoted in a board pack.

**Compliance never claims IRDAI certification.** It runs the platform's own
checks against its own records and says so prominently. Certification is a
matter of audit and licensing, not of software asserting it about itself.

---

## 3. AI Orchestration Centre

Monitoring only. There is no route and no control that changes a model, a prompt
or a routing rule. Six systems are tracked from tables the platform already
writes to; "idle" is reported separately from "healthy", because a system with
no traffic reported green is how an outage goes unnoticed over a weekend.

What administrators _may_ configure is listed per system, so the boundary is
visible rather than merely enforced.

---

## 4. Known gaps

- Six sidebar sections are marked "Soon": policies, renewals, document centre,
  KYC monitoring, notifications, settings.
- Report cadences (daily/weekly/quarterly/yearly) are absent: the platform holds
  weeks of history, not years, and a yearly report over that window would be a
  chart with one point and a misleading title.
- PDF and Excel export are not implemented. CSV opens in Excel and in every
  other spreadsheet.
- Employee training status is not shown because nothing records it.
