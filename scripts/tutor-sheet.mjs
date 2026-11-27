// Contact sheet for the M6 light check: rows = tutors, columns = light presets (tutor crop from the
// lesson screenshots of scripts/tutor-shots.mjs) + the Blender portrait (the target look).
//   node scripts/tutor-sheet.mjs <shotsDir> <out.png> aces,neutral,agx
import sharp from "sharp";

const dir = process.argv[2] ?? "docs/screenshots/tutor-light";
const out = process.argv[3] ?? `${dir}/sheet.png`;
const presets = (process.argv[4] ?? "aces,neutral,agx").split(",");
const TUTORS = ["blokbek", "lola", "ziyo"];
const W = 260, H = 380, PAD = 8;

const tiles = [];
for (const [r, id] of TUTORS.entries()) {
  for (const [c, p] of presets.entries()) {
    const img = sharp(`${dir}/${p}-${id}.png`);
    const m = await img.metadata();
    // the tutor stands at the left of the phone stage: left 34 %, full height
    const crop = await img
      .extract({ left: 0, top: 0, width: Math.round(m.width * 0.34), height: m.height })
      .resize(W, H, { fit: "contain", background: "#ffffff" })
      .toBuffer();
    tiles.push({ input: crop, left: PAD + c * (W + PAD), top: PAD + r * (H + PAD) });
  }
  const portrait = await sharp(`public/characters/${id}_idle_full.png`)
    .flatten({ background: "#e6dac3" })
    .resize(W, H, { fit: "contain", background: "#e6dac3" })
    .toBuffer();
  tiles.push({ input: portrait, left: PAD + presets.length * (W + PAD), top: PAD + r * (H + PAD) });
}
const cols = presets.length + 1;
await sharp({ create: { width: PAD + cols * (W + PAD), height: PAD + TUTORS.length * (H + PAD), channels: 3, background: "#ffffff" } })
  .composite(tiles)
  .png()
  .toFile(out);
console.log("saved", out, "columns:", [...presets, "portrait (Blender AgX MHC)"].join(" | "));
