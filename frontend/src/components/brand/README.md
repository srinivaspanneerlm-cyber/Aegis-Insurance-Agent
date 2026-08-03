# Aegis AI — Brand System

Six marks, one geometry source, one motion vocabulary.

Everything here is a **vector reconstruction of `logo.png`**. The master is a
1536×1024 raster in which each agent badge occupies roughly **85×80 pixels** —
enough to read at thumbnail size, nowhere near enough to export at 4096px or to
animate. Rebuilding the marks as vector is what makes scalable exports and
path-based animation possible at all; every colour below was *sampled from the
master* rather than chosen, and the hexagon proportions, outlined glyph
construction and glow language follow it.

---

## Folder map

```
src/components/brand/
├── geometry.mjs        ← single source of truth: paths + palette
├── geometry.d.ts       ← types for the above
├── BrandMark.tsx       ← every mark, every variant
├── MarkSignature.tsx   ← per-agent idle animations + thinking state
├── AgentBadge.tsx      ← interactive mark: hover, select, speak, think
├── AgentConstellation.tsx ← the row: scroll reveal, selection, routing
├── RoutingBeam.tsx     ← Executive → specialist delegation beam
├── motion.ts           ← durations, easings, springs, variants
└── index.ts            ← public surface

public/brand/<id>/      ← generated, do not hand-edit
scripts/build-brand-assets.mjs
```

`geometry.mjs` is plain ESM on purpose: node runs it directly in the asset
pipeline while the app imports it with full types via `geometry.d.ts`. That is
what guarantees the SVG in a slide deck and the SVG on the homepage are the
same shape.

---

## Generated assets

```bash
node scripts/build-brand-assets.mjs      # 54 files, ~30s
```

Per mark, in `public/brand/<id>/`:

| File | Use |
|---|---|
| `<id>.svg` | Full colour, with glow. The default. |
| `<id>-on-dark.svg` | Single white ink, **for dark backgrounds** |
| `<id>-on-light.svg` | Single navy ink, **for light backgrounds** |
| `<id>-mono.svg` | Inherits `currentColor` — one-colour print, embossing |
| `<id>-1024/2048/4096.png` | Transparent raster, presentation and print |
| `<id>-favicon.png` | 64px, glow removed |
| `favicon.ico` | Real multi-resolution icon (16/32/48) |

The dark/light files are named for **the backdrop they go on**, which is the
thing people get wrong when files are called `dark`/`light`.

Favicons drop the glow deliberately — a soft halo just reads as blur at 16px.

---

## Palette

Sampled from the master: the deep tone from each badge's shadowed side, the
bright tone from its lit edge, so gradients run the same direction and range.

| Mark | Deep | Bright |
|---|---|---|
| Aegis | `#0B57D0` | `#9CC4FF` |
| Alex — Motor | `#1668E3` | `#5CCDF7` |
| Sarah — Health | `#0AA87C` | `#3FEBB8` |
| Emma — Property | `#6A3AE0` | `#C68CF7` |
| Ethan — Travel | `#DE9A1E` | `#F9E08C` |
| Nova — Claims & Fraud | `#0F8AD8` | `#7DEBFB` |

---

## Usage

### A mark on its own

```tsx
import { BrandMark } from "@/components/brand";

<BrandMark brand="sarah" size={96} title="Sarah — Health Insurance Agent" />
<BrandMark brand="aegis" size={32} variant="mono-light" glow={false} title={null} />
```

Pass `title={null}` when the mark sits next to its own visible label — otherwise
a screen reader reads the name twice.

### An interactive agent

```tsx
import { AgentBadge } from "@/components/brand";

<AgentBadge
  agent="alex"
  animated                 // signature idle animation
  speaking={isSpeaking}    // one acknowledgement beat
  thinking={isThinking}    // slow rotation + orbiting motes
  showRole
  onSelect={(id) => open(id)}
/>
```

With `onSelect` it renders a real `<button>` with `aria-pressed`; without, a
plain `div`. A control that cannot be reached by keyboard is not a control.

### The full line-up

```tsx
import { AgentConstellation } from "@/components/brand";

<AgentConstellation
  showExecutive            // Executive above + delegation beam on select
  speaking={speakingAgent}
  thinking={thinkingAgent}
  onSelect={setAgent}
  renderCard={(agent) => <AgentCard agent={agent} />}
/>
```

Reveals in order at 300 ms intervals when scrolled into view, **once** — a row
that re-animates on every pass is a distraction, not a delight.

---

## The animations

| Agent | Signature | Why |
|---|---|---|
| **Alex** | Charge orbits the shield, shield pulses | Motor — electric, in motion |
| **Sarah** | ECG traces itself across the heart | Health has a pulse |
| **Emma** | House outline draws itself, then the shield settles | Property is something you build |
| **Ethan** | The aircraft flies the shield's perimeter, banking | Travel goes somewhere |
| **Nova** | Visor scan sweep + eyes brighten | Claims work is inspection |

Plus, shared across the system:

- **Reveal** — fade + scale + a 2° settle, 300 ms apart. Two degrees is enough
  to register arrival; more reads as a slide transition from another product.
- **Hover** — 1.06 scale, glow up, dashed outer ring turns. Kept under 1.08 so
  badges in a row do not collide.
- **Selection** — chosen mark springs to 1.18, the rest fall to 0.25 opacity.
- **Speaking** — one beat, then still.
- **Thinking** — slow rotation with orbiting motes. Deliberately the same for
  every agent: "working" is a platform state, not a domain one.
- **Routing** — an arc from the Executive to the chosen specialist, with a
  packet travelling it, so the direction of the handover is unmistakable.

### Reduced motion

Every looping animation stops under `prefers-reduced-motion: reduce`. Vestibular
disorders are common and a permanently orbiting particle is exactly the kind of
motion that triggers them. The marks stay fully legible with zero frames of
animation — nothing is *communicated* by motion alone.

---

## Changing a mark

Edit `geometry.mjs`, then re-run the pipeline:

```bash
node scripts/build-brand-assets.mjs
npx vitest run src/components/brand
```

Never hand-edit anything in `public/brand/` — it is generated, and the next
build will overwrite it.

Adding an agent: add a tone to `AGENTS`, a glyph to `GLYPHS`, its id to
`AGENT_ORDER`, and a case to `MarkSignature`. Nothing else needs touching —
the badge, the row, the exports and the favicon all follow.

---

## Note on Nova

Nova is in the brand system because it is in the master artwork. It is **not**
an agent in the running platform — `ai-python/app/agents/` has Sarah, Alex,
Emma, Ethan and the Executive. Wiring a real claims-and-fraud agent is a
separate piece of work in protected code.
