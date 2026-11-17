// Extract single-stroke glyphs for the chalk handwriting engine.
// Source: "EMS Tech" single-line SVG font from the `hersheytext` package (font: SIL Open Font License,
// SVG conversion by Windell H. Oskay). Output: src/components/board/glyphs.json
// Coordinates are normalised so the cap height = 100 units, baseline at y = 100 (y grows downward).
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const dir = require.resolve("hersheytext/package.json").replace(/package\.json$/, "");
const svg = fs.readFileSync(dir + "svg_fonts/EMSTech.svg", "utf8");
const ent = { "&#x22;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&apos;": "'", "&#x27;": "'", "&quot;": '"' };
const raw = {};
for (const m of svg.matchAll(/<glyph\s+unicode="([^"]*)"[^>]*?horiz-adv-x="([\d.]+)"(?:[^>]*?\sd="([^"]*)")?/g)) {
  const u = ent[m[1]] ?? m[1];
  raw[u] = { w: +m[2], d: m[3] || "" };
}
// cap height from "E"
const ys = [...raw.E.d.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)].map((p) => +p[2]);
const cap = Math.max(...ys);
const k = 100 / cap;
const out = {};
for (const [ch, g] of Object.entries(raw)) {
  if (ch.length !== 1 || ch.charCodeAt(0) > 126) continue;
  // split into strokes ("M" starts a new stroke), scale, flip y
  const strokes = g.d
    .split(/(?=M)/)
    .map((s) =>
      [...s.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)].map((p) => [Math.round(+p[1] * k * 10) / 10, Math.round((100 - +p[2] * k) * 10) / 10]),
    )
    .filter((pts) => pts.length > 0);
  out[ch] = { w: Math.round(g.w * k * 10) / 10, s: strokes };
}
fs.writeFileSync("src/components/board/glyphs.json", JSON.stringify(out));
console.log(Object.keys(out).length, "glyphs, cap", cap, "→ src/components/board/glyphs.json");
