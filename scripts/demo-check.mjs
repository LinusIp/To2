// Walk the live demo path (CLAUDE.md §15) on production, the way the app does it, and log where
// every lesson segment and every audio clip came from.
//
//   node scripts/demo-check.mjs [runs=3] [baseUrl]  → table on stdout + docs/demo-check.json
//
// Segment sources (meta events of /api/tutor): demo · cache · pinned · llm · mock.
// Audio (x-tts-cache of /api/tts): hit / clips = cached v2 · miss / partial = live v2 · fallback-v1.
// Audio requests mirror the player: segment i+1 is prefetched with wait=long while i plays,
// then requested normally when its turn comes (that second request is the one we score).
import fs from "node:fs";

const RUNS = Number(process.argv[2] ?? 3);
const BASE = process.argv[3] ?? "https://to2.locallabs-io.workers.dev";
const TUTORS = ["blokbek", "lola", "ziyo"];
const GREETINGS = {
  blokbek: "Salom! Men Blokbek. Matematikani blokma-blok quramiz!",
  lola: "Salom, men Lola. Xato qilsang ham qo'rqma — birga tushunamiz.",
  ziyo: "Men Ziyo! Doim so'rayman: nega? Keling, birga bilib olamiz!",
};
const FILLERS = ["Hmm… yaxshi savol! Hozir ko'rsataman.", "Qiziq savol! Qani, o'ylab ko'raylik…"];
const QUESTION = "Nega maxrajlarni ko'paytirdik?";

const ttsUrl = (v, text, emotion, lead, prefetch) =>
  `${BASE}/api/tts?voice=${encodeURIComponent(v)}&text=${encodeURIComponent(text)}${emotion && emotion !== "neutral" ? "&emotion=" + emotion : ""}${lead ? "&lead=1" : ""}${prefetch ? "&wait=long" : ""}`;

async function tts(log, step, v, text, emotion, lead = false) {
  const t0 = Date.now();
  const r = await fetch(ttsUrl(v, text, emotion, lead, false));
  await r.arrayBuffer();
  const c = r.status === 200 ? (r.headers.get("x-tts-cache") ?? "?") : `http-${r.status}`;
  const kind = c === "hit" || c === "clips" ? "cached-v2" : c === "miss" || c === "partial" ? "live-v2" : c === "fallback-v1" ? "v1-fallback" : c;
  log.audio.push({ step, kind, ms: Date.now() - t0, text: text.slice(0, 50) });
}
const prefetch = (v, text, emotion, lead = false) => fetch(ttsUrl(v, text, emotion, lead, true)).then((r) => r.arrayBuffer()).catch(() => {});

function sse(text) {
  const ev = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const e = block.match(/^event: (.*)$/m)?.[1];
    const d = block.match(/^data: (.*)$/m)?.[1];
    if (e && d) ev.push({ e, d: JSON.parse(d) });
  }
  return ev;
}

async function playSegments(log, step, v, segs, isNote) {
  for (let i = 0; i < segs.length; i++) {
    const next = segs[i + 1];
    const pf = next ? prefetch(v, next.say, next.emotion) : null;
    await tts(log, step, v, segs[i].say, segs[i].emotion, isNote && i === 0);
    if (pf) await pf; // the next one plays after this one; by then its prefetch has finished
  }
}

async function run(v, n) {
  const log = { tutor: v, run: n, segments: [], audio: [] };
  let cookie = "";
  const api = async (path, body) => {
    const r = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    return r;
  };
  // 1. onboarding: nickname, grade 6, the tutor
  const u = await api("/api/user", { nickname: `Demo${n}`, grade: 6, characterId: v });
  if (u.status !== 200) throw new Error(`onboarding ${u.status}`);
  await tts(log, "greeting", v, GREETINGS[v], "happy");
  // 2. diagnostic (seeded per grade; a fixed answer pattern → the same path every run)
  let p = (await (await api("/api/diagnostic", { action: "start" })).json()).problem;
  for (let i = 0; p && i < 12; i++) {
    await tts(log, "diagnostic", v, p.q.replace(/\s*=\s*\?$/, " nechaga teng?"), "encouraging");
    const answer = p.choices?.length ? p.choices[0] : "0";
    const r = await (await api("/api/diagnostic", { action: "answer", answer })).json();
    p = r.problem;
  }
  // 3. roadmap
  const rm = await api("/api/roadmap");
  if (rm.status !== 200) throw new Error(`roadmap ${rm.status}`);
  // 4. lesson: adding unlike fractions
  const les = sse(await (await api("/api/tutor", { mode: "lesson", skillId: "frac-add-unlike", characterId: v, grade: 6 })).text());
  const lsrc = les.find((x) => x.e === "meta")?.d.source ?? "?";
  const lsegs = les.filter((x) => x.e === "segment").map((x) => x.d);
  log.segments.push({ step: "lesson", source: lsrc, n: lsegs.length });
  await playSegments(log, "lesson", v, lsegs.slice(0, 3), false);
  // 5. the judge asks a question mid-lesson: filler first, then the answer
  await tts(log, "filler", v, FILLERS[n % FILLERS.length], "thinking");
  const int = sse(await (await api("/api/tutor", { mode: "interrupt", skillId: "frac-add-unlike", characterId: v, grade: 6, question: QUESTION, segment: lsegs[2]?.say ?? "", board: [], history: [] })).text());
  const isrc = int.find((x) => x.e === "meta")?.d.source ?? "?";
  const isegs = int.filter((x) => x.e === "segment").map((x) => x.d);
  log.segments.push({ step: "question", source: isrc, n: isegs.length });
  await playSegments(log, "question", v, isegs, true);
  // 6. "Davom et" → rest of the lesson (incl. the practice question and praise)
  await playSegments(log, "lesson", v, lsegs.slice(3), false);
  return log;
}

const logs = [];
for (const v of TUTORS)
  for (let n = 1; n <= RUNS; n++) {
    process.stdout.write(`${v} run ${n}… `);
    try {
      const l = await run(v, n);
      logs.push(l);
      const k = (kind) => l.audio.filter((a) => a.kind === kind).length;
      console.log(`segments ${l.segments.map((s) => `${s.step}=${s.source}`).join(" ")} | audio ${l.audio.length}: cached-v2 ${k("cached-v2")}, live-v2 ${k("live-v2")}, v1-fallback ${k("v1-fallback")}`);
    } catch (e) {
      console.log("FAILED", e.message);
      logs.push({ tutor: v, run: n, error: e.message });
    }
  }
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/demo-check.json", JSON.stringify({ at: new Date().toISOString(), base: BASE, logs }, null, 1));

// summary
const rows = logs.filter((l) => !l.error);
const all = rows.flatMap((l) => l.audio);
const pct = (k) => ((100 * all.filter((a) => a.kind === k).length) / Math.max(1, all.length)).toFixed(1);
console.log(`\nAudio clips: ${all.length} — cached-v2 ${pct("cached-v2")}% · live-v2 ${pct("live-v2")}% · v1-fallback ${pct("v1-fallback")}%`);
for (const l of rows) for (const a of l.audio.filter((x) => x.kind !== "cached-v2")) console.log(`  not cached: ${l.tutor}#${l.run} ${a.step} [${a.kind}] ${a.text}`);
const ms = all.filter((a) => a.kind === "cached-v2").map((a) => a.ms).sort((a, b) => a - b);
if (ms.length) console.log(`cached-v2 latency: median ${ms[ms.length >> 1]} ms, p90 ${ms[Math.floor(ms.length * 0.9)]} ms`);
