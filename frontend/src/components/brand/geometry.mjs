/**
 * Aegis AI brand geometry — the single source of truth.
 *
 * Both the React components and the static asset pipeline
 * (`scripts/build-brand-assets.mjs`) import this file, so a mark can never
 * drift between the SVG shipped in `public/brand` and the one rendered in the
 * app. Plain ESM rather than TypeScript for exactly that reason: node runs it
 * directly, and `geometry.d.ts` gives the app full types.
 *
 * The marks are vector reconstructions of the master `logo.png`. Every colour
 * below was sampled from that file rather than chosen, and the shield
 * proportions, glyph shapes and glow language follow it — this is a rebuild of
 * the existing identity, not a redesign of it.
 *
 * Canvas: 128x128, centre (64,64), 12px safe padding on every side. The mark
 * never touches the edge, so it drops into a favicon, an avatar circle or a
 * slide without re-cropping.
 */

/** Every mark shares this canvas so they align when set side by side. */
export const VIEWBOX = 128;
export const SAFE_PADDING = 12;

/**
 * The badge silhouette: a pointy-top hexagon, identical for all five agents.
 * Only the gradient and the inner glyph change — that is what makes them read
 * as one family rather than five logos.
 */
export const HEX_PATH =
  "M64 13 L108.2 38.5 L108.2 89.5 L64 115 L19.8 89.5 L19.8 38.5 Z";

/** Slightly inset copy, used for the hover/selection ring and the radar sweep. */
export const HEX_RING_PATH =
  "M64 4.5 L116 34.5 L116 94.5 L64 124.5 L12 94.5 L12 34.5 Z";

/**
 * The Aegis master mark: a shield rather than a hexagon, carrying the "A"
 * chevron and the orbital ring from the master artwork.
 */
export const AEGIS = {
  shield: "M64 10 L112 30 L112 68 C112 94 90 112 64 120 C38 112 16 94 16 68 L16 30 Z",
  /** The "A" chevron that sits inside the shield. */
  chevron: "M64 38 L88 92 L76 92 L64 62 L52 92 L40 92 Z",
  /** Orbital ring — an ellipse rotated across the shield, as in the master. */
  orbit: { cx: 64, cy: 62, rx: 56, ry: 20, rotate: -22 },
};

/**
 * Agent glyphs, each drawn to sit inside the hexagon with room to breathe.
 *
 * `draw` paths are stroked and are the ones the "draws itself" animations run
 * along, so they are authored as continuous outlines wherever the animation
 * needs a single confident line.
 */
export const GLYPHS = {
  /** Motor — front elevation of a car: cabin, body, lamps, grille, wheels. */
  alex: {
    strokeWidth: 3.4,
    /** The master draws the car as an outline, not a silhouette — body,
     *  windscreen and bumper are all strokes. */
    stroke: [
      "M39 79 V70.5 C39 67 41.5 64.5 45 64.5 L50 52 C51.2 49 53.6 47 57 47 H71 C74.4 47 76.8 49 78 52 L83 64.5 C86.5 64.5 89 67 89 70.5 V79 C89 80.7 87.7 82 86 82 H42 C40.3 82 39 80.7 39 79 Z",
      "M56 52.5 H72 C73.2 52.5 74.2 53.3 74.6 54.5 L77.6 64.5 H50.4 L53.4 54.5 C53.8 53.3 54.8 52.5 56 52.5 Z",
      "M45.5 82 V86.5 M82.5 82 V86.5",
    ],
    /** Headlamps and grille read as solid at any size. */
    fill: [
      "M56.5 69.5 h15 v4.2 h-15 Z",
      "M35.5 61.5 h4.5 v4.5 h-4.5 Z",
      "M88 61.5 h4.5 v4.5 h-4.5 Z",
    ],
    dots: [
      { cx: 46.5, cy: 71.5, r: 3.6 },
      { cx: 81.5, cy: 71.5, r: 3.6 },
    ],
  },

  /** Health — a heart carrying an ECG trace, as in the master badge. */
  sarah: {
    fill: [
      "M64 91 C64 91 37 74.5 37 58.5 C37 49 44.5 42 53.5 42 C58.8 42 62 45.2 64 49 C66 45.2 69.2 42 74.5 42 C83.5 42 91 49 91 58.5 C91 74.5 64 91 64 91 Z",
    ],
    /** The pulse line — stroked, and what the heartbeat animation traces. */
    stroke: ["M38 62 H52 L56.5 50 L64 77 L70 60 L74.5 68 H90"],
  },

  /** Property — roof, walls and door. Authored as continuous strokes so the
   *  outline can draw itself in one confident pass. */
  emma: {
    stroke: [
      "M34 68 L64 42 L94 68",
      "M42 62 V88 H86 V62",
      "M56 88 V70 H72 V88",
    ],
  },

  /** Travel — an aircraft. Drawn upright and banked by `rotate`, which keeps
   *  the silhouette readable and lets the orbit animation reuse the same path. */
  ethan: {
    rotate: 34,
    fill: [
      "M64 38 C67 38 69 42.5 69 49 L69 58.5 L91 72 L91 78 L69 71.5 L69 82 L76 88.5 L76 92 L64 88.5 L52 92 L52 88.5 L59 82 L59 71.5 L37 78 L37 72 L59 58.5 L59 49 C59 42.5 61 38 64 38 Z",
    ],
  },

  /** Claims & fraud — the assistant head: antenna, visor, eyes, ear units. */
  nova: {
    strokeWidth: 3.4,
    /** Outlined head, visor and ear units — the master's construction. */
    stroke: [
      "M64 35 V44",
      "M51 44 H77 C81.5 44 85 47.5 85 52 V79 C85 83.5 81.5 87 77 87 H51 C46.5 87 43 83.5 43 79 V52 C43 47.5 46.5 44 51 44 Z",
      "M53.5 54 H74.5 C76.5 54 78 55.5 78 57.5 V73 C78 75 76.5 76.5 74.5 76.5 H53.5 C51.5 76.5 50 75 50 73 V57.5 C50 55.5 51.5 54 53.5 54 Z",
      "M58.5 70 Q64 73.5 69.5 70",
      "M43 76 H38 C36 76 34.5 74.5 34.5 72.5 V62 C34.5 60 36 58.5 38 58.5 H43",
      "M85 76 H90 C92 76 93.5 74.5 93.5 72.5 V62 C93.5 60 92 58.5 90 58.5 H85",
    ],
    /** Eyes sit inside the visor and are what the scan animation sweeps. */
    dots: [
      { cx: 58, cy: 63.5, r: 4.4 },
      { cx: 70, cy: 63.5, r: 4.4 },
    ],
    antenna: { cx: 64, cy: 32, r: 4 },
  },
};

/**
 * Brand palette. Every value was sampled directly from `logo.png` — the deep
 * tone from the shadowed side of each badge, the bright tone from its lit edge —
 * so the gradients run the same direction and range as the master.
 */
export const AGENTS = {
  aegis: {
    id: "aegis",
    name: "Aegis AI",
    role: "Enterprise Agentic AI Platform",
    deep: "#0B57D0",
    bright: "#9CC4FF",
    glow: "rgba(1, 67, 217, 0.55)",
  },
  alex: {
    id: "alex",
    name: "Alex",
    role: "Motor Insurance Agent",
    deep: "#1668E3",
    bright: "#5CCDF7",
    glow: "rgba(0, 128, 240, 0.55)",
  },
  sarah: {
    id: "sarah",
    name: "Sarah",
    role: "Health Insurance Agent",
    deep: "#0AA87C",
    bright: "#3FEBB8",
    glow: "rgba(0, 208, 160, 0.55)",
  },
  emma: {
    id: "emma",
    name: "Emma",
    role: "Property Insurance Agent",
    deep: "#6A3AE0",
    bright: "#C68CF7",
    glow: "rgba(96, 64, 240, 0.55)",
  },
  ethan: {
    id: "ethan",
    name: "Ethan",
    role: "Travel Insurance Agent",
    deep: "#DE9A1E",
    bright: "#F9E08C",
    glow: "rgba(240, 208, 112, 0.55)",
  },
  nova: {
    id: "nova",
    name: "Nova",
    role: "Claims & Fraud Intelligence Agent",
    deep: "#0F8AD8",
    bright: "#7DEBFB",
    glow: "rgba(112, 240, 240, 0.55)",
  },
};

/** Render order — the sequence the homepage reveal follows. */
export const AGENT_ORDER = ["alex", "sarah", "emma", "ethan", "nova"];

/** Monochrome renders use a single ink so the mark survives a fax, an embosser
 *  or a one-colour print run. */
export const MONO_INK = { dark: "#0A1428", light: "#FFFFFF" };
