// Blender renders in public/characters → src/config/characterRenders.json (+ WebP copies, ~10× smaller).
// Runs before every build. Files must be named <id>_<pose>_<frame>.png (frame: full | half | face).
import fs from "node:fs";
import path from "node:path";

const dir = "public/characters";
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^[a-z-]+_[a-z]+_(full|half|face)\.png$/.test(f)) : [];

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.warn("sharp not installed — skipping WebP copies");
}
let made = 0;
if (sharp) {
  for (const f of files) {
    const src = path.join(dir, f);
    const dst = src.replace(/\.png$/, ".webp");
    if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) continue;
    await sharp(src).webp({ quality: 82, alphaQuality: 90 }).toFile(dst);
    made++;
  }
}
fs.writeFileSync("src/config/characterRenders.json", JSON.stringify(files.sort(), null, 2) + "\n");
console.log(`characterRenders.json: ${files.length} render(s), ${made} new WebP`);
