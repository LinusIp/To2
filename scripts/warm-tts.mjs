// Pre-generate TTS for the demo lessons + common phrases, so the live demo never waits on TTS.
// Usage: node scripts/warm-tts.mjs [baseUrl]   (default: the production URL)
// It calls our own /api/tts, which caches every phrase (KV now, R2 later).
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const base = process.argv[2] ?? "https://to2.locallabs-io.workers.dev";
const out = path.join(os.tmpdir(), "to2-lessons.mjs");
await build({
  entryPoints: ["src/lib/ai/mock/lessons.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  alias: { "@": path.resolve("src") },
  logLevel: "silent",
});
const { DEMO_LESSONS, mockInterrupt } = await import("file://" + out);
const voices = ["blokbek", "agent-shox", "lola", "ziyo", "sardor", "ravshan", "diyorbek", "shadow"];
const phrases = new Set();
for (const l of Object.values(DEMO_LESSONS)) for (const s of l.segments) phrases.add(s.say);
for (const s of mockInterrupt("Nega maxrajlarni oltiga keltirdik?", "frac-add-unlike")) phrases.add(s.say);
for (const p of [
  "Deyarli! Yana bir bor o'ylab ko'r.",
  "Hechqisi yo'q, yana urinib ko'r!",
  "Yaqin qolding! Doskaga qara.",
  "Hechqisi yo'q! Xohlasang, ko'rsatib beraman.",
  "Tushunarli bo'ldimi? Davom etamizmi?",
  "Yaxshi savol! Hozir ko'rsataman.",
  "Qiziq savol! Bir soniya o'ylab olay.",
  "To'g'ri javob: 6. Keling, davom etamiz!",
  "To'g'ri javob: 2. Keling, davom etamiz!",
]) phrases.add(p);
const list = [...phrases];
console.log(`${list.length} phrases × ${voices.length} voices → ${base}`);
let ok = 0, fail = 0;
// each tutor's own greeting ("Ovozini eshit" on the choose-tutor screen)
const GREETINGS = {
  blokbek: "Salom! Men Blokbek. Matematikani blokma-blok quramiz!",
  "agent-shox": "Agent Shox. Har bir masala — bu missiya. Rejani tuzamiz.",
  lola: "Salom, men Lola. Xato qilsang ham qo'rqma — birga tushunamiz.",
  ziyo: "Men Ziyo! Doim so'rayman: nega? Keling, birga bilib olamiz!",
  sardor: "Sardor. Qisqa va aniq: mantiq bilan yechamiz.",
  ravshan: "Ravshan — tez hisob ustasi. Sizga sirli usullarni o'rgataman!",
  diyorbek: "Diyorbek. Har bir formulaning ortida haqiqiy hayot bor.",
  shadow: "Sirli masalalar seni kutmoqda…",
};
for (const v of voices) {
  // Blokbek is the demo character: warm everything. Others: warm the fractions lesson only.
  const greet = GREETINGS[v] ? [GREETINGS[v]] : [];
  const mine = v === "blokbek" ? [...list, ...greet] : [...greet, ...DEMO_LESSONS["frac-add-unlike"].segments.map((s) => s.say), "Yaxshi savol! Hozir ko'rsataman.", "Qiziq savol! Bir soniya o'ylab olay.", "Tushunarli bo'ldimi? Davom etamizmi?"];
  for (const text of mine) {
    const u = `${base}/api/tts?voice=${encodeURIComponent(v)}&text=${encodeURIComponent(text)}`;
    const r = await fetch(u);
    const c = r.headers.get("x-tts-cache");
    if (r.status === 200) ok++;
    else fail++;
    await r.arrayBuffer();
    process.stdout.write(r.status === 200 ? (c === "hit" ? "." : "+") : "x");
  }
}
console.log(`\nok=${ok} fail=${fail}`);

// Warm the LLM answers (KV cache) + their audio for the demo questions (CLAUDE.md §15 step 5).
const DEMO_QUESTIONS = ["Nega maxrajlarni ko'paytirdik?", "Nega maxrajlarni oltiga keltirdik?", "EKUK nima?"];
for (const question of DEMO_QUESTIONS) {
  const r = await fetch(`${base}/api/tutor`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "interrupt", skillId: "frac-add-unlike", characterId: "blokbek", grade: 6, question, segment: "", board: [], history: [] }),
  });
  const text = await r.text();
  const says = [...text.matchAll(/^data: (\{.*\})$/gm)].map((m) => JSON.parse(m[1]).say).filter(Boolean);
  for (const say of says) {
    const a = await fetch(`${base}/api/tts?voice=blokbek&text=${encodeURIComponent(say)}`);
    await a.arrayBuffer();
    process.stdout.write(a.status === 200 ? "+" : "x");
  }
  console.log(` ${question} → ${says.length} segments`);
}
fs.rmSync(out, { force: true });
