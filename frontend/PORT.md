# Why this app must run on port 3000

Google sign-in will not work on any other port.

Google Identity Services refuses to run on an origin that is not listed under
**Authorised JavaScript origins** for the OAuth client. The client for project
`aegis-ai-504306` authorises exactly one development origin:

    http://localhost:3000

Serve the app from anywhere else and Google returns:

    Error 400: origin_mismatch
    Access blocked: Authorisation error

Nothing in the app is broken when this happens — email/password sign-in still
works. Only Google is refused, and the failure is reported by Google, not by us.

## The trap

`next dev` **silently moves to the next free port** when 3000 is taken. Start a
second dev server by accident and it lands on 3001, Google stops working, and
nothing in the app explains why.

`package.json` therefore pins the port:

    "dev": "next dev -p 3000"

If 3000 is already in use, free it rather than letting the app drift:

    ss -lptn 'sport = :3000'      # find the process id
    kill <pid>

## If you genuinely need another port

Add that exact origin in Google Cloud Console →
**APIs & Services → Credentials → (Web client) → Authorised JavaScript origins**,
e.g. `http://localhost:3001`. Origins must match scheme, host **and** port
exactly; there are no wildcards.

Note that `redirect_uris` on that client is irrelevant here. This app uses the
Google Identity Services popup and verifies the returned ID token server-side,
so no OAuth redirect ever happens — and no client secret is needed or stored.
