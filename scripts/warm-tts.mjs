// Pre-generate TTS for the demo lessons + common phrases, so the live demo never waits on TTS.
// Usage: node scripts/warm-tts.mjs [baseUrl]   (default: the production URL)
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
      export { speakMath } from "@/lib/ai/speakMath";`,
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
const { DEMO_LESSONS, mockInterrupt, nextSkill, DIAG_LENGTH, generateProblem, seeded, speakMath } = await import("file://" + out);

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
const voices = ["blokbek", "lola", "ziyo"];
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
console.log(`${list.length} phrases × ${voices.length} voices → ${base}`);
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
const ttsUrl = (v, p) => `${base}/api/tts?voice=${encodeURIComponent(v)}&text=${encodeURIComponent(p.text)}${p.emotion !== "neutral" ? "&emotion=" + p.emotion : ""}${p.lead ? "&lead=1" : ""}&wait=long`; // wait for the expressive (lison-v2) version, not the quick v1 stand-in
let ok = 0, fail = 0, v1 = 0; // v1 = got the quick v1 stand-in (v2 not ready in time)
// each tutor's own greeting ("Ovozini eshit" on the choose-tutor screen, spoken "happy")
const GREETINGS = {
  blokbek: "Salom! Men Blokbek. Matematikani blokma-blok quramiz!",
  lola: "Salom, men Lola. Xato qilsang ham qo'rqma — birga tushunamiz.",
  ziyo: "Men Ziyo! Doim so'rayman: nega? Keling, birga bilib olamiz!",
};
const fracs = DEMO_LESSONS["frac-add-unlike"].segments.map((s) => ({ text: s.say, emotion: s.emotion, lead: false }));
const common = COMMON.map(([text, emotion]) => ({ text, emotion, lead: false }));
for (const v of voices) {
  // Blokbek is the demo character: warm everything. Others: the fractions lesson + common phrases.
  const greet = GREETINGS[v] ? [{ text: GREETINGS[v], emotion: "happy", lead: false }] : [];
  const mine = v === "blokbek" ? [...list, ...greet] : [...greet, ...fracs, ...common];
  // 2 at a time (more parallel lison-v2 jobs slow VoiceLab down and get lost)
  const q = [...mine];
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (q.length) {
      const p = q.shift();
      const { r } = await get(ttsUrl(v, p));
      const c = r.headers.get("x-tts-cache");
      if (r.status === 200) ok++;
      else fail++;
      if (c === "fallback-v1") v1++;
      process.stdout.write(r.status === 200 ? (c === "hit" ? "." : c === "fallback-v1" ? "1" : "+") : "x");
    }
  }));
}
console.log(`
ok=${ok} fail=${fail} fallback-v1=${v1}`);

// Pinned demo answers (src/lib/ai/pinned.ts) for every playable tutor: ask through /api/tutor (which also
// stores them in KV under the interrupt cache key), then warm their audio exactly as the player asks for it.
const DEMO_QUESTIONS = ["Nega maxrajlarni ko'paytirdik?", "Nega maxrajlarni oltiga keltirdik?", "EKUK nima?"];
for (const v of voices) {
  for (const question of DEMO_QUESTIONS) {
    const { body } = await get(`${base}/api/tutor`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "interrupt", skillId: "frac-add-unlike", characterId: v, grade: 6, question, segment: "", board: [], history: [] }),
    });
    const text = new TextDecoder().decode(body);
    const src = [...text.matchAll(/event: meta\r?\ndata: (.*)/g)].map((m) => JSON.parse(m[1]).source).join(",");
    const says = [...text.matchAll(/^data: (\{.*\})$/gm)].map((m) => JSON.parse(m[1])).filter((j) => j.say);
    for (const [i, j] of says.entries()) {
      // same URL the lesson player uses: emotion + the short pause before the first answer segment
      const { r: a } = await get(ttsUrl(v, { text: j.say, emotion: j.emotion ?? "neutral", lead: i === 0 }));
      const c = a.headers.get("x-tts-cache");
      if (c === "fallback-v1") v1++;
      process.stdout.write(a.status === 200 ? (c === "hit" ? "." : c === "fallback-v1" ? "1" : "+") : "x");
    }
    console.log(` ${v} · ${question} → ${says.length} segments (source=${src})`);
  }
}
console.log(`fallback-v1 total=${v1}`);
fs.rmSync(out, { force: true });
