// Pre-generate TTS for the FIZIKA demo lesson only ("Tezlik: v = s / t"), for Blokbek, Lola, Ziyo.
// Usage: node scripts/warm-physics.mjs [baseUrl] [--dry-run] [--max-credits=6000]
//   Lines = every `say` of the lesson (with its emotion, as the player asks for it) + the
//   "Ko'rsatib ber" reveal of its two questions. Calls our own /api/tts, which caches each line;
//   --dry-run asks `check=1` (no generation) and prints the cost.
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const base = process.argv.slice(2).find((a) => a.startsWith("http")) ?? "https://to2.locallabs-io.workers.dev";
const DRY = process.argv.includes("--dry-run");
const MAX = Number(process.argv.find((a) => a.startsWith("--max-credits="))?.split("=")[1] ?? 6000);
const out = path.join(os.tmpdir(), "to2-physics.mjs");
await build({
  stdin: {
    contents: `export { PHYSICS_SPEED } from "@/lib/ai/mock/physics"; export { speakMath } from "@/lib/ai/speakMath";`,
    resolveDir: path.resolve("."),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  alias: { "@": path.resolve("src") },
  logLevel: "silent",
});
const { PHYSICS_SPEED, speakMath } = await import("file://" + out);
fs.rmSync(out, { force: true });

const voices = (process.env.WARM_VOICES ?? "blokbek,lola,ziyo").split(",").map((v) => v.trim()).filter(Boolean);
const lines = PHYSICS_SPEED.map((s) => ({ text: s.say, emotion: s.emotion }));
for (const s of PHYSICS_SPEED) if (s.expect) lines.push({ text: speakMath(`To'g'ri javob: ${s.expect.answer}. Keling, davom etamiz!`), emotion: "encouraging" });

const ttsUrl = (v, p) =>
  `${base}/api/tts?voice=${encodeURIComponent(v)}&text=${encodeURIComponent(p.text)}${p.emotion !== "neutral" ? "&emotion=" + p.emotion : ""}&wait=long&src=warm`;

const jobs = voices.flatMap((v) => lines.map((p) => ({ v, p })));
let credits = 0;
const todo = [];
for (const j of jobs) {
  const r = await fetch(ttsUrl(j.v, j.p) + "&check=1");
  if (r.status !== 200) {
    console.warn(`! check ${r.status}: ${j.v} · ${j.p.text}`);
    continue;
  }
  const c = await r.json();
  if (!c.cached) {
    todo.push(j);
    credits += c.credits;
  }
}
console.log(`${jobs.length} lines (${lines.length} × ${voices.length} tutors) → ${todo.length} not cached, ≈ ${Math.round(credits)} credits`);
if (DRY) process.exit(0);
if (credits > MAX) {
  console.error(`✘ ${Math.round(credits)} credits is over --max-credits=${MAX}`);
  process.exit(2);
}
let ok = 0, fail = 0, v1 = 0;
const q = [...todo];
await Promise.all(
  Array.from({ length: 2 }, async () => {
    while (q.length) {
      const j = q.shift();
      const r = await fetch(ttsUrl(j.v, j.p)).catch(() => null);
      await r?.arrayBuffer().catch(() => null);
      const c = r?.headers.get("x-tts-cache");
      if (r?.status === 200) ok++;
      else fail++;
      if (c === "fallback-v1" || c === "cap-v1") v1++;
      process.stdout.write(r?.status === 200 ? (c === "fallback-v1" || c === "cap-v1" ? "1" : "+") : "x");
    }
  }),
);
console.log(`\nok=${ok} fail=${fail} fallback-v1=${v1}`);
