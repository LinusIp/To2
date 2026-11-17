// Blender renders in public/characters → src/config/characterRenders.json (+ WebP copies, ~10× smaller).
// Runs before every build. Files must be named <id>_<pose>_<frame>.png (pose: letters/digits, e.g. think1;
// frame: full | half | face).
import fs from "node:fs";
import path from "node:path";

const dir = "public/characters";
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^[a-z-]+_[a-z0-9]+_(full|half|face)\.png$/.test(f)) : [];

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

// Real 3D tutors (Tripo → Blender): public/models/tripo/<id>.glb → src/config/characterModels.json.
// Characters without a GLB keep the box-built makeChar rig.
const mdir = "public/models/tripo";
const glbs = fs.existsSync(mdir) ? fs.readdirSync(mdir).filter((f) => /^[a-z-]+\.glb$/.test(f)) : [];
fs.writeFileSync("src/config/characterModels.json", JSON.stringify(glbs.sort(), null, 2) + "\n");
console.log(`characterModels.json: ${glbs.length} model(s)`);

// Draco decoder for the compressed GLBs, copied from the installed three.js (same version as the loader)
const dsrc = "node_modules/three/examples/jsm/libs/draco/gltf";
fs.mkdirSync("public/draco", { recursive: true });
for (const f of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"]) {
  const s = path.join(dsrc, f);
  const d = path.join("public/draco", f);
  if (fs.existsSync(s) && (!fs.existsSync(d) || fs.statSync(d).size !== fs.statSync(s).size)) fs.copyFileSync(s, d);
}
