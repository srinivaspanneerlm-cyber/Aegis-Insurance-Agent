# Demo Runbook — LT HackFest 2026

Everything needed to run the live demo, and everything needed when the live
demo fails. Written to be followed literally at 3am on no sleep.

**Related:** [README.md](README.md) · [ARCHITECTURE.md](ARCHITECTURE.md) ·
[AI_AGENTS.md](AI_AGENTS.md)

---

## 1. Pre-flight — T minus 30 minutes

Run these in order. Every one has a pass condition; do not move on without it.

| # | Command | Pass condition |
|---|---|---|
| 1 | `./scripts/dev.sh start` | `AI engine`, `Backend`, `Frontend` all report up |
| 2 | `grep -i "provider chain" ${TMPDIR:-/tmp}/aegis-dev-logs/ai.log \| tail -1` | `ollama → gemini` — **not** `ollama only` |
| 3 | `node backend/prisma/seed-demo.js` | 4 held policies, 4 documents, 4 notifications |
| 3b | `./scripts/reset-demo-memory.sh` | **After every rehearsal.** Otherwise the advisor opens the real demo mid-conversation, with a profile from your practice run. |
| 4 | Sign in at http://localhost:3000/login as `demo@aegisdemo.in` | Dashboard loads with 4 policies visible |
| 5 | Ask the advisor any throwaway question | **A reply comes back** — see §2 |
| 6 | Open the backup video in a player, paused on frame 1 | It plays with sound |
| 7 | `free -h` | **At least 4 GB available.** See §2b — this is what killed the engine twice during preparation. |
| 8 | Sign out and sign in again, once, the day of | A session older than a password change cannot renew — see §1b |

### §2 — Why step 5 is not optional

The first advisor turn after a restart takes **~21 seconds**: the knowledge
retrieval index is built on the first request, not at boot. Every turn after
that is **5–7 seconds**.

`dev.sh` warms the frontend routes but cannot warm the AI engine, because
warming it means asking a real question. So ask one. If the first question a
judge sees is also the first question the engine has ever seen, they watch a
spinner for twenty seconds and form their opinion during it.

---

### §1b — "Please sign in to continue" in the middle of a conversation

The access token lasts **10 minutes**. That is deliberate and it is not a
demo risk: the browser holds an httpOnly refresh cookie, and on any 401 it
trades that cookie for a new token without the customer noticing. Verified
end to end — refresh returns a fresh 10-minute token, and the renewed session
goes straight back to talking to the advisor.

What breaks it is a session that predates a password change or a sign-out
everywhere: those revoke the refresh tokens, so there is nothing left to renew
with, and the next 401 becomes "Please sign in to continue this conversation."
That is the auth layer behaving correctly, not a bug.

So: **sign out and sign in once on demo day**, before anything else. Any tab
still open from before is carrying a credential that may no longer renew.

### §2b — Close the browser tabs before you start

This machine has **15 GB of RAM and no swap**. During preparation the AI engine
was killed outright twice — not slow, not erroring: the process gone — while
Brave held roughly 4 GB across six renderer processes and Next.js was
compiling. With no swap there is nothing to page out, so the kernel picks the
fattest process, and a Python service holding an ML stack is exactly that.

The LLM fallback cannot help here. It answers when a *provider* fails; it
cannot answer when the engine that would have called it is not running.

Before the demo:

- Close every browser tab except the four you need. Each renderer is 500–850 MB.
- Quit anything else large — editors with big projects open, other dev servers.
- Check `free -h`. Below ~4 GB available, close more before you start.

If the advisor stops answering entirely (connection refused, not just slow),
the engine has died. One command brings it back — expect ~20 seconds, and the
first turn after it is cold again:

```bash
cd ai-python && source venv/bin/activate && nohup python main.py \
  > ${TMPDIR:-/tmp}/aegis-dev-logs/ai.log 2>&1 &
```

---

## 2. The 90-second demo

Five minutes total means the demo gets 90 seconds. Every click below is decided
in advance. Never type a long sentence live — a typo costs ten seconds and the
thread of what you were saying.

**Open before you start:** dashboard tab (already signed in), advisor tab,
backup video paused in a player, GitHub Actions tab showing green CI.

**Open before you start:** dashboard tab (already signed in), advisor tab,
backup video paused in a player, GitHub Actions tab showing green CI.

### The dashboard half — 30 seconds

| Do | Say |
|---|---|
| Dashboard, already signed in | "Real auth, real database. I signed in earlier to save us the time." |
| Point at the **lapsed** parents' policy | "This family's parents' health cover lapsed 38 days ago. Nobody told them. That is the entire problem we exist for." |
| Point at the car policy renewing in 9 days | "And this one renews in nine days, with a 35% no-claim bonus attached to it." |

### The conversation half — 60 seconds

Type these in order. The consultation now runs the full discovery before it
will show anything, so this half is longer than it was — budget closer to 90
seconds, and expect roughly 4–10s per LLM turn.

> **Timings not re-measured.** The per-line timings in the previous version of
> this table were taken from live rehearsal runs of the old five-step flow.
> The advisor now asks eight questions and passes two consent gates before a
> plan exists, so those numbers no longer describe this script. Rehearse it
> once against the live system and write the real timings back in here before
> presenting.

| # | Type exactly | What comes back | Say while it thinks |
|---|---|---|---|
| 1 | `enakku family health insurance venum, budget 15k` | Sarah AI / health. Asks who the cover is for. **No plans.** | "I did not pick an agent and I did not type English. The orchestrator read Thanglish, decided this was health, and handed it to Sarah." |
| 2 | `enna plan best-nu sollunga` | Declines to name one, and asks the next question instead. | "This is the whole product. It will not recommend anything until it knows enough to recommend the right thing. A tool that answers that question now is guessing." |
| 3 | `naan, wife, oru kozhandhai` | Asks how many in total. | "A sentence, not a form. That is how people actually answer." |
| 4 | `3 per, naan 32 vayasu wife 30 kid 5` | Confirms the ages, asks what worries them most. | — |
| 5 | `hospital bill romba adhigam aidum-nu bayam` | Asks what cover they already have. | "It is asking what they are afraid of, not just what they earn. That answer changes which plan wins." |
| 6 | `office-la basic coverage irukku` | Asks the city. | — |
| 7 | `Coimbatore` | Asks about medical conditions. | — |
| 8 | `medical problem illa` | **Reads the whole profile back** and asks if it got it right. Still no plans. | "It is checking its own understanding before it acts on it." |
| 9 | `aama, correct` | Says one plan fits, and **asks permission** to show why. Still no plans. | "It has picked one. It is asking before it shows me." |
| 10 | `seri, kaatunga` | **The card** — one plan, with cover, premium, and why it won. | "One recommendation, with its reasons — not a shortlist handed back for me to choose from. The engine scored the catalogue; the advisor explains the result." |
| 11 | `vera option irukka?` | Offers the next-best option and asks — does not dump the rest. | "Even the alternatives are asked for, never pushed." |
| 12 | `car insurance-um venuma?` | **~0.4s** — consent prompt: progress saved, shall I connect you to Alex? | "Now the part that is hard to copy. Different domain — and it does not switch on me. It asks." |
| 13 | `illa, health insurance pathi pesalaam` | Sarah returns **and recites the whole profile**: 3 people, the ages, ₹15,000, Coimbatore, no conditions. | "One memory. It never lost the customer while it was asking about a different product." |

**If you do accept the transfer at step 12**, Alex runs the same consultation
Sarah does — his own discovery, his own read-back, his own permission request,
then one plan. Motor, travel and home all work this way; the flow is the
product, not one advisor's script. It is a good thing to show if you have the
time, and a long detour if you do not.

### Three things to make sure they see

1. **Step 2 — the refusal to guess.** The judge's instinct is that an AI
   advisor answers instantly. This one says it does not know enough yet, and
   that is the differentiator.
2. **Step 12 — the consent prompt.** The most reliable moment: it needs no LLM
   call, so it lands in under half a second even on bad wifi. Ran three times
   in rehearsal, worked three times.
3. **Step 13 — the profile recited back.** This is the "it remembers me"
   moment, and it is stronger than saying so.

### If you are short on time

Steps 3–7 are the discovery, and they are the least surprising part. You can
answer them quickly and keep the narration for steps 2, 8, 9 and 10 — the
refusal, the read-back, the permission, and the single recommendation.

### Lines that break the demo — tested, do not use

| Never type | What actually happens |
|---|---|
| `vanakkam` or any greeting first | Opens in the **Executive** agent instead of a specialist. Every following answer then gets a "shall I connect you to Sarah?" prompt instead of an answer, and one turn took **38 seconds**. The first message decides the domain — open with the need. |
| `Coimbatore la irukkom, medical problem edhuvum illa` (city and medical together) | Misrouted to **Ethan / travel**. Send the city and the medical answer as two separate messages. |
| `en family details ninaivu irukka?` | Misrouted to **travel** twice out of two. Use line 7 above instead — it proves the same thing and comes back to Sarah. |

### When it wanders — and it will

The advisor is LLM-driven, so the same script does not produce identical
replies. In rehearsal it sometimes re-asked a question it had already been
answered. **This is not a failure; do not fight it.**

- It re-asks something → answer it again, plainly. Keep talking to the room.
- It drifts to the wrong agent → type `illa, health insurance pathi pesalaam`.
  That pulled it back to Sarah every time, profile intact.
- It will not produce the card → say "the recommendation engine is in the
  recorded run" and move to step 6. The transfer moment does not depend on it.

Budget roughly **45–50 seconds of waiting** across the seven lines. That is
what the narration column is for — never watch the spinner in silence.

---

## 3. Recording the backup video

Do this **today**, not on demo morning. `ffmpeg` is already installed and
verified on this machine (X11, 1920×1080).

### Screen only

```bash
ffmpeg -y -f x11grab -framerate 30 -i :0.0 \
  -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
  ~/aegis-demo-backup.mp4
```

### Screen + your narration

```bash
# List input devices first, and use the one that is your microphone:
#   arecord -l
ffmpeg -y -f x11grab -framerate 30 -i :0.0 \
  -f pulse -i default \
  -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  ~/aegis-demo-backup.mp4
```

Stop recording with `q` in that terminal (**not** Ctrl-C — `q` finalises the
file, Ctrl-C can leave it unplayable).

### Rules for the take

1. Run the §1 pre-flight first. Record a **warm** system, never a cold one.
2. Record the §2 script exactly. Same words, same order.
3. Do it in 2–3 takes and keep the best. Do not edit — an unedited run is
   evidence, an edited one invites "what was cut?"
4. Watch it back once, all the way through, with sound.
5. Keep it **local**. Never a cloud link — the venue's wifi is exactly what
   this file exists to survive.
6. Copy it to a USB stick as well as the laptop.

### Verify the file before you trust it

```bash
ffprobe -v error -show_entries format=duration,size \
        -of default=noprint_wrappers=1 ~/aegis-demo-backup.mp4
```

Duration should be roughly your script length and size should be tens of MB. A
few kilobytes means the recording failed.

---

## 4. When the live demo fails

**The rule: 15 seconds.** If a screen has not responded in fifteen seconds,
switch to the video. Do not debug in front of judges. Do not say "it usually
works". Say this:

> "The network is not cooperating — I have a recorded run of exactly this,
> let me play it."

Then play it. Judges read a prepared fallback as professional. They read two
minutes of silent clicking as unfinished work.

### Specific failures and the response

| Symptom | What it is | Do |
|---|---|---|
| Advisor silent > 20s | Primary LLM provider unreachable | Nothing — the fallback answers on its own. Keep talking. |
| Advisor errors repeatedly | Both providers failed | Switch to the video. |
| Connection refused / nothing responds | The AI engine was killed — memory | §2b has the restart command. If judges are watching, play the video first and restart while it runs. |
| It answers the wrong thing, or asks again | Normal — the advisor is LLM-driven | Answer again, or use the recovery line in §2. Do not restart anything. |
| Dashboard empty | Wrong account, or seed not run | `node backend/prisma/seed-demo.js`, refresh. |
| A page will not load | Next route not compiled | Video. Do not restart anything mid-demo. |

---

## 5. Questions they will ask

| Question | Answer |
|---|---|
| "Isn't this a ChatGPT wrapper?" | "A wrapper has no memory, no routing, no domain knowledge. This has five layers, per-domain memory namespaces, and consent-based transfer. I can switch the entire LLM provider and the product still works — that is the proof." |
| "Did you build this yourself?" | Open the repo: git log, the test suite, green CI. "The test suite is the honest version of my résumé." |
| "What's the business model?" | Slide 9 — pilot, then regional, then multi-tenant. Say plainly: no customers, no revenue yet. |
| "What doesn't work?" | Answer before they ask — see below. |

### Say this before they find it

- Payment integration is not built. Purchase is a roadmap step.
- OCR document verification is next, not shipped. Documents are stored, not read.
- Nova (claims and fraud) is in build.
- No enterprise customer, no revenue, no deployment at an insurer.

Volunteering the gaps is what makes the rest of the numbers believable.

---

## 6. Known operational facts

- **First advisor turn ~21s, subsequent turns 5–7s.** Warm it. See §2.
- **Agent transfer is instant (~0.1s)** — it needs no LLM call. It will always
  look fast, even on bad wifi.
- **The LLM provider falls back automatically.** If the primary fails, the same
  turn is answered by the fallback with the same history. Nothing is visible to
  the customer; the log line reads `Turn answered by fallback provider`.
- **The Gemini free tier is small.** Check quota the morning of the demo by
  asking the advisor one question and confirming a reply.
- Demo data is seeded by `backend/prisma/seed-demo.js`. It deletes nothing and
  is safe to re-run.
- The demo account is `demo@aegisdemo.in` (role CUSTOMER). Its password is
  deliberately **not** written here — this file is in a public repository, and
  a credential in it would be found by anyone reading the pitch. Keep it
  wherever you keep the rest of them.
- The password-reset email is not delivered in this environment:
  `AUTH_MAIL_WEBHOOK_URL` points at a relay that is not running, and the
  console fallback only prints the link when no webhook is configured at all.
  Reset tokens are stored hashed, so a lost password is reset by re-issuing,
  not by reading one out of the database.
