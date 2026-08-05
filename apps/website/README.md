# @aegis/website — the public company site

The only Aegis application with no session, no personal data and no
authentication. It exists to explain what the company does and to hand a visitor
to the right portal.

**It must never show anything that lives behind a sign-in.** No conversations,
no assistant names, no internal architecture, no dashboard. Everything on this
site is public by definition, and that is the line it is designed around.

```
pnpm --filter @aegis/website dev     # http://localhost:3100
pnpm --filter @aegis/website build
pnpm --filter @aegis/website lint
pnpm --filter @aegis/website typecheck
```

---

## 1. Routing

App Router, one directory per page. Everything is statically rendered except the
form endpoint.

| Route                         | Rendering         | What it is                                                                      |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| `/`                           | Static            | Hero, mission, vision, why, benefits, platform, security, customer success, CTA |
| `/about`                      | Static            | Founder story, mission, vision, six values                                      |
| `/products`                   | Static            | Motor, health, property, travel; business marked coming soon                    |
| `/solutions`                  | Static            | Individuals and insurers; claims, renewals, fraud, platform                     |
| `/industries`                 | Static            | Insurance today; banking, healthcare, government as future                      |
| `/resources`                  | Static            | Guides, FAQ, knowledge centre, documentation (future)                           |
| `/contact`                    | Static            | Enquiry form plus email, phone, office, socials                                 |
| `/request-demo`               | Static            | Enterprise demo form                                                            |
| `/get-started`                | Static            | Portal gateway — see §3                                                         |
| `/careers`                    | Static, `noindex` | Coming soon                                                                     |
| `/blog`                       | Static, `noindex` | Coming soon                                                                     |
| `/api/enquiry`                | Dynamic (Node)    | Receives both forms                                                             |
| `/robots.txt`, `/sitemap.xml` | Generated         | From `lib/site.ts`                                                              |

`not-found.tsx` lists every page rather than apologising, because someone who
lands there still has somewhere they were trying to get to.

---

## 2. Folder structure

```
src/
  app/                    One directory per route; layout.tsx owns the chrome
    api/enquiry/route.ts  Validates, throttles, delivers
  components/
    layout/               SiteHeader, SiteFooter, Wordmark
    sections/             Section, SectionHeading, FeatureGrid, CTABand
    forms/                Field primitives, EnquiryForm
    ui/                   Icon, Reveal, Accordion, Backdrop, ComingSoon
  lib/
    site.ts               Navigation, portals, contact details — one source
    seo.ts                pageMetadata(), organizationJsonLd()
    enquiry.ts            The validation rules, shared client and server
```

Everything visual comes from `@aegis/design-system` and `@aegis/ui`. This app
defines no colours and no scale of its own — see MONOREPO.md for why that line
matters across five front-ends.

---

## 3. The portal gateway

`/get-started` does not sign anyone in. It routes to the application that owns
that kind of session, and each one runs its own authentication.

That is the identity model made visible rather than a design preference. A
customer and a member of staff are different kinds of principal with genuinely
conflicting session policies — a customer wants a long, forgiving session
renewed silently; staff need a short one behind a second factor. One login form
serving both would have to pick, and a string comparison would end up being the
only thing between public self-registration and administrative access.

Destinations are environment-configured (`NEXT_PUBLIC_*_PORTAL_URL`). Portals
that are not open yet say so and are not rendered as links — a link that goes
nowhere is worse than a plain statement.

---

## 4. Decisions worth knowing about

**Dark only, with no toggle.** The portals honour the customer's theme because
people work inside them for hours. A marketing site is a first impression
measured in seconds and should be one considered thing. `.dark` is written
directly on `<html>`, which also removes the theme script, the flash of wrong
colours, and all client-side theme state.

**Server components by default.** Only four things ship JavaScript: the header
(scroll state and the mobile menu), `Reveal`, and the two form components. Every
page lands at roughly 118 kB first load, and the FAQ works before hydration
because it is `<details>` rather than state.

**No icon library and no web font.** Icons are inline paths; the type stack is
the system one, already including Noto Sans Tamil. This is the app that has to
be quick on a village 3G connection, and both are requests it does not make.

**Nothing is claimed that cannot be substantiated.** No invented testimonials,
no certifications, no customer counts. The customer-success section says
plainly that there is nothing to show yet, and the security section describes
what the platform does rather than displaying badges.

---

## 5. Before this goes to a public domain

- Replace the placeholder contact details and social handles in `lib/site.ts`.
  They are structured correctly but they are not real routes to a real desk.
- Set `NEXT_PUBLIC_SITE_URL`, or every canonical URL points at localhost.
- Set `ENQUIRY_WEBHOOK_URL`, or enquiries reach a log rather than a person.
- Add an Open Graph image. The tags are emitted; there is no artwork behind them.
- The `/api/enquiry` throttle is in-process, so it is per-instance. Behind more
  than one instance it needs shared state or an edge rule.
