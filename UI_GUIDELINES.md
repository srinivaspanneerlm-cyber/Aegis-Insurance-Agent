# UI_GUIDELINES.md — Aegis AI Design System

> The visual language, interaction patterns, and accessibility standards for
> the Aegis AI frontend. Every design decision connects to the platform mission:
> **educate, guide, and protect** users who are often first-time buyers, seniors,
> rural users, or Tamil / Thanglish / English speakers.
>
> **See also:** [README.md §1](README.md) · [ARCHITECTURE.md §2](ARCHITECTURE.md) ·
> [PROJECT_RULES.md §4](PROJECT_RULES.md) · [CLAUDE.md §4](CLAUDE.md)

---

## 1. Color System

The palette is sourced directly from `frontend/tailwind.config.ts` and
`frontend/src/app/globals.css`. The primary aesthetic is a **dark navy / deep
slate base with cyan and royal-blue accents** — evoking trust, precision, and
a premium fintech feel.

### 1.1 Core Palette

| Token | Hex | Use |
|---|---|---|
| `navy-950` | `#0b0f19` | Deepest background; scrollbar track |
| `navy-900` | `#0f172a` | Dark card background; primary dark surface |
| `navy-800` | `#1d2946` | Elevated card on dark |
| `navy-700` | `#273a62` | Secondary container on dark |
| `royal-500` | `#2563eb` | Primary action, links (light mode) |
| `royal-600` | `#1d4ed8` | Hover state for primary actions |
| `cyan-400` | `#22d3ee` | Accent / highlight / streaming cursor (dark mode) |
| `cyan-500` | `#06b6d4` | Primary accent (dark mode) — waveform, glows, borders |
| `cyan-600` | `#0891b2` | Hover for cyan elements |

### 1.2 Domain Accent Colors

Each insurance domain has its own accent for the VoiceEngine waveform, agent
card borders, and recommendation card gradients (from `VoiceEngine.tsx` and
`AIChatMessage.tsx`):

| Domain | Color | Tailwind class |
|---|---|---|
| Health (Sarah) | Emerald | `bg-emerald-400`, `border-emerald-500/50` |
| Motor (Alex) | Blue | `bg-blue-400`, `border-blue-500/50` |
| Travel (Ethan) | Violet | `bg-violet-400`, `border-violet-500/50` |
| Home / Property (Emma) | Amber | `bg-amber-400`, `border-amber-500/50` |
| Miscellaneous | Rose | `bg-rose-400`, `border-rose-500/50` |
| Executive | Rose | `bg-rose-400`, `border-rose-500/50` |

### 1.3 Semantic Colors

| Semantic | Color | Usage |
|---|---|---|
| Success / positive | `text-emerald-400` / `bg-emerald-500/10` | Executive approval, low risk, check items |
| Warning | `text-amber-400` / `bg-amber-500/10` | Medium risk tier |
| Error / danger | `text-rose-400` / `bg-rose-500/10` | High risk, critical, error states |
| Inactive / muted | `text-slate-500` / `text-slate-400` | Timestamps, secondary labels |
| Foreground dark | `text-slate-300` / `text-slate-200` | Body text on dark backgrounds |
| Foreground light | `text-slate-700` / `text-slate-600` | Body text on light backgrounds |

### 1.4 Gradient Texts (globals.css utility classes)

| Class | Gradient | Use case |
|---|---|---|
| `.gradient-text-indigo` | indigo → blue → cyan | Primary headings, domain labels |
| `.gradient-text-gold` | amber → dark amber | Premium/financial highlights |
| `.gradient-text-emerald` | emerald → teal | Success, health, approval |
| `.gradient-text-rose` | rose → red | Alerts, high-risk labels |

---

## 2. Dark Mode

Dark mode is the **default** for Aegis AI. It is managed by `ThemeContext`
(`frontend/src/context/ThemeContext.tsx`).

- **Persistence key:** `aegis_theme` in `localStorage` (`"dark"` | `"light"`)
- **Default:** `"dark"` — applied even before localStorage is read on first visit
- **Toggle:** adds/removes `dark` and `light` classes on `document.documentElement`
- **Hydration safety:** `ThemeProvider` hides children (`visibility: hidden`)
  until mounted to prevent a flash of wrong theme

**Implementation rule:** always provide both dark and light variants in a single
Tailwind expression:

```tsx
// Always dual-branch:
className={isDark ? "bg-slate-900/60 text-slate-300" : "bg-white text-slate-700"}
```

**Never** use a single-branch conditional for color — it produces an invisible
or broken UI in one mode.

---

## 3. Typography

| Level | Element | Tailwind | Notes |
|---|---|---|---|
| Display / Hero | `h1` | `text-4xl sm:text-6xl font-black` | Landing page only |
| Section heading | `h2` | `text-2xl font-black` | |
| Sub-heading | `h3` | `text-lg font-bold` | |
| First line of chat message | `p` | `text-xs sm:text-[13px] font-bold` | Slightly larger greeting line |
| Chat body text | `p` | `text-xs leading-relaxed` | Core readability |
| Bold inline | `strong` | `font-extrabold` | Wrapped in `**...**` by agents |
| Labels / metadata | `p` | `text-[10px] font-black uppercase tracking-wider` | Agent name, badges |
| Timestamps | `p` | `text-[9.5px]` | Muted, non-distracting |
| Plan metrics | `p` | `text-[8px] uppercase font-black` | Compact metric labels on cards |
| Monospace values | `p` | `font-mono font-black` | Premiums, coverage amounts, ratios |

**Font stack:** Inter → system-ui → sans-serif (from `--font-sans` CSS variable
and `tailwind.config.ts`).

**Sizing rationale:** small base sizes (`text-xs` = 12px) allow dense information
on the advisor screen without overflow. The first line of each AI message uses
`text-[13px]` so it reads as a friendly greeting opener.

---

## 4. Spacing & Layout

- **Grid unit:** 4 px (Tailwind default). Use multiples: `p-3` (12px), `p-4`
  (16px), `p-5` (20px), `p-6` (24px).
- **Card radius:** `rounded-[28px]` for holographic recommendation cards;
  `rounded-3xl` for chat message bubbles; `rounded-2xl` for option buttons and
  metric grids; `rounded-xl` for number badges.
- **Chat message max-width:** `max-w-lg` on recommendation cards to prevent
  line-length fatigue on wide screens.
- **Component spacing:** `space-y-3` inside message content; `space-y-2.5` for
  action button groups; `gap-3` / `gap-4` in metric grids.
- **Touch targets:** action buttons have `py-3 px-4` minimum, which meets the
  44 px height requirement for mobile tap accuracy.

---

## 5. Cards

### 5.1 Glassmorphism Cards (globals.css utility classes)

| Class | Use case | Background |
|---|---|---|
| `.glass-card-premium` | Light mode elevated card | `rgba(255,255,255,0.45)` + `backdrop-filter: blur(16px)` |
| `.glass-card-dark-premium` | Dark mode elevated card | `rgba(11,15,25,0.7)` + `backdrop-filter: blur(20px)` |
| `.glass-navbar` | Light mode nav bar | `rgba(255,255,255,0.75)` |
| `.glass-navbar-dark` | Dark mode nav bar | `rgba(11,15,25,0.85)` |

### 5.2 Holographic Recommendation Card

The `RecommendationCard` sub-component of `AIChatMessage.tsx` renders a full
plan recommendation with:

- Domain-coloured gradient border and shadow (`cardBorder`, `cardShadow`)
- Shimmer overlay (`bg-gradient-to-r from-transparent via-white/[0.04]`)
- Header badge with `CategoryIcon` and domain label gradient text
- Pricing grid (plan name left, premium + coverage right)
- Core metrics row: Claim Ratio, Risk Tier, Confidence — in a dark inner card
- Domain-specific metrics section (IDV for motor; medical limits for travel;
  structure/contents for property)
- Executive Approval block when `executiveApproval` is present
- Benefits checklist
- Three action buttons: `View Details`, `Compare Plan`, `Select Plan & Proceed`

**Glow-border hover effect:** `.glow-border-hover` adds a cyan/blue box-shadow
on hover with 0.3 s ease transition.

---

## 6. Buttons

| Variant | Tailwind pattern | Use case |
|---|---|---|
| Primary gradient | `bg-gradient-to-r from-{domain} text-slate-950 font-black rounded-2xl` | `Select Plan & Proceed` — highest intent |
| Secondary ghost | `border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200` | `View Details`, `Compare Plan` |
| Option button | `bg-slate-950/40 border-white/5 hover:border-cyan-500/35` | Numbered choice buttons in chat |
| Danger | `text-rose-400 bg-rose-500/10 border-rose-500/20` | Destructive actions |

**Interaction feedback (all buttons):**
- `active:scale-95` — physical press feedback
- `touch-manipulation` — disables 300 ms mobile tap delay
- `select-none` — prevents accidental text selection on tap
- `transition-all duration-200` — smooth hover/active transitions
- `cursor-pointer` — explicit pointer on non-`<button>` clickable elements

---

## 7. Forms & Inputs

- Label above input, always (`<label>` element associated via `htmlFor`).
- Error messages appear below the field, in `text-rose-400`, with `role="alert"`.
- Password fields have a reveal toggle for usability (important for seniors and
  first-time users who may mistype).
- `autoComplete` attributes set on all auth fields.
- Input borders: `border-slate-700` at rest → `focus:border-cyan-500 ring-1
  ring-cyan-500` on focus (dark mode) or `focus:border-royal-500 ring-1
  ring-royal-500` (light mode).
- Validation feedback on blur, not on keystroke, to reduce anxiety for novice
  users.

---

## 8. Chat UI

The advisor chat screen is the primary product surface. Design rules:

### 8.1 Message Layout

- **AI messages** (`AIChatMessage`): avatar + name label + bubble + optional
  recommendation card + timestamp. Left-aligned.
- **Customer messages** (`ChatMessage`): bubble only, right-aligned.
- **AI bubble:** `rounded-3xl rounded-tl-lg` (standard bubble with flat top-left
  corner indicating speaker origin).
- **Customer bubble:** equivalent flat corner on the opposing side.

### 8.2 Formatted Text in AI Replies

`FormattedText` in `AIChatMessage.tsx` parses agent output into rich UI
elements:

| Pattern | Rendering |
|---|---|
| `1. Option text` | Clickable numbered option button (sends option as next message) |
| `• item` or `- item` | Bullet with animated pulse dot |
| `✅ item` | Check circle icon + text |
| `💡` / `⚡` / `🔑` / `🎯` | Bold section header with emoji |
| `**bold**` | Inline `<strong>` with `font-extrabold` |
| First line of reply | Slightly larger (`text-[13px]`) — greeting treatment |

### 8.3 Thinking State

`ThinkingEngine` displays animated thinking steps while the orchestrator
processes. Never shows a blank screen during AI processing — every step is
narrated.

### 8.4 Agent Transfer Dialogs

- `TransferDialog` — appears when `suggest_transfer: true` in the response.
  Shows outgoing agent name, target agent name, and reason. Two actions:
  **Move to [Agent]** (sets `force_transfer_to`) or **Stay with [Current]**.
- `InterruptDialog` — appears when `is_interrupt: true`. Uses a "progress saved"
  message to reduce anxiety (mid-workflow detour, not a loss of work).

### 8.5 Recommendation Payload Protocol

Agents embed structured data in their reply text using the format:

```
[RECOMMENDATION:{...JSON...}]
```

`AIChatMessage` extracts this tag with `parseRecommendation()`, renders the
holographic card below the text bubble, and strips the tag from displayed text.
If JSON parsing fails, the raw text is shown as a fallback.

---

## 9. Voice UI

The `VoiceEngine` component (`frontend/src/components/VoiceEngine.tsx`) wraps
the `useVoice` hook and renders a voice interaction surface.

### 9.1 Waveform

24 animated bar elements driven by a 70 ms `setInterval`:
- Height is modulated by mic volume (when listening) or random noise (when
  speaking) with a Gaussian envelope (bars near the center are tallest).
- Bars use the active domain's accent color (e.g. `bg-emerald-400` for health).

The CSS waveform animation for the non-JS version uses `@keyframes voiceWave`
in `globals.css` (6 staggered bars, 0.5–0.9 s cycles).

### 9.2 State Ring

A circular ring around the microphone button changes border color and shadow
based on state:

- `Idle` — minimal border, no shadow
- `Listening` — domain accent border + glow shadow
- `Speaking` (TTS) — domain accent border + glow shadow (slightly different
  shade)

### 9.3 Language & Rate

`useVoice` is configured with:
- `language: "en-IN"` — Indian English recognition, compatible with Tamil /
  Thanglish accents
- `rate: 0.93` — slightly slower TTS speech rate for accessibility (seniors,
  non-native speakers)

### 9.4 Streaming Cursor

While the AI streams a reply, a glowing blinking cursor `|` appears inline:

```css
.typing-cursor-glowing {
  background-color: #06b6d4;   /* cyan-500 */
  box-shadow: 0 0 8px #06b6d4; /* glow effect */
  animation: blink 1s step-end infinite;
}
```

---

## 10. Animations

| Animation | Class / keyframe | Duration | Use |
|---|---|---|---|
| Slide-in (messages) | Framer Motion `opacity 0→1, y 10→0` | 250 ms | Chat messages and recommendation cards |
| Scale-in (cards) | Framer Motion `scale 0.96→1` | Spring (stiff 150, damp 20) | Recommendation card appear |
| Float | `animate-float` (`float` keyframe, Y ±10px) | 6 s ease-in-out infinite | Decorative elements, hero |
| Pulse subtle | `animate-pulse-subtle` (scale + opacity) | 3 s ease-in-out infinite | Status indicators |
| Waveform | `voiceWave` (height 4→28px) | 0.5–0.9 s staggered | Voice waveform bars |
| Blink cursor | `blink` (opacity 0→1→0) | 1 s step-end | Streaming text cursor |
| Hover glow | `.glow-border-hover` CSS transition | 300 ms ease | Card hover border accent |

**Performance rule:** animations use `transform` and `opacity` only —
composited properties that do not trigger layout or paint. No animation touches
`width`, `height`, or `margin`.

---

## 11. Responsive Design

| Breakpoint | Width | Strategy |
|---|---|---|
| Default (mobile) | < 640px | Single-column; full-width cards; touch-optimised buttons |
| `sm` | ≥ 640px | Two-column grids where space allows; slightly larger text |
| `lg` | ≥ 1024px | Side-by-side advisor + plan browser; wider cards |

**Mobile-first rules:**
- Recommendation cards are `max-w-lg` with `w-full` so they fill mobile screens.
- Option buttons have `w-full` to give a large tap target.
- Metric grids collapse to `grid-cols-2` on small screens (inside cards).
- The chat scroll area uses a thin custom scrollbar (3px, `chat-messages-scroll`)
  so it does not eat horizontal space on narrow viewports.

---

## 12. Accessibility (WCAG 2.1 AA Target)

Accessibility is a **product requirement**, not a backlog item. The target user
base includes seniors, rural users, and first-time buyers who may have low
digital literacy.

### 12.1 Keyboard Navigation

- All interactive elements (buttons, links, form inputs) must be reachable and
  operable via keyboard alone.
- Focus outline must be visible — never `outline: none` without an equivalent
  visible focus indicator.
- The chat option buttons use standard `<button>` elements (natively focusable).
- Modal dialogs (`TransferDialog`, `InterruptDialog`) must trap focus while open
  and return it to the trigger element when closed.

### 12.2 Color Contrast

| Combination | Ratio target | Notes |
|---|---|---|
| Body text on dark background (`text-slate-300` on `navy-900`) | ≥ 4.5:1 | WCAG AA normal text |
| Muted text (`text-slate-500` on `navy-900`) | ≥ 3:1 | WCAG AA large text / UI components |
| Cyan accent on dark (`cyan-400` on `navy-900`) | ≥ 3:1 | Used for large UI elements |
| Option button text on hover | ≥ 4.5:1 | Checked both dark and light modes |

Decorative gradient text (e.g. `.gradient-text-indigo`) is never used for
functional or informational text — it fails contrast tools. Functional labels
use solid colors.

### 12.3 Touch Targets

Minimum touch target: **44 × 44 px** (WCAG 2.5.5 / Apple HIG / Material).

- Primary CTA buttons: `py-3 px-4` ≈ 48px height ✓
- Option numbered buttons: `px-4 py-3` ✓
- Voice microphone button: explicit `w-12 h-12` or larger ✓
- Timestamps and decorative elements: not interactive ✓

### 12.4 Semantic HTML

- Use `<button>` for actions, `<a>` for navigation, `<label>` for form fields.
- Agent name labels use `<p>` with `aria-label` or wrapping `aria-describedby`
  on the message container.
- `role="alert"` on error messages so screen readers announce them immediately.
- `aria-live="polite"` on the chat message area so new messages are announced
  without interrupting the user.

### 12.5 Loading, Error, and Empty States

All data-driven views must implement three states explicitly
([PROJECT_RULES.md §4](PROJECT_RULES.md)):

| State | Requirement |
|---|---|
| **Loading** | Spinner or skeleton with `aria-label="Loading..."` |
| **Empty** | Friendly prompt, never a blank screen |
| **Error** | Human-readable message, retry option, `role="alert"` |

For the advisor screen specifically, the `ThinkingEngine` component ensures
that **loading is never a blank screen** — users always see progress steps.

### 12.6 Screen Reader Notes

- Recommendation cards embed visible text equivalents for all icon-only
  indicators (the icon is decorative; the label is text).
- Transfer dialogs must be `role="dialog"` with `aria-labelledby` pointing to
  the dialog heading.
- The voice waveform bars are decorative (`aria-hidden="true"`); the
  microphone button has an `aria-label` describing its current state
  (`"Start listening"` / `"Stop listening"`).

---

## 13. Custom Scrollbar

Consistent slim scrollbar across the platform (from `globals.css`):

```css
/* Global */
::-webkit-scrollbar        { width: 6px; height: 6px; }
::-webkit-scrollbar-track  { background: #0f172a; }          /* navy-900 */
::-webkit-scrollbar-thumb  { background: #1e293b; border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #334155; }

/* Chat messages area (even thinner) */
.chat-messages-scroll::-webkit-scrollbar { width: 3px; }
.chat-messages-scroll::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.25); }
```

The thin scrollbar in the chat area maximises message reading width on narrow
screens without removing scrollability.

---

## 14. Glow Orbs (Decorative Backgrounds)

Large blurred radial gradients used as decorative background elements on landing
pages and dashboards. All use `pointer-events: none` and `position: absolute`
so they never interfere with interactive elements.

| Class | Color | Size |
|---|---|---|
| `.glow-orb-blue` | `rgba(37,99,235,0.12)` | 400 × 400 px, blur 40px |
| `.glow-orb-cyan` | `rgba(6,182,212,0.10)` | 350 × 350 px, blur 45px |
| `.glow-orb-rose` | `rgba(244,63,94,0.08)` | 400 × 400 px, blur 40px |
| `.glow-orb-gold` | `rgba(245,158,11,0.08)` | 350 × 350 px, blur 45px |

Use sparingly — at most 2 orbs per screen. They are always in the background
layer (`z-index` below content).

---

## 15. Component Summary

| Component | File | Purpose |
|---|---|---|
| `AIChatMessage` | `components/AIChatMessage.tsx` | AI turn with parsed text, recommendation card, option buttons |
| `ChatMessage` | `components/ChatMessage.tsx` | Customer turn bubble |
| `VoiceEngine` | `components/VoiceEngine.tsx` | Mic, TTS, animated waveform |
| `ThinkingEngine` | `components/ThinkingEngine.tsx` | Streaming thinking steps during AI processing |
| `TransferDialog` | `components/TransferDialog.tsx` | User consent dialog for agent domain transfer |
| `InterruptDialog` | `components/InterruptDialog.tsx` | Mid-workflow detour confirmation |
| `EnvironmentBadge` | `components/EnvironmentBadge.tsx` | Active agent domain indicator |
| `Navbar` | `components/Navbar.tsx` | Site navigation with dark mode toggle |
| `PolicyCards` | `components/PolicyCards.tsx` | Insurance product browsing grid |
| `LeadForm` | `components/LeadForm.tsx` | Prospect capture form |
| `Hero` | `components/Hero.tsx` | Landing hero section |
| `FloatingAI` | `components/FloatingAI.tsx` | Floating advisor entry point |
| `Footer` | `components/Footer.tsx` | Site footer |
| `Testimonials` | `components/Testimonials.tsx` | Social proof section |
| `TrustSecurity` | `components/TrustSecurity.tsx` | Trust indicators section |
