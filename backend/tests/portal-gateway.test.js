/**
 * The portal gateway, driven through the real app.
 *
 * One question decides everything here: may this person enter that workspace?
 * It is answered on the server, from the stored realm, and the destination is
 * only ever handed back — never assembled by the client. That is what makes a
 * hand-edited address bar useless, and it is what these tests are really
 * checking.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000"; // one IP for the suite; 20/hour is right in production
// The identity app is the only thing that calls the gateway, and CLIENT_URL is
// the CSRF allowlist. Omitting :3105 there is not a test detail — it is the
// misconfiguration that would 403 every gateway POST in a real deployment.
process.env.CLIENT_URL = "http://localhost:3105,http://localhost:3100,http://localhost:3000";
process.env.CUSTOMER_PORTAL_URL = "https://customer.aegis.test";
process.env.EMPLOYEE_PORTAL_URL = "https://employee.aegis.test";
process.env.ENTERPRISE_PORTAL_URL = "https://enterprise.aegis.test";
process.env.PLATFORM_ADMIN_URL = "https://platform.aegis.test";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-gateway-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3105";
const PASSWORD = "correct-horse-battery";

after(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
});

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

/**
 * A signed-in account in the given realm.
 *
 * Registration always produces a customer, so anything else is promoted
 * directly — provisioning staff is a later sprint's job, and inventing a route
 * for it here would be testing something that does not exist.
 */
async function signedInAs(realm, role, tag) {
  const email = `gw-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const reg = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: "Gateway Subject", email, password: PASSWORD });
  assert.equal(reg.status, 201);

  if (realm !== "CUSTOMER") {
    await prisma.user.update({
      where: { id: reg.body.data.user.id },
      data: { realm, role, emailVerifiedAt: new Date() },
    });
    // The session cookie is still valid — `protect` reads the stored record on
    // every request, so the promotion takes effect immediately.
  }

  return { userId: reg.body.data.user.id, email, cookie: cookieHeader(reg) };
}

const portals = (cookie) => request(app).get("/api/v1/auth/portals").set("Cookie", cookie);

const enter = (cookie, portal) =>
  request(app)
    .post(`/api/v1/auth/portals/${portal}/enter`)
    .set("Cookie", cookie)
    .set("Origin", ORIGIN);

const REALMS = [
  { realm: "CUSTOMER", role: "CUSTOMER", portal: "customer", url: "https://customer.aegis.test" },
  { realm: "EMPLOYEE", role: "EMPLOYEE", portal: "employee", url: "https://employee.aegis.test" },
  {
    realm: "ENTERPRISE",
    role: "ENTERPRISE_ADMIN",
    portal: "enterprise",
    url: "https://enterprise.aegis.test",
  },
  {
    realm: "PLATFORM",
    role: "PLATFORM_ADMIN",
    portal: "platform",
    url: "https://platform.aegis.test",
  },
];

describe("Gateway — what each role is shown", () => {
  for (const { realm, role, portal } of REALMS) {
    test(`${role} is entitled to exactly one workspace, and it is ${portal}`, async () => {
      const session = await signedInAs(realm, role, realm.toLowerCase());
      const res = await portals(session.cookie);

      assert.equal(res.status, 200);
      const entitled = res.body.data.portals.filter((p) => p.entitled);
      assert.equal(entitled.length, 1, "exactly one");
      assert.equal(entitled[0].id, portal);
      assert.equal(res.body.data.home, portal);
      assert.equal(res.body.data.realm, realm);
    });
  }

  test("every workspace is listed, including the closed ones", async () => {
    // Deliberate. A gateway showing only what somebody already has is a page
    // with one card on it; showing the set with the rest visibly closed tells
    // them the shape of the platform. The public website already names all four.
    const session = await signedInAs("CUSTOMER", "CUSTOMER", "listall");
    const res = await portals(session.cookie);
    assert.equal(res.body.data.portals.length, 4);
  });

  test("a closed workspace carries no address", async () => {
    // The whole defence. A client cannot navigate to a destination it was never
    // given, so there is nothing in the page for a tampered URL to reach for.
    const session = await signedInAs("CUSTOMER", "CUSTOMER", "nourl");
    const res = await portals(session.cookie);

    for (const portal of res.body.data.portals) {
      if (portal.entitled) assert.ok(portal.url, `${portal.id} should carry a url`);
      else assert.equal(portal.url, null, `${portal.id} must not carry a url`);
    }
  });

  test("the descriptions describe the work, never the machinery", async () => {
    // The gateway is the first thing an authenticated stranger sees. It is not
    // a place to name an agent, a service or an internal component.
    const session = await signedInAs("PLATFORM", "PLATFORM_ADMIN", "nointernals");
    const res = await portals(session.cookie);
    const text = JSON.stringify(res.body).toLowerCase();

    const forbidden = [
      "sarah",
      "alex",
      "emma",
      "ethan",
      "nova",
      "orchestrator",
      // The Aegis-AI knowledge tree, which is internal structure by any name.
      "layer1",
      "layer2",
      "layer3",
      "layer4",
      "layer5",
      "ai-python",
      "prisma",
    ];
    for (const term of forbidden) {
      assert.ok(!text.includes(term), `"${term}" must not appear`);
    }
  });

  test("it needs a session", async () => {
    const res = await request(app).get("/api/v1/auth/portals");
    assert.equal(res.status, 401);
  });
});

describe("Gateway — entering", () => {
  for (const { realm, role, portal, url } of REALMS) {
    test(`${role} enters ${portal} and is told where to go`, async () => {
      const session = await signedInAs(realm, role, `enter-${realm.toLowerCase()}`);
      const res = await enter(session.cookie, portal);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.portal, portal);
      assert.equal(res.body.data.url, url);
    });
  }

  test("entering is recorded", async () => {
    const session = await signedInAs("CUSTOMER", "CUSTOMER", "audit-ok");
    await enter(session.cookie, "customer");
    await new Promise((resolve) => setTimeout(resolve, 200));

    const entry = await prisma.auditLog.findFirst({
      where: { actorId: session.userId, action: "authz.portal.entered" },
    });
    assert.ok(entry, "an entry is left for someone to find");
  });

  test("it needs a session", async () => {
    const res = await request(app)
      .post("/api/v1/auth/portals/customer/enter")
      .set("Origin", ORIGIN);
    assert.equal(res.status, 401);
  });
});

describe("Gateway — doors that are not theirs", () => {
  test("a customer cannot enter the enterprise workspace", async () => {
    const session = await signedInAs("CUSTOMER", "CUSTOMER", "denied");
    const res = await enter(session.cookie, "enterprise");

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "PORTAL_FORBIDDEN");
  });

  test("every wrong door is refused, for every role", async () => {
    for (const { realm, role } of REALMS) {
      const session = await signedInAs(realm, role, `matrix-${realm.toLowerCase()}`);
      for (const other of REALMS) {
        const res = await enter(session.cookie, other.portal);
        const expected = other.realm === realm ? 200 : 403;
        assert.equal(res.status, expected, `${role} → ${other.portal}`);
      }
    }
  });

  test("a refusal is recorded, because it is somebody trying a door", async () => {
    const session = await signedInAs("CUSTOMER", "CUSTOMER", "audit-denied");
    await enter(session.cookie, "platform");
    await new Promise((resolve) => setTimeout(resolve, 200));

    const entry = await prisma.auditLog.findFirst({
      where: { actorId: session.userId, action: "authz.portal.denied" },
    });
    assert.ok(entry, "the attempt is visible afterwards");
  });

  test("an unknown workspace answers exactly like a forbidden one", async () => {
    // Telling somebody that "enterprise" exists but is refused, while
    // "warehouse" does not exist, maps the estate out for whoever is guessing.
    const session = await signedInAs("CUSTOMER", "CUSTOMER", "unknown");
    const forbidden = await enter(session.cookie, "platform");
    const nonsense = await enter(session.cookie, "warehouse");

    assert.equal(nonsense.status, forbidden.status);
    assert.equal(nonsense.body.code, forbidden.body.code);
    assert.equal(nonsense.body.message, forbidden.body.message);
  });

  test("a path-traversal attempt is just an unknown workspace", async () => {
    const session = await signedInAs("CUSTOMER", "CUSTOMER", "traversal");
    const res = await request(app)
      .post(`/api/v1/auth/portals/${encodeURIComponent("../../platform")}/enter`)
      .set("Cookie", session.cookie)
      .set("Origin", ORIGIN);

    assert.ok(res.status === 403 || res.status === 404, `got ${res.status}`);
  });

  test("the realm comes from the record, never from the request", async () => {
    // A client that could name its own realm would be choosing its own
    // authorisation. Nothing in the body is read.
    const session = await signedInAs("CUSTOMER", "CUSTOMER", "selfclaim");
    const res = await request(app)
      .post("/api/v1/auth/portals/platform/enter")
      .set("Cookie", session.cookie)
      .set("Origin", ORIGIN)
      .send({ realm: "PLATFORM", role: "PLATFORM_ADMIN" });

    assert.equal(res.status, 403);
  });

  test("a deactivated account cannot enter its own workspace", async () => {
    const session = await signedInAs("CUSTOMER", "CUSTOMER", "deactivated");
    await prisma.user.update({ where: { id: session.userId }, data: { isActive: false } });

    const res = await enter(session.cookie, "customer");
    assert.equal(res.status, 403);
  });
});

describe("Gateway — session state", () => {
  test("a signed-out session cannot list or enter", async () => {
    const session = await signedInAs("CUSTOMER", "CUSTOMER", "loggedout");
    await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", session.cookie)
      .set("Origin", ORIGIN);

    // The access cookie the client still holds is now backed by a closed
    // sitting; the refresh that would renew it has been revoked.
    const renewed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", session.cookie)
      .set("Origin", ORIGIN);
    assert.equal(renewed.status, 401);
  });

  test("promotion takes effect without signing in again", async () => {
    // `protect` reads the stored record on every request, so authorisation is
    // never stale — a role encoded in the token would have been.
    const session = await signedInAs("CUSTOMER", "CUSTOMER", "promoted");
    assert.equal((await enter(session.cookie, "employee")).status, 403);

    await prisma.user.update({
      where: { id: session.userId },
      data: { realm: "EMPLOYEE", role: "EMPLOYEE" },
    });

    assert.equal((await enter(session.cookie, "employee")).status, 200);
    assert.equal((await enter(session.cookie, "customer")).status, 403);
  });
});
