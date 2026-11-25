// Export the tutors' greeting audio as static files: public/audio/greetings/<id>.wav (+ greetingAudio.json).
// The picker plays these first (src/lib/audio/greetings.ts), so "Ovozini eshit" never waits on /api/tts.
// SAFE BY DESIGN: it downloads a greeting only when production's dry run (&check=1) says `cached: true`
// (a cache hit costs 0 credits) and REFUSES every uncached line — it never makes VoiceLab generate audio.
// Greeting texts come from src/config/characters.ts (`hi`), requested exactly like the picker asks
// (voice=<id>, emotion=happy), so the file is the same audio the app would play.
// Usage: node scripts/export-greetings.mjs [baseUrl] [--dry-run] [ids…]   (default: every tutor)
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith("http")) ?? "https://to2.locallabs-io.workers.dev";
const DRY = args.includes("--dry-run");
const only = args.filter((a) => !a.startsWith("http") && !a.startsWith("--"));

const out = path.join(os.tmpdir(), "to2-characters.mjs");
await build({
  stdin: { contents: `export { CHARACTERS } from "@/config/characters";`, resolveDir: path.resolve("."), loader: "ts" },
  bundle: true, format: "esm", platform: "node", outfile: out, alias: { "@": path.resolve("src") }, logLevel: "silent",
});
const { CHARACTERS } = await import("file://" + out);
fs.rmSync(out, { force: true });

const DIR = "public/audio/greetings";
const LIST = "src/config/greetingAudio.json";
fs.mkdirSync(DIR, { recursive: true });
const have = new Set(fs.existsSync(LIST) ? JSON.parse(fs.readFileSync(LIST, "utf8")) : []);

const url = (c) => `${base}/api/tts?voice=${encodeURIComponent(c.id)}&text=${encodeURIComponent(c.hi)}&emotion=happy`;
let refused = 0;
for (const c of CHARACTERS.filter((c) => c.hi && (only.length === 0 || only.includes(c.id)))) {
  const chk = await fetch(url(c) + "&check=1");
  if (chk.status !== 200) {
    console.warn(`! ${c.id}: check failed (${chk.status}) — skipped`);
    continue;
  }
  const info = await chk.json();
  if (!info.cached) {
    refused++;
    console.log(`✗ ${c.id}: NOT cached (${info.missingClips}/${info.clips} clips, ~${info.credits} credits) — refused, captions only`);
    continue;
  }
  if (DRY) {
    console.log(`✓ ${c.id}: cached (${info.model}) — would export`);
    continue;
  }
  const r = await fetch(url(c));
  const type = r.headers.get("content-type") ?? "";
  if (r.status !== 200 || !type.startsWith("audio/")) {
    console.warn(`! ${c.id}: ${r.status} ${r.headers.get("x-tts-error") ?? ""} — skipped`);
    continue;
  }
  if (r.headers.get("x-tts-cache") !== "hit") console.warn(`! ${c.id}: served as "${r.headers.get("x-tts-cache")}", not a whole-line cache hit`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(path.join(DIR, `${c.id}.wav`), buf);
  have.add(c.id);
  console.log(`✓ ${c.id}: ${DIR}/${c.id}.wav (${Math.round(buf.length / 1024)} KB, ${r.headers.get("x-tts-model")})`);
}
if (!DRY) {
  // only list files that really exist
  const ids = [...have].filter((id) => fs.existsSync(path.join(DIR, `${id}.wav`))).sort();
  fs.writeFileSync(LIST, JSON.stringify(ids, null, 2) + "\n");
  console.log(`${LIST}: ${ids.join(", ") || "(none)"}`);
}
if (refused) console.log(`${refused} uncached greeting(s) refused — they stay captions-only until a credit budget is approved.`);
