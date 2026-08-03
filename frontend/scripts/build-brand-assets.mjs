/**
 * Aegis AI brand asset pipeline.
 *
 *   node scripts/build-brand-assets.mjs
 *
 * Reads the geometry the app itself renders (`src/components/brand/geometry.mjs`)
 * and writes every distributable form of every mark into `public/brand`. One
 * source, so a mark cannot say one thing in the product and another in a deck.
 *
 * Per brand: colour SVG, on-dark SVG, on-light SVG, monochrome SVG (inherits
 * `currentColor`), PNGs at 1024/2048/4096, a 64px favicon PNG, and a real
 * multi-resolution .ico.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import {
  AEGIS,
  AGENTS,
  GLYPHS,
  HEX_PATH,
  MONO_INK,
  VIEWBOX,
} from "../src/components/brand/geometry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "brand");

const PNG_SIZES = [1024, 2048, 4096];
const FAVICON_PNG = 64;
const ICO_SIZES = [16, 32, 48];

/** Names carry ampersands ("Claims & Fraud"), which are not valid raw XML. */
const xml = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Render one mark as a standalone SVG document.
 *
 * Mirrors `BrandMark.tsx`. The two are deliberately separate renderers — one
 * emits a static file, the other a live React tree with animation hooks — but
 * they read the same paths and the same palette, which is the part that would
 * actually drift.
 */
function renderSvg(brandId, { mode = "color", glow = true, ink } = {}) {
  const tone = AGENTS[brandId];
  const isAegis = brandId === "aegis";
  const glyph = isAegis ? null : GLYPHS[brandId];

  const mono = mode !== "color";
  // `currentColor` lets a monochrome mark inherit whatever colour the page or
  // the stylesheet sets, which is what makes it genuinely reusable.
  const paint = mono ? (ink ?? "currentColor") : "url(#grad)";
  const accent = mono ? (ink ?? "currentColor") : tone.bright;
  const hasCut = !mono && !!glyph?.cut?.length;

  const defs = [];
  if (!mono) {
    defs.push(
      `<linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0%" stop-color="${tone.deep}"/>` +
        `<stop offset="100%" stop-color="${tone.bright}"/>` +
        `</linearGradient>`
    );
  }
  if (glow) {
    defs.push(
      `<filter id="glow" x="-40%" y="-40%" width="180%" height="180%">` +
        `<feGaussianBlur stdDeviation="3" result="b"/>` +
        `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>` +
        `</filter>`
    );
  }
  if (hasCut) {
    defs.push(
      `<mask id="cut">` +
        `<rect width="${VIEWBOX}" height="${VIEWBOX}" fill="black"/>` +
        (glyph.fill ?? []).map((d) => `<path d="${d}" fill="white"/>`).join("") +
        (glyph.cut ?? []).map((d) => `<path d="${d}" fill="black"/>`).join("") +
        `</mask>`
    );
  }

  const body = [];
  if (isAegis) {
    body.push(
      `<path d="${AEGIS.shield}" stroke="${paint}" stroke-width="5" stroke-linejoin="round" fill="none"/>`,
      `<path d="${AEGIS.chevron}" fill="${paint}"/>`,
      `<ellipse cx="${AEGIS.orbit.cx}" cy="${AEGIS.orbit.cy}" rx="${AEGIS.orbit.rx}" ry="${AEGIS.orbit.ry}" ` +
        `stroke="${paint}" stroke-width="3" fill="none" opacity="0.85" ` +
        `transform="rotate(${AEGIS.orbit.rotate} ${AEGIS.orbit.cx} ${AEGIS.orbit.cy})"/>`
    );
  } else {
    body.push(
      `<path d="${HEX_PATH}" stroke="${paint}" stroke-width="5" stroke-linejoin="round" fill="none"/>`
    );
    const spin = glyph?.rotate
      ? ` transform="rotate(${glyph.rotate} ${VIEWBOX / 2} ${VIEWBOX / 2})"`
      : "";
    if (hasCut) {
      body.push(`<g${spin}><rect width="${VIEWBOX}" height="${VIEWBOX}" fill="${paint}" mask="url(#cut)"/></g>`);
    } else {
      const fills = (glyph?.fill ?? []).map((d) => `<path d="${d}" fill="${paint}"/>`).join("");
      if (fills) body.push(spin ? `<g${spin}>${fills}</g>` : fills);
    }
    const gw = glyph?.strokeWidth ?? 4;
    for (const d of glyph?.stroke ?? []) {
      body.push(
        `<path d="${d}" stroke="${accent}" stroke-width="${gw}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
      );
    }
    for (const dot of glyph?.dots ?? []) {
      body.push(`<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${accent}"/>`);
    }
    if (glyph?.antenna) {
      body.push(
        `<circle cx="${glyph.antenna.cx}" cy="${glyph.antenna.cy}" r="${glyph.antenna.r}" fill="${paint}"/>`
      );
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" ` +
    `width="${VIEWBOX}" height="${VIEWBOX}" fill="none" role="img" aria-label="${xml(tone.name)}">` +
    `<title>${xml(tone.name)} — ${xml(tone.role)}</title>` +
    (defs.length ? `<defs>${defs.join("")}</defs>` : "") +
    `<g${glow ? ' filter="url(#glow)"' : ""}>${body.join("")}</g>` +
    `</svg>`
  );
}

/**
 * A real .ico: an ICONDIR header followed by one PNG per size. Every browser
 * in use understands PNG-in-ICO, and it keeps the file a fraction of the size
 * of the equivalent BMP encoding.
 */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = [];
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

async function buildBrand(brandId) {
  const dir = join(OUT, brandId);
  await mkdir(dir, { recursive: true });

  const colour = renderSvg(brandId, { mode: "color" });
  const files = [
    [`${brandId}.svg`, colour],
    // "on-dark" / "on-light" name the backdrop the mark is FOR, which is the
    // thing people actually get wrong when the files are called dark/light.
    [`${brandId}-on-dark.svg`, renderSvg(brandId, { mode: "mono", ink: MONO_INK.light })],
    [`${brandId}-on-light.svg`, renderSvg(brandId, { mode: "mono", ink: MONO_INK.dark })],
    [`${brandId}-mono.svg`, renderSvg(brandId, { mode: "mono", glow: false })],
  ];
  for (const [name, svg] of files) await writeFile(join(dir, name), svg, "utf8");

  for (const size of PNG_SIZES) {
    await writeFile(join(dir, `${brandId}-${size}.png`), await png(colour, size));
  }

  // Favicons drop the glow: a soft halo just reads as blur at 16px.
  const flat = renderSvg(brandId, { mode: "color", glow: false });
  await writeFile(join(dir, `${brandId}-favicon.png`), await png(flat, FAVICON_PNG));
  const icoParts = [];
  for (const size of ICO_SIZES) icoParts.push({ size, data: await png(flat, size) });
  await writeFile(join(dir, "favicon.ico"), buildIco(icoParts));

  return files.length + PNG_SIZES.length + 2;
}

const ids = ["aegis", ...Object.keys(AGENTS).filter((id) => id !== "aegis")];
let total = 0;
for (const id of ids) {
  const n = await buildBrand(id);
  total += n;
  console.log(`  ${AGENTS[id].name.padEnd(8)} ${n} files -> public/brand/${id}/`);
}
console.log(`\n${total} brand assets written across ${ids.length} marks.`);
