// Pre-generate the voice of the English demo lesson (src/config/courses/english/demoLesson.ts) for
// the 3 playable tutors, through production /api/tts (cached by sha256(voice+model+speed+text), so the
// lesson plays instantly once it is wired in). Same protocol as warm-tts.mjs: dry run first.
// Usage: node scripts/warm-english.mjs [baseUrl] [--dry-run] [--max-credits=6000]
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const base = process.argv.slice(2).find((a) => a.startsWith("http")) ?? "https://to2.locallabs-io.workers.dev";
const out = path.join(os.tmpdir(), "to2-english.mjs");
await build({
  stdin: {
    contents: `export { EN_TO_BE } from "@/config/courses/english/demoLesson"; export { speakMath } from "@/lib/ai/speakMath";`,
    resolveDir: path.resolve("."),
    loader: "ts",
  },
  bundle: true, format: "esm", platform: "node", outfile: out, alias: { "@": path.resolve("src") }, logLevel: "silent",
});
const { EN_TO_BE, speakMath } = await import("file://" + out);
fs.rmSync(out, { force: true });

const voices = (process.env.WARM_VOICES ?? "blokbek,lola,ziyo").split(",").map((v) => v.trim()).filter(Boolean);
const lines = EN_TO_BE.map((s) => ({ text: s.say, emotion: s.emotion }));
// "Ko'rsatib ber" reveal lines, spoken like the player does (engine.ts)
for (const s of EN_TO_BE) if (s.expect) lines.push({ text: speakMath(`To'g'ri javob: ${s.expect.answer}. Keling, davom etamiz!`), emotion: "encouraging" });

const url = (v, p) => `${base}/api/tts?voice=${encodeURIComponent(v)}&text=${encodeURIComponent(p.text)}${p.emotion !== "neutral" ? "&emotion=" + p.emotion : ""}&wait=long&src=warm`;
async function get(u) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(u); return { r, body: await r.arrayBuffer() }; }
    catch { if (i >= 3) return { r: { status: 0, headers: new Headers() }, body: new ArrayBuffer(0) }; await new Promise((res) => setTimeout(res, 1500 * (i + 1))); }
  }
}
const jobs = voices.flatMap((v) => lines.map((p) => ({ v, p })));
let credits = 0;
const todo = [];
for (const j of jobs) {
  const { r, body } = await get(url(j.v, j.p) + "&check=1");
  if (r.status !== 200) { console.warn(`! check ${r.status} ${j.v}: ${j.p.text}`); continue; }
  const c = JSON.parse(new TextDecoder().decode(body));
  if (!c.cached) { todo.push(j); credits += c.credits; }
}
console.log(`${jobs.length} lines → ${todo.length} not cached, ≈ ${Math.round(credits)} credits`);
const MAX = Number(process.argv.find((a) => a.startsWith("--max-credits="))?.split("=")[1] ?? 6000);
if (process.argv.includes("--dry-run")) process.exit(0);
if (credits > MAX) { console.error(`✘ over --max-credits=${MAX}: skipped (captions only)`); process.exit(2); }
let ok = 0, fail = 0, v1 = 0;
const q = [...todo];
await Promise.all(Array.from({ length: 2 }, async () => {
  while (q.length) {
    const j = q.shift();
    const { r } = await get(url(j.v, j.p));
    const c = r.headers.get("x-tts-cache");
    r.status === 200 ? ok++ : fail++;
    if (c === "fallback-v1" || c === "cap-v1") v1++;
    process.stdout.write(r.status === 200 ? (c === "fallback-v1" || c === "cap-v1" ? "1" : "+") : "x");
  }
}));
console.log(`\nok=${ok} fail=${fail} fallback-v1=${v1}`);
