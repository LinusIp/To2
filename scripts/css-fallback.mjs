// Post-build CSS fallbacks for older browsers / Android WebViews (runs after `vite build`).
// Tailwind v4 output needs Chrome 111+ / Safari 16.4+: an old Android System WebView (e.g. Chrome 83 on
// Android 11 images) drops every rule inside @layer — i.e. almost the whole stylesheet — and doesn't know
// oklch(), color-mix() or nesting. We rewrite each built .css file in place (same hashed name):
//   1. @csstools/postcss-cascade-layers: removes @layer, keeping the same precedence via specificity
//   2. lightningcss with targets chrome/android ≥ 87, safari ≥ 14: rgb fallbacks for oklch / color-mix,
//      un-nested selectors, vendor prefixes. Minified again.
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import cascadeLayers from "@csstools/postcss-cascade-layers";
import { transform, browserslistToTargets } from "lightningcss";
import browserslist from "browserslist";

const OUT = ".cloudflare/output/v0/workers/default";
const QUERY = ["chrome >= 87", "safari >= 14", "android >= 87", "ios_saf >= 14"];
const targets = browserslistToTargets(browserslist(QUERY));

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith(".css") ? [p] : [];
  });
}

const files = walk(OUT);
let before = 0;
let after = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (src.includes("/* to2-css-fallback */")) continue; // already processed (re-run)
  const flat = (await postcss([cascadeLayers()]).process(src, { from: f })).css;
  const { code } = transform({ filename: f, code: Buffer.from(flat), minify: true, targets });
  const out = "/* to2-css-fallback */" + code.toString();
  fs.writeFileSync(f, out);
  before += src.length;
  after += out.length;
}
console.log(`css-fallback: ${files.length} file(s), ${(before / 1024).toFixed(0)} → ${(after / 1024).toFixed(0)} KiB (targets: ${QUERY.join(", ")})`);
