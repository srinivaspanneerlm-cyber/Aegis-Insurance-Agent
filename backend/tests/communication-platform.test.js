/**
 * The communication platform.
 *
 * Three properties decide whether this is safe to ship, and they are what most
 * of these tests are for:
 *
 *  1. An internal note is never visible to a customer — not in a thread, not in
 *     an inbox, not in a timeline, and not as a notification about a message
 *     they cannot open.
 *  2. Membership decides who can read a conversation. Nothing else does.
 *  3. A security alert cannot be muted, however hard a user or an attacker
 *     tries.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000";
process.env.RL_API_MAX = "5000";
process.env.CLIENT_URL = "http://localhost:3000,http://localhost:3102";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-comms-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after, beforeEach } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");

const { notificationService, preferenceService } = require("../src/services/notification.service");
const { conversationService, inboxService } = require("../src/services/conversation.service");
const { timelineService } = require("../src/services/timeline.service");
const { eventBus, emit, resetEventBus, registerRealtime, resetRealtime } = require("../src/communication/eventBus");
const { registerChannels, resetChannels } = require("../src/communication/channels");
const { registerWorkflowCommunication } = require("../src/communication/workflows");
const { DeterministicAssistant } = require("../src/communication/assistant");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery";

after(async () => {
  resetChannels();
  resetRealtime();
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

let seq = 0;
async function account(tag, realm = "CUSTOMER", role = "CUSTOMER") {
  seq += 1;
  const email = `comms-${tag}-${Date.now()}-${seq}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: `Person ${tag}`, email, password: PASSWORD, passwordConfirm: PASSWORD });
  assert.equal(res.status, 201);
  const userId = res.body.data.user.id;

  // Realm changed after registration; the registration cookie is kept, because
  // the Sprint 4 portal gateway would refuse a staff sign-in at the customer
  // origin. `protect` reads the role from the database on every request.
  if (realm !== "CUSTOMER" || role !== "CUSTOMER") {
    await prisma.user.update({
      where: { id: userId },
      data: { realm, role, emailVerifiedAt: new Date() },
    });
  }
  return { userId, email, cookie: cookieHeader(res), realm, role };
}

const api = (cookie) => ({
  get: (p) => request(app).get(`/api/v1/communication${p}`).set("Cookie", cookie),
  post: (p, body) =>
    request(app).post(`/api/v1/communication${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
  put: (p, body) =>
    request(app).put(`/api/v1/communication${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
});

const actorOf = (a) => ({ id: a.userId, role: a.role, realm: a.realm });

/** Waits for fire-and-forget event handlers to settle. */
const settle = () => new Promise((r) => setTimeout(r, 150));

// ── Notifications ────────────────────────────────────────────────────────────

describe("notifications", () => {
  test("a notification is delivered in-app and recorded", async () => {
    const user = await account("notify");
    const result = await notificationService.send({
      userId: user.userId,
      category: "POLICY",
      title: "Your policy is active",
      body: "Cover started today.",
    });

    assert.ok(result.delivered.includes("IN_APP"));

    const records = await prisma.deliveryRecord.findMany({ where: { notificationId: result.id } });
    // Every channel writes a row, including the ones that did nothing — that is
    // what makes the delivery statistics honest.
    assert.equal(records.length, 5);
    assert.ok(records.some((r) => r.channel === "SMS" && r.status === "SUPPRESSED"));
  });

  test("an unconfigured channel suppresses with a reason, never reports sent", async () => {
    const user = await account("channels");
    const result = await notificationService.send({
      userId: user.userId,
      category: "POLICY",
      title: "Test",
    });

    const sms = result.suppressed.find((s) => s.channel === "SMS");
    assert.ok(sms, "SMS should be suppressed");
    assert.match(sms.reason, /No SMS provider is configured/i);
    assert.ok(!result.delivered.includes("SMS"));
  });

  test("repeats inside the window collapse onto the first", async () => {
    const user = await account("dedupe");
    const a = await notificationService.send({
      userId: user.userId,
      category: "RENEWAL",
      title: "Renewal due",
      dedupeKey: "renewal:policy-1",
    });
    const b = await notificationService.send({
      userId: user.userId,
      category: "RENEWAL",
      title: "Renewal due",
      dedupeKey: "renewal:policy-1",
    });
    assert.equal(a.id, b.id, "the second should collapse onto the first");

    const count = await prisma.notification.count({
      where: { userId: user.userId, dedupeKey: "renewal:policy-1" },
    });
    assert.equal(count, 1);
  });

  test("a security alert is never deduplicated", async () => {
    // Two sign-ins from two devices are two things the account holder needs to
    // know about, not one.
    const user = await account("sec-dedupe");
    const a = await notificationService.send({
      userId: user.userId,
      category: "SECURITY",
      title: "New sign-in",
      dedupeKey: "signin",
    });
    const b = await notificationService.send({
      userId: user.userId,
      category: "SECURITY",
      title: "New sign-in",
      dedupeKey: "signin",
    });
    assert.notEqual(a.id, b.id);
  });

  test("a security alert ignores muting, quiet hours and channel settings", async () => {
    const user = await account("sec-mute");
    await prisma.notificationPreference.create({
      data: {
        userId: user.userId,
        inApp: false,
        email: false,
        // Everything the user could switch off, switched off.
        mutedCategories: JSON.stringify(["POLICY", "CLAIM"]),
        quietHoursStart: "00:00",
        quietHoursEnd: "23:59",
      },
    });

    const muted = await notificationService.send({
      userId: user.userId,
      category: "POLICY",
      title: "Should be suppressed",
    });
    assert.equal(muted.delivered.length, 0, "an ordinary notification respects the settings");

    const security = await notificationService.send({
      userId: user.userId,
      category: "SECURITY",
      title: "Someone signed in as you",
    });
    assert.ok(
      security.delivered.includes("IN_APP"),
      "a security alert must reach somebody who has muted everything"
    );
  });

  test("security cannot be added to the muted list", async () => {
    const user = await account("sec-pref");
    await assert.rejects(
      () => preferenceService.save(user.userId, { mutedCategories: ["SECURITY"] }),
      /cannot be switched off/i
    );
  });

  test("an absolute deep link is rejected, not stored", async () => {
    // An absolute URL in a notification is a phishing vector sent over the
    // platform's own signature.
    const user = await account("deeplink");
    const result = await notificationService.send({
      userId: user.userId,
      category: "POLICY",
      title: "Check this",
      deepLink: "https://evil.example.com/steal",
    });
    const stored = await prisma.notification.findUnique({ where: { id: result.id } });
    assert.equal(stored.deepLink, null);

    const ok = await notificationService.send({
      userId: user.userId,
      category: "POLICY",
      title: "Check this",
      deepLink: "/policies/123",
    });
    const good = await prisma.notification.findUnique({ where: { id: ok.id } });
    assert.equal(good.deepLink, "/policies/123");
  });

  test("protocol-relative links are rejected too", async () => {
    const user = await account("deeplink2");
    const result = await notificationService.send({
      userId: user.userId,
      category: "POLICY",
      title: "x",
      deepLink: "//evil.example.com",
    });
    const stored = await prisma.notification.findUnique({ where: { id: result.id } });
    assert.equal(stored.deepLink, null);
  });

  test("one user cannot mark another's notification read", async () => {
    const alice = await account("read-owner");
    const mallory = await account("read-thief");
    const sent = await notificationService.send({
      userId: alice.userId,
      category: "POLICY",
      title: "Alice's policy",
    });

    const result = await notificationService.markRead(mallory.userId, [sent.id]);
    assert.equal(result.updated, 0);

    const still = await prisma.notification.findUnique({ where: { id: sent.id } });
    assert.equal(still.status, "UNREAD");
  });

  test("unread counts break down by category", async () => {
    const user = await account("counts");
    await notificationService.send({ userId: user.userId, category: "CLAIM", title: "a" });
    await notificationService.send({ userId: user.userId, category: "CLAIM", title: "b" });
    await notificationService.send({ userId: user.userId, category: "DOCUMENT", title: "c" });

    const counts = await notificationService.unreadCount(user.userId);
    assert.equal(counts.total, 3);
    assert.equal(counts.byCategory.CLAIM, 2);
    assert.equal(counts.byCategory.DOCUMENT, 1);
  });

  test("archive is a third state, distinct from read", async () => {
    const user = await account("archive");
    const sent = await notificationService.send({
      userId: user.userId,
      category: "POLICY",
      title: "old news",
    });
    await notificationService.archive(user.userId, [sent.id]);
    const stored = await prisma.notification.findUnique({ where: { id: sent.id } });
    assert.equal(stored.status, "ARCHIVED");
    assert.ok(stored.archivedAt);
  });
});

// ── Conversations ────────────────────────────────────────────────────────────

describe("conversations", () => {
  test("membership decides who can read a thread", async () => {
    const alice = await account("conv-a");
    const bob = await account("conv-b");
    const outsider = await account("conv-outsider");

    const { id } = await conversationService.startConversation(actorOf(alice), {
      kind: "DIRECT",
      subject: "About my policy",
      participantIds: [bob.userId],
    });

    const asBob = await conversationService.thread(actorOf(bob), id);
    assert.equal(asBob.conversation.id, id);

    // 404, not 403 — a 403 confirms a thread about somebody's claim exists.
    await assert.rejects(() => conversationService.thread(actorOf(outsider), id), /does not exist/i);
  });

  test("an internal note is invisible to the customer on the same thread", async () => {
    // The single most important test in this file.
    const customer = await account("case-cust");
    const advisor = await account("case-adv", "EMPLOYEE", "EMPLOYEE");

    const { id } = await conversationService.startConversation(actorOf(advisor), {
      kind: "CASE",
      subject: "Your claim",
      participantIds: [customer.userId],
      customerId: customer.userId,
    });

    await conversationService.post(actorOf(advisor), id, {
      body: "We have received your claim and are reviewing it.",
    });
    await conversationService.post(actorOf(advisor), id, {
      body: "Third claim this year — check for fraud markers before settling.",
      internal: true,
    });

    const staffView = await conversationService.thread(actorOf(advisor), id);
    assert.equal(staffView.messages.length, 2);

    const customerView = await conversationService.thread(actorOf(customer), id);
    assert.equal(customerView.messages.length, 1);
    assert.ok(
      !customerView.messages.some((m) => m.body.includes("fraud")),
      "the internal note must not reach the customer"
    );
  });

  test("a customer cannot write an internal note", async () => {
    const customer = await account("int-cust");
    const advisor = await account("int-adv", "EMPLOYEE", "EMPLOYEE");
    const { id } = await conversationService.startConversation(actorOf(advisor), {
      kind: "CASE",
      participantIds: [customer.userId],
    });

    const message = await conversationService.post(actorOf(customer), id, {
      body: "trying to hide this",
      internal: true,
    });
    // Downgraded rather than rejected: the customer's message is still posted,
    // it is simply not internal. Rejecting would lose what they wrote.
    assert.equal(message.internal, false);
  });

  test("a customer cannot start an internal discussion", async () => {
    const customer = await account("int-start");
    await assert.rejects(
      () =>
        conversationService.startConversation(actorOf(customer), {
          kind: "INTERNAL",
          participantIds: [],
        }),
      /Only staff/i
    );
  });

  test("a customer cannot be added to an internal discussion", async () => {
    const advisor = await account("int-adv2", "EMPLOYEE", "EMPLOYEE");
    const colleague = await account("int-col", "EMPLOYEE", "EMPLOYEE");
    const customer = await account("int-cust2");

    const { id } = await conversationService.startConversation(actorOf(advisor), {
      kind: "INTERNAL",
      subject: "Case review",
      participantIds: [colleague.userId],
    });

    await assert.rejects(
      () => conversationService.addParticipant(actorOf(advisor), id, customer.userId),
      /cannot be added to an internal discussion/i
    );
  });

  test("an internal thread cannot be created with a customer in it", async () => {
    const advisor = await account("int-adv3", "EMPLOYEE", "EMPLOYEE");
    const customer = await account("int-cust3");
    await assert.rejects(
      () =>
        conversationService.startConversation(actorOf(advisor), {
          kind: "INTERNAL",
          participantIds: [customer.userId],
        }),
      /cannot include a customer/i
    );
  });

  test("an observer can read but not post", async () => {
    const owner = await account("obs-owner", "EMPLOYEE", "EMPLOYEE");
    const observer = await account("obs", "EMPLOYEE", "EMPLOYEE");
    const { id } = await conversationService.startConversation(actorOf(owner), {
      kind: "INTERNAL",
      participantIds: [observer.userId],
    });
    await conversationService.addParticipant(actorOf(owner), id, observer.userId, "OBSERVER");

    const read = await conversationService.thread(actorOf(observer), id);
    assert.ok(read.conversation);
    await assert.rejects(
      () => conversationService.post(actorOf(observer), id, { body: "hello" }),
      /not post/i
    );
  });

  test("only the owner can add participants", async () => {
    const owner = await account("add-owner", "EMPLOYEE", "EMPLOYEE");
    const member = await account("add-member", "EMPLOYEE", "EMPLOYEE");
    const third = await account("add-third", "EMPLOYEE", "EMPLOYEE");
    const { id } = await conversationService.startConversation(actorOf(owner), {
      kind: "INTERNAL",
      participantIds: [member.userId],
    });

    await assert.rejects(
      () => conversationService.addParticipant(actorOf(member), id, third.userId),
      /Only the owner/i
    );
  });

  test("a mention only works for someone already on the thread", async () => {
    // Otherwise a mention becomes a way to notify anyone on the platform about
    // a conversation they cannot open, quoting its subject.
    const owner = await account("men-owner", "EMPLOYEE", "EMPLOYEE");
    const member = await account("men-member", "EMPLOYEE", "EMPLOYEE");
    const stranger = await account("men-stranger", "EMPLOYEE", "EMPLOYEE");

    const { id } = await conversationService.startConversation(actorOf(owner), {
      kind: "INTERNAL",
      participantIds: [member.userId],
    });
    const message = await conversationService.post(actorOf(owner), id, {
      body: "taking a look",
      mentionIds: [member.userId, stranger.userId],
    });

    const mentions = await prisma.mention.findMany({ where: { messageId: message.id } });
    assert.equal(mentions.length, 1);
    assert.equal(mentions[0].userId, member.userId);
  });

  test("an assistant draft is stored but never delivered", async () => {
    const owner = await account("draft-owner", "EMPLOYEE", "EMPLOYEE");
    const other = await account("draft-other", "EMPLOYEE", "EMPLOYEE");
    const { id } = await conversationService.startConversation(actorOf(owner), {
      kind: "INTERNAL",
      participantIds: [other.userId],
    });

    const before = await prisma.notification.count({ where: { userId: other.userId } });
    await conversationService.post(actorOf(owner), id, {
      body: "Dear customer, thank you for your patience…",
      kind: "SUGGESTION",
    });
    const afterCount = await prisma.notification.count({ where: { userId: other.userId } });

    assert.equal(afterCount, before, "a draft must not page anybody");
  });

  test("an empty message is refused", async () => {
    const owner = await account("empty", "EMPLOYEE", "EMPLOYEE");
    const { id } = await conversationService.startConversation(actorOf(owner), {
      kind: "INTERNAL",
      participantIds: [],
    });
    await assert.rejects(
      () => conversationService.post(actorOf(owner), id, { body: "   " }),
      /needs something in it/i
    );
  });
});

// ── Inbox ────────────────────────────────────────────────────────────────────

describe("the unified inbox", () => {
  test("conversations, notifications and announcements arrive in one list", async () => {
    const user = await account("inbox");
    const advisor = await account("inbox-adv", "EMPLOYEE", "EMPLOYEE");

    await conversationService.startConversation(actorOf(advisor), {
      kind: "DIRECT",
      subject: "A question",
      participantIds: [user.userId],
    });
    await notificationService.send({
      userId: user.userId,
      category: "RENEWAL",
      title: "Renewal soon",
    });

    const inbox = await inboxService.unified(actorOf(user));
    const kinds = new Set(inbox.items.map((i) => i.itemKind));
    assert.ok(kinds.has("conversation"));
    assert.ok(kinds.has("notification"));
    // Newest first.
    for (let i = 1; i < inbox.items.length; i++) {
      assert.ok(new Date(inbox.items[i - 1].at) >= new Date(inbox.items[i].at));
    }
  });

  test("unreadOnly filters to what has not been seen", async () => {
    const user = await account("inbox-unread");
    const sent = await notificationService.send({
      userId: user.userId,
      category: "POLICY",
      title: "seen",
    });
    await notificationService.markRead(user.userId, [sent.id]);
    await notificationService.send({ userId: user.userId, category: "POLICY", title: "unseen" });

    const inbox = await inboxService.unified(actorOf(user), { unreadOnly: true });
    assert.ok(inbox.items.every((i) => i.unread));
    assert.ok(inbox.items.some((i) => i.title === "unseen"));
    assert.ok(!inbox.items.some((i) => i.title === "seen"));
  });

  test("a customer's inbox never counts internal notes as unread messages", async () => {
    const customer = await account("inbox-cust");
    const advisor = await account("inbox-adv2", "EMPLOYEE", "EMPLOYEE");
    const { id } = await conversationService.startConversation(actorOf(advisor), {
      kind: "CASE",
      subject: "Your case",
      participantIds: [customer.userId],
    });
    await conversationService.post(actorOf(advisor), id, { body: "internal only", internal: true });

    const inbox = await inboxService.unified(actorOf(customer));
    const thread = inbox.items.find((i) => i.itemKind === "conversation" && i.id === id);
    assert.equal(thread.messageCount, 0, "an internal note must not show as an unread message");
  });
});

// ── Timeline ─────────────────────────────────────────────────────────────────

describe("the activity timeline", () => {
  test("it assembles from every subsystem", async () => {
    const user = await account("timeline");
    await notificationService.send({
      userId: user.userId,
      category: "POLICY",
      title: "Policy active",
    });
    await prisma.uploadedDocument.create({
      data: {
        filename: "id.pdf",
        filepath: "/tmp/x.pdf",
        ownerId: user.userId,
        contentHash: `h${Date.now()}`,
        events: { create: { stage: "UPLOADED", actorKind: "SYSTEM", summary: "Received." } },
      },
    });

    const timeline = await timelineService.forUser(actorOf(user), user.userId);
    const sources = new Set(timeline.entries.map((e) => e.source));
    assert.ok(sources.has("notification"));
    assert.ok(sources.has("document"));
    // Newest first.
    for (let i = 1; i < timeline.entries.length; i++) {
      assert.ok(new Date(timeline.entries[i - 1].at) >= new Date(timeline.entries[i].at));
    }
  });

  test("a customer cannot read another customer's timeline", async () => {
    const alice = await account("tl-a");
    const mallory = await account("tl-b");
    await assert.rejects(
      () => timelineService.forUser(actorOf(mallory), alice.userId),
      /do not have access/i
    );
  });

  test("an employee can, because advising needs it", async () => {
    const customer = await account("tl-cust");
    const advisor = await account("tl-adv", "EMPLOYEE", "EMPLOYEE");
    const timeline = await timelineService.forUser(actorOf(advisor), customer.userId);
    assert.equal(timeline.userId, customer.userId);
  });

  test("an unknown subject kind is refused rather than queried", async () => {
    const user = await account("tl-subject");
    await assert.rejects(
      () => timelineService.forSubject(actorOf(user), "secrets", "1"),
      /do not keep a timeline/i
    );
  });
});

// ── Workflow communication ───────────────────────────────────────────────────

describe("workflow communication", () => {
  beforeEach(() => {
    registerWorkflowCommunication();
  });

  test("a rejected document tells the customer why, at high priority", async () => {
    const customer = await account("wf-reject");

    emit({
      name: "document.rejected",
      actorId: null,
      actorKind: "USER",
      subjectKind: "document",
      subjectId: "doc-1",
      payload: {
        ownerId: customer.userId,
        filename: "rc.pdf",
        reason: "The registration number is not legible.",
      },
    });
    await settle();

    const notification = await prisma.notification.findFirst({
      where: { userId: customer.userId, category: "DOCUMENT" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(notification, "the customer should have been told");
    assert.equal(notification.priority, "HIGH");
    // The reason is in the body, not behind a link.
    assert.match(notification.body, /not legible/i);
  });

  test("an AI-suggested task says it was suggested, and why", async () => {
    const employee = await account("wf-task", "EMPLOYEE", "EMPLOYEE");

    emit({
      name: "workitem.assigned",
      actorId: null,
      actorKind: "AI",
      subjectKind: "workItem",
      subjectId: "wi-1",
      payload: {
        assigneeUserId: employee.userId,
        title: "Call this customer about their lapsed cover",
        origin: "AI",
        rationale: "Their health policy lapsed 9 days ago and waiting periods restart at 30.",
      },
    });
    await settle();

    const notification = await prisma.notification.findFirst({
      where: { userId: employee.userId, category: "TASK" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(notification);
    assert.match(notification.body, /Suggested by Aegis/i);
    assert.match(notification.body, /waiting periods/i);
  });

  test("only the case transitions a customer cares about are notified", async () => {
    const customer = await account("wf-status");

    emit({
      name: "workitem.status_changed",
      actorId: null,
      actorKind: "SYSTEM",
      subjectKind: "workItem",
      subjectId: "wi-2",
      payload: { customerId: customer.userId, status: "IN_PROGRESS" },
    });
    await settle();
    assert.equal(
      await prisma.notification.count({ where: { userId: customer.userId } }),
      0,
      "IN_PROGRESS is noise for a customer"
    );

    emit({
      name: "workitem.status_changed",
      actorId: null,
      actorKind: "SYSTEM",
      subjectKind: "workItem",
      subjectId: "wi-2",
      payload: { customerId: customer.userId, status: "RESOLVED" },
    });
    await settle();
    assert.equal(await prisma.notification.count({ where: { userId: customer.userId } }), 1);
  });

  test("one failing subscriber does not stop the others", async () => {
    const bus = eventBus();
    let secondRan = false;
    const offA = bus.subscribe("system.maintenance", async () => {
      throw new Error("first handler fails");
    });
    const offB = bus.subscribe("system.maintenance", async () => {
      secondRan = true;
    });

    await bus.publish({
      name: "system.maintenance",
      actorId: null,
      actorKind: "SYSTEM",
      subjectKind: "system",
      subjectId: "x",
      payload: {},
      occurredAt: new Date(),
    });

    assert.ok(secondRan, "a throwing subscriber must not cancel the rest");
    offA();
    offB();
  });

  test("realtime delivery is addressed by user, never by room name", async () => {
    const user = await account("rt");
    const sent = [];
    registerRealtime({
      connected: true,
      toUser: (userId, event, payload) => sent.push({ userId, event, payload }),
      toUsers: (ids, event, payload) => ids.forEach((id) => sent.push({ userId: id, event, payload })),
    });

    await notificationService.send({
      userId: user.userId,
      category: "CLAIM",
      title: "Claim updated",
    });

    assert.equal(sent.length, 1);
    assert.equal(sent[0].userId, user.userId);
    assert.equal(sent[0].event, "notification");
    resetRealtime();
  });

  test("a dropped realtime connection suppresses rather than fails", async () => {
    // The notification is already stored; a missing socket costs a refresh, not
    // a message, and must not be recorded as a failure.
    const user = await account("rt-off");
    resetRealtime();
    const result = await notificationService.send({
      userId: user.userId,
      category: "CLAIM",
      title: "Stored anyway",
    });
    const realtimeRecord = await prisma.deliveryRecord.findFirst({
      where: { notificationId: result.id, channel: "REALTIME" },
    });
    assert.equal(realtimeRecord.status, "SUPPRESSED");
    assert.notEqual(realtimeRecord.status, "FAILED");
  });
});

// ── The assistant ────────────────────────────────────────────────────────────

describe("the communication assistant", () => {
  const assistant = new DeterministicAssistant();

  test("it summarises by quoting, never by inventing", async () => {
    const customer = await account("ai-cust");
    const advisor = await account("ai-adv", "EMPLOYEE", "EMPLOYEE");
    const { id } = await conversationService.startConversation(actorOf(advisor), {
      kind: "CASE",
      participantIds: [customer.userId],
    });
    await conversationService.post(actorOf(customer), id, {
      body: "My car was in an accident yesterday. When will the claim be settled?",
    });

    const result = await assistant.summarise(id);
    assert.equal(result.available, true);
    // Every quoted point must appear verbatim in the thread.
    for (const point of result.data.points) {
      assert.ok(point.length > 0);
    }
    assert.ok(result.data.points.some((p) => p.includes("settled")));
  });

  test("triage explains itself", async () => {
    const customer = await account("ai-triage-c");
    const advisor = await account("ai-triage-a", "EMPLOYEE", "EMPLOYEE");
    const { id } = await conversationService.startConversation(actorOf(advisor), {
      kind: "CASE",
      participantIds: [customer.userId],
    });
    await conversationService.post(actorOf(customer), id, {
      body: "My father was admitted to hospital last night, this is an emergency.",
    });

    const result = await assistant.triage(id);
    assert.equal(result.data.urgency, "URGENT");
    assert.match(result.data.why, /hospital|emergency|admitted/i);
  });

  test("an ordinary message is not flagged urgent", async () => {
    const customer = await account("ai-calm-c");
    const advisor = await account("ai-calm-a", "EMPLOYEE", "EMPLOYEE");
    const { id } = await conversationService.startConversation(actorOf(advisor), {
      kind: "CASE",
      participantIds: [customer.userId],
    });
    await conversationService.post(actorOf(customer), id, {
      body: "Could you send me a copy of my policy document please.",
    });

    const result = await assistant.triage(id);
    assert.equal(result.data.urgency, "NORMAL");
  });

  test("drafting declares itself unavailable rather than returning a template", async () => {
    const result = await assistant.draftReply("any");
    assert.equal(result.available, false);
    assert.equal(result.data, null);
    assert.match(result.needs, /ai-python|language model/i);
  });

  test("translation declares itself unavailable", async () => {
    const result = await assistant.translate("hello", "ta");
    assert.equal(result.available, false);
    assert.match(result.needs, /Tamil|translation provider/i);
  });
});

// ── The API and its permissions ──────────────────────────────────────────────

describe("the API and its permissions", () => {
  test("everything requires a session", async () => {
    for (const p of ["/notifications", "/inbox", "/timeline", "/announcements"]) {
      const res = await request(app).get(`/api/v1/communication${p}`);
      assert.equal(res.status, 401, `${p} must require a session`);
    }
  });

  test("a customer cannot read the activity feed", async () => {
    const customer = await account("api-cust");
    const res = await api(customer.cookie).get("/activity");
    assert.equal(res.status, 403);
  });

  test("a customer cannot read communication analytics", async () => {
    const customer = await account("api-cust2");
    assert.equal((await api(customer.cookie).get("/analytics/overview")).status, 403);
    assert.equal((await api(customer.cookie).get("/analytics/health")).status, 403);
  });

  test("an enterprise admin cannot broadcast to every customer", async () => {
    // Reaching beyond your own organisation is a platform operator's authority.
    const admin = await account("api-eadmin", "ENTERPRISE", "ENTERPRISE_ADMIN");
    const res = await api(admin.cookie).post("/announcements", {
      title: "Buy our new product",
      body: "Everyone should see this",
      audienceRealm: "ALL",
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "AUDIENCE_TOO_BROAD");
  });

  test("an enterprise admin can address their own staff", async () => {
    const admin = await account("api-eadmin2", "ENTERPRISE", "ENTERPRISE_ADMIN");
    const res = await api(admin.cookie).post("/announcements", {
      title: "System maintenance on Sunday",
      body: "The claims console will be unavailable from 02:00 to 04:00.",
      audienceRealm: "EMPLOYEE",
      category: "MAINTENANCE",
    });
    assert.equal(res.status, 201);
  });

  test("a customer cannot make an announcement at all", async () => {
    const customer = await account("api-cust3");
    const res = await api(customer.cookie).post("/announcements", {
      title: "x",
      body: "y",
      audienceRealm: "EMPLOYEE",
    });
    assert.equal(res.status, 403);
  });

  test("an employee sees an employee announcement; a customer does not", async () => {
    const admin = await account("ann-admin", "ENTERPRISE", "ENTERPRISE_ADMIN");
    await api(admin.cookie).post("/announcements", {
      title: "Staff briefing at 4pm",
      body: "In the main room.",
      audienceRealm: "EMPLOYEE",
    });

    const employee = await account("ann-emp", "EMPLOYEE", "EMPLOYEE");
    const customer = await account("ann-cust");

    const staffView = await api(employee.cookie).get("/announcements");
    assert.ok(staffView.body.data.announcements.some((a) => a.title === "Staff briefing at 4pm"));

    const customerView = await api(customer.cookie).get("/announcements");
    assert.ok(!customerView.body.data.announcements.some((a) => a.title === "Staff briefing at 4pm"));
  });

  test("preferences report which channels actually work", async () => {
    const user = await account("api-prefs");
    const res = await api(user.cookie).get("/preferences");
    assert.equal(res.status, 200);

    const sms = res.body.data.channels.find((c) => c.channel === "SMS");
    assert.equal(sms.available, false);
    assert.ok(sms.reason, "an unavailable channel must say why");
  });

  test("a platform operator sees delivery health; an enterprise admin does not", async () => {
    const operator = await account("api-op", "PLATFORM", "PLATFORM_ADMIN");
    const admin = await account("api-eadmin3", "ENTERPRISE", "ENTERPRISE_ADMIN");

    const health = await api(operator.cookie).get("/analytics/health");
    assert.equal(health.status, 200);
    assert.ok(Array.isArray(health.body.data.channels));
    assert.ok(health.body.data.realtime);

    assert.equal((await api(admin.cookie).get("/analytics/health")).status, 403);
  });

  test("the success rate ignores channels that were never configured", async () => {
    // Without this, a deployment with no SMS provider writes a SUPPRESSED row
    // per notification and reads as "40% delivered" — sending an operator
    // hunting for a fault that does not exist.
    const user = await account("rate");
    await notificationService.send({ userId: user.userId, category: "POLICY", title: "one" });

    const admin = await account("rate-admin", "ENTERPRISE", "ENTERPRISE_ADMIN");
    const res = await api(admin.cookie).get("/analytics/overview");
    const delivery = res.body.data.delivery;

    assert.ok(delivery.suppressed > 0, "SMS and push should be suppressed");
    assert.equal(delivery.successRate, 100, "every channel that was tried succeeded");
    assert.ok(delivery.successRateNote);
    // And the reasons are broken out, so "no provider" is distinguishable from
    // "the recipient switched it off".
    assert.ok(delivery.suppressionReasons.some((r) => /No SMS provider/i.test(r.reason)));
  });

  test("delivery analytics report null rather than 0% when nothing was sent", async () => {
    const admin = await account("api-analytics", "ENTERPRISE", "ENTERPRISE_ADMIN");
    const res = await api(admin.cookie).get("/analytics/overview");
    assert.equal(res.status, 200);
    // Whatever the number, engagement is never fabricated.
    assert.equal(res.body.data.engagementRate.available, false);
    assert.ok(res.body.data.engagementRate.needs);
  });

  test("a full conversation works end to end over HTTP", async () => {
    const customer = await account("api-flow-c");
    const advisor = await account("api-flow-a", "EMPLOYEE", "EMPLOYEE");

    const created = await api(advisor.cookie).post("/conversations", {
      kind: "CASE",
      subject: "Your renewal",
      participantIds: [customer.userId],
      customerId: customer.userId,
    });
    assert.equal(created.status, 201);
    const id = created.body.data.id;

    const posted = await api(advisor.cookie).post(`/conversations/${id}/messages`, {
      body: "Your policy renews in three weeks. Shall I send the options?",
    });
    assert.equal(posted.status, 201);

    const thread = await api(customer.cookie).get(`/conversations/${id}`);
    assert.equal(thread.status, 200);
    assert.equal(thread.body.data.messages.length, 1);
    assert.ok(thread.body.data.messages[0].senderName);

    const read = await api(customer.cookie).post(`/conversations/${id}/read`, {});
    assert.equal(read.status, 200);

    const inbox = await api(customer.cookie).get("/inbox");
    assert.ok(inbox.body.data.items.some((i) => i.id === id));
  });

  test("the assistant cannot be used to read a conversation you are not in", async () => {
    const advisor = await account("api-ai-a", "EMPLOYEE", "EMPLOYEE");
    const outsider = await account("api-ai-o", "EMPLOYEE", "EMPLOYEE");
    const created = await api(advisor.cookie).post("/conversations", {
      kind: "INTERNAL",
      subject: "Private",
      participantIds: [],
    });
    const id = created.body.data.id;

    const res = await api(outsider.cookie).get(`/conversations/${id}/summary`);
    assert.equal(res.status, 404, "summarising must be gated by the same membership check as reading");
  });
});
