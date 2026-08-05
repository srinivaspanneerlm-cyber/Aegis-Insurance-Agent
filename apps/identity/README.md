# @aegis/identity — the identity platform

Every sign-in to Aegis happens here. All four portals redirect to this app,
it authenticates the person, and it sends them to the portal their realm
entitles them to.

```
pnpm --filter @aegis/identity dev     # http://localhost:3105
pnpm --filter @aegis/identity build
pnpm --filter @aegis/identity lint
pnpm --filter @aegis/identity typecheck
```

---

## 1. The flow

```
Public website (:3100)
      │  Get started → portal card
      ▼
Identity platform (:3105)  /login?portal=CUSTOMER
      │  POST /auth/login { email, password, realm }
      ▼
API (:5000)  ── realm check ── password ── lockout ── verification
      │  sets aegis_token · aegis_refresh · aegis_session (httpOnly)
      │  returns { user, permissions, realm, portalUrl }
      ▼
Portal decided by realm
   CUSTOMER   → :3000   (the live customer portal)
   EMPLOYEE   → :3102
   ENTERPRISE → :3103
   PLATFORM   → :3104
```

The API decides `portalUrl`, not this app. Making the client derive it would
put the routing rules in two places, and the one that matters is the one that
also enforces the realm.

---

## 2. Screens

| Route              | What it is                                                         |
| ------------------ | ------------------------------------------------------------------ |
| `/`                | Portal chooser, for anyone who arrives without a realm             |
| `/login`           | Sign in. One screen for all four realms — the differences are data |
| `/register`        | Customer accounts only; staff accounts are provisioned             |
| `/forgot-password` | Request a reset link                                               |
| `/reset-password`  | Choose a new password from the emailed token                       |
| `/verify-email`    | Confirm an address, or ask for a new link                          |
| `/access-denied`   | Signed in, but lacks the permission                                |
| `/unauthorized`    | Not signed in at all                                               |
| `/session-expired` | The session ended mid-task, with the reason where known            |

`/access-denied` and `/unauthorized` are deliberately separate. Merging them
would tell an authenticated person to sign in again, sending them round a loop
that cannot end.

---

## 3. Decisions worth knowing about

**Pages are server components; only the forms are client.** The first version
read `useSearchParams` inside client pages, which opts the whole subtree out of
prerendering — the app was serving an empty document with a sign-in form that
only existed once JavaScript ran. Search params are now read on the server in
`lib/searchParams.ts` and handed down as plain props.

**One provider, four selector hooks.** `IdentityProvider` holds session, user,
permissions and loading/error state. They are not four contexts because they
are not four lifetimes — a user without a session is meaningless and
permissions derive from the same answer. `useSession`, `useUser`,
`usePermissions` and `useIdentityStatus` are what the separation actually buys.

**The realm table here decides nothing.** `lib/identity.ts` mirrors the
backend's `src/auth/realms.ts` for labels and which buttons to draw. The server
refuses a wrong-realm sign-in on its own; if the two ever disagree, the worst
outcome is a button that turns out not to work.

**`?next=` goes through `safeNextPath`.** It is attacker-controlled, and
without the guard `/unauthorized?next=https://evil.example` would send a freshly
signed-in person off the site with their guard down.

**Provider buttons come from the server's list.** A deployment without Google
keys shows no Google button rather than one that fails. The platform realm
shows none at all, and says why — platform authority must not depend on
somebody else's account-recovery process.

**`noindex` on everything.** These pages are forms and messages about a
person's own session. There is nothing here for a search engine.

---

## 4. Known gaps

- **The provider button is a hand-off, not an exchange.** Google Identity
  Services issues the credential; wiring GIS into this app and posting to
  `/auth/oauth/:provider` is the remaining piece. The API side is complete and
  tested — `apps/identity` simply does not yet host the button script.
- **No email is actually delivered.** Set `AUTH_MAIL_WEBHOOK_URL` on the API.
  Unset, links are written to the server log (and withheld from it in
  production), so the flows are testable but nobody receives anything.
- **Portals do not yet enforce the realm on arrival.** They accept the session
  the API minted. Sprint 4 owns the guard on the portal side that redirects a
  wrong-realm arrival to `/access-denied`.
