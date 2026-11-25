// Pre-generate TTS for the demo lessons + common phrases, so the live demo never waits on TTS.
// Usage: node scripts/warm-tts.mjs [baseUrl] [--dry-run] [--max-credits=5000] [--yes] [--list]
//   --dry-run prints what is uncached + its cost and generates nothing; a real run refuses to spend
//   more than --max-credits (default 5,000) without --yes. WARM_VOICES=ziyo limits the tutors.
// It calls our own /api/tts, which caches every phrase (KV now, R2 later).
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const base = process.argv.slice(2).find((a) => a.startsWith("http")) ?? "https://to2.locallabs-io.workers.dev";
const LIST_ONLY = process.argv.includes("--list"); // print the phrases, synthesize nothing
const out = path.join(os.tmpdir(), "to2-lessons.mjs");
await build({
  stdin: {
    contents: `export { DEMO_LESSONS, mockInterrupt } from "@/lib/ai/mock/lessons";
      export { nextSkill, DIAG_LENGTH } from "@/lib/learning/diagnostic";
      export { generateProblem, seeded } from "@/data/problems";
      export { speakMath } from "@/lib/ai/speakMath";
      export { CHARACTERS } from "@/config/characters";`,
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
const { DEMO_LESSONS, mockInterrupt, nextSkill, DIAG_LENGTH, generateProblem, seeded, speakMath, CHARACTERS } = await import("file://" + out);

/**
 * Every diagnostic question a learner of `grade` can reach: the server picks the next skill from the
 * answers so far and seeds the problem with (1000 + grade + 31·answered), so walking every
 * right/wrong path gives the complete set. Spoken through speakMath(), like the diagnostic page does.
 */
function diagnosticQuestions(grade) {
  const out = new Set();
  const seen = new Set();
  const walk = (history) => {
    const key = JSON.stringify(history);
    if (seen.has(key)) return;
    seen.add(key);
    const skill = nextSkill(grade, history);
    if (!skill || history.length >= DIAG_LENGTH) return;
    const p = generateProblem(skill, seeded(1000 + grade + history.length * 31));
    out.add(speakMath(p.q));
    walk([...history, { skillId: skill, correct: true }]);
    walk([...history, { skillId: skill, correct: false }]);
  };
  walk([]);
  return [...out];
}
const DIAG_GRADES = (process.env.DIAG_GRADES ?? "6").split(",").map(Number); // the demo picks 6-sinf
// MVP: only the playable tutors (the others are "Tez orada")
// WARM_VOICES=ziyo,lola → only those tutors
const voices = (process.env.WARM_VOICES ?? "blokbek,lola,ziyo").split(",").map((v) => v.trim()).filter(Boolean);
/** phrases carry their emotion: the server picks speed + speech tag per emotion (src/lib/ai/prosody.ts) */
const phrases = new Map(); // key → { text, emotion, lead }
const add = (text, emotion = "neutral", lead = false) => phrases.set(`${emotion}|${lead}|${text}`, { text, emotion, lead });
for (const l of Object.values(DEMO_LESSONS)) for (const s of l.segments) add(s.say, s.emotion);
mockInterrupt("Nega maxrajlarni oltiga keltirdik?", "frac-add-unlike").forEach((s, i) => add(s.say, s.emotion, i === 0));
const COMMON = [
  ["Deyarli! Yana bir bor o'ylab ko'r.", "encouraging"],
  ["Hechqisi yo'q, yana urinib ko'r!", "encouraging"],
  ["Yaqin qolding! Doskaga qara.", "encouraging"],
  ["Hechqisi yo'q! Xohlasang, ko'rsatib beraman.", "encouraging"],
  ["Tushunarli bo'ldimi? Davom etamizmi?", "encouraging"],
  ["Hmm… yaxshi savol! Hozir ko'rsataman.", "thinking"],
  ["Qiziq savol! Qani, o'ylab ko'raylik…", "thinking"],
  // while a line's voice is being made (engine.ts WAIT_FILLERS), and the last-resort notice (DELAY_LINE)
  ["Hmm…", "thinking"],
  ["Qani, o'ylab ko'raylik…", "thinking"],
  ["Bir daqiqa…", "thinking"],
  ["Ovozim biroz kechikmoqda, yozib ko'rsataman.", "encouraging"],
  // live answers that can't be answered (src/lib/ai/answers.ts): never a canned explanation
  ["Hozir juda ko'p savol berildi, bir daqiqadan keyin qayta so'rang.", "encouraging"],
  ["Kechirasan, hozir javob bera olmadim. Savolingni yana bir bor ber.", "encouraging"],
];
// "Ko'rsatib ber" reveals the answer of each demo-lesson question (spoken via speakMath, as the player does)
for (const l of Object.values(DEMO_LESSONS))
  for (const s of l.segments) if (s.expect) COMMON.push([speakMath(`To'g'ri javob: ${s.expect.answer}. Keling, davom etamiz!`), "encouraging"]);
// spoken diagnostic questions (encouraging, like the diagnostic page)
for (const g of DIAG_GRADES) for (const q of diagnosticQuestions(g)) COMMON.push([q, "encouraging"]);
for (const [t, e] of COMMON) add(t, e);
const list = [...phrases.values()];
if (LIST_ONLY) {  for (const p of list) console.log(`[${p.emotion}${p.lead ? ", lead" : ""}] ${p.text}`);  console.log(`
${list.length} phrases (blokbek: all; lola/ziyo: fractions lesson + ${COMMON.length} common incl. diagnostic)`);  process.exit(0);}
/** fetch with 3 retries (the network sometimes resets long runs) */
async function get(u, init) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(u, init);
      const body = await r.arrayBuffer();
      return { r, body };
    } catch (e) {
      if (i >= 3) return { r: { status: 0, headers: new Headers() }, body: new ArrayBuffer(0) };
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
  }
}
// wait=long: wait for the expressive (lison-v2) version, not the quick v1 stand-in; src=warm labels the spend
const ttsUrl = (v, p) => `${base}/api/tts?voice=${encodeURIComponent(v)}&text=${encodeURIComponent(p.text)}${p.emotion !== "neutral" ? "&emotion=" + p.emotion : ""}${p.lead ? "&lead=1" : ""}&wait=long&src=warm`;
// each tutor's own greeting ("Ovozini eshit" / tapping a tutor, spoken "happy") — from src/config/characters.ts
const GREETINGS = Object.fromEntries(CHARACTERS.filter((c) => c.hi).map((c) => [c.id, c.hi]));
const fracs = DEMO_LESSONS["frac-add-unlike"].segments.map((s) => ({ text: s.say, emotion: s.emotion, lead: false }));
const common = COMMON.map(([text, emotion]) => ({ text, emotion, lead: false }));

// 1. every line to warm, per tutor (Blokbek: everything; others: fractions lesson + common + diagnostic)
const jobs = [];
for (const v of voices) {
  const greet = GREETINGS[v] ? [{ text: GREETINGS[v], emotion: "happy", lead: false }] : [];
  for (const p of v === "blokbek" ? [...list, ...greet] : [...greet, ...fracs, ...common]) jobs.push({ v, p, kind: "demo" });
}
// pinned demo answers (src/lib/ai/pinned.ts): asking through /api/tutor costs no TTS and stores them
// under the interrupt cache key; then their audio exactly as the player asks for it
const DEMO_QUESTIONS = ["Nega maxrajlarni ko'paytirdik?", "Nega maxrajlarni oltiga keltirdik?", "EKUK nima?"];
for (const v of voices)
  for (const question of DEMO_QUESTIONS) {
    const { body } = await get(`${base}/api/tutor`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "interrupt", skillId: "frac-add-unlike", characterId: v, grade: 6, question, segment: "", board: [], history: [] }),
    });
    const text = new TextDecoder().decode(body);
    const src = [...text.matchAll(/event: meta\r?\ndata: (.*)/g)].map((m) => JSON.parse(m[1]).source).join(",");
    if (src !== "pinned") console.warn(`! ${v} · ${question}: source=${src} (expected pinned)`);
    const says = [...text.matchAll(/^data: (\{.*\})$/gm)].map((m) => JSON.parse(m[1])).filter((j) => j.say);
    says.forEach((j, i) => jobs.push({ v, p: { text: j.say, emotion: j.emotion ?? "neutral", lead: i === 0 }, kind: "pinned" }));
  }

// 2. dry run: what is not cached yet, and what would it cost (server prices it: chars × 1.5 on lison-v2)
let credits = 0;
const todo = [];
const per = {};
{
  const q = [...jobs];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (q.length) {
      const j = q.shift();
      const { r, body } = await get(ttsUrl(j.v, j.p) + "&check=1");
      if (r.status !== 200) continue;
      const c = JSON.parse(new TextDecoder().decode(body));
      if (!c.cached) {
        todo.push(j);
        credits += c.credits;
        per[j.v] ??= { lines: 0, chars: 0, credits: 0 };
        per[j.v].lines++;
        per[j.v].chars += c.chars;
        per[j.v].credits += c.credits;
      }
    }
  }));
}
console.log(`${jobs.length} lines × tutors → ${todo.length} not cached, ≈ ${Math.round(credits)} credits`);
for (const [v, x] of Object.entries(per)) console.log(`  ${v}: ${x.lines} lines, ${x.chars} chars, ≈ ${Math.round(x.credits)} credits`);
const MAX = Number(process.argv.find((a) => a.startsWith("--max-credits="))?.split("=")[1] ?? 5000);
if (process.argv.includes("--dry-run")) {
  fs.rmSync(out, { force: true });
  process.exit(0);
}
if (credits > MAX && !process.argv.includes("--yes")) {
  console.error(`✘ ${Math.round(credits)} credits is over --max-credits=${MAX}: ask first, then re-run with --yes`);
  fs.rmSync(out, { force: true });
  process.exit(2);
}

// 3. generate the missing ones, 2 at a time (more parallel lison-v2 jobs slow VoiceLab down and get lost)
let ok = 0, fail = 0, v1 = 0; // v1 = got a v1 stand-in (v2 not ready in time, or over the daily cap)
{
  const q = [...todo];
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (q.length) {
      const j = q.shift();
      const { r } = await get(ttsUrl(j.v, j.p));
      const c = r.headers.get("x-tts-cache");
      if (r.status === 200) ok++;
      else fail++;
      if (c === "fallback-v1" || c === "cap-v1") v1++;
      process.stdout.write(r.status === 200 ? (c === "hit" ? "." : c === "fallback-v1" || c === "cap-v1" ? "1" : "+") : "x");
    }
  }));
}
console.log(`\nok=${ok} fail=${fail} fallback-v1=${v1}`);
fs.rmSync(out, { force: true });
