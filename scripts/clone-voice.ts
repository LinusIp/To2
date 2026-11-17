// Clone a tutor voice on VoiceLab (POST /v1/voice-enrollments) and store the voice_id in config.
//
//   node scripts/clone-voice.ts --character lola --file docs/voice-recordings/lola.wav \
//        --gender female --age young --consent [--dry-run] [--no-denoise]
//
// Requirements (docs.voicelab.uz/api/voice-cloning, checked against our account on 2026-11-18):
// - ONE speaker, 10–30 s of speech (longer is rejected), ≤ 10 MiB; WAV/MP3/M4A/WebM are accepted.
// - `consent_accepted=true`: the VOICE OWNER accepted https://voicelab.uz/terms and agreed that their
//   voice is cloned. We pass it only with --consent, after the team has that agreement in writing.
// - Paid plan only; max 5 custom voices per account; ≤ 5 enrollments per hour.
// - The language is fixed per clone (uz). The voice is private to our account.
// On success the new voice_id replaces the character's entry in src/lib/ai/index.ts (DEFAULT_VOICES)
// and in cloudflare.config.ts (VOICE_IDS). The API key is read from .dev.vars and never printed.
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

// print errors as one line (no stack trace) and exit non-zero
const die = (e: unknown) => {
  console.error("error:", e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
};
process.on("uncaughtException", die);
process.on("unhandledRejection", die);

const args = process.argv.slice(2);
const opt = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (k: string) => args.includes(`--${k}`);

const character = opt("character") ?? "";
const file = opt("file") ?? "";
if (!character || !file) {
  console.error("usage: node scripts/clone-voice.ts --character <id> --file <sample.wav> --consent [--gender male|female] [--age young|middle-aged|old] [--dry-run]");
  process.exit(2);
}
const gender = opt("gender");
const age = opt("age");
if (gender && !["male", "female", "neutral"].includes(gender)) throw new Error("--gender must be male, female or neutral");
if (age && !["young", "middle-aged", "old"].includes(age)) throw new Error("--age must be young, middle-aged or old");

// ---- local checks (before spending an enrollment) ----
const MAX_BYTES = 10 * 1024 * 1024;
const size = statSync(file).size;
if (size > MAX_BYTES) throw new Error(`${file} is ${(size / 1048576).toFixed(1)} MiB; the limit is 10 MiB`);
const bytes = readFileSync(file);
const ext = path.extname(file).toLowerCase();
if (ext === ".wav") {
  const sec = wavSeconds(bytes);
  console.log(`sample: ${sec.toFixed(1)} s, ${(size / 1024).toFixed(0)} KiB`);
  if (sec < 10 || sec > 30) throw new Error(`the sample must be 10–30 s of speech (got ${sec.toFixed(1)} s). Trim it and try again.`);
} else console.log(`sample: ${(size / 1024).toFixed(0)} KiB (${ext}; length is checked by VoiceLab)`);

if (!flag("consent")) {
  console.error("Refusing to upload without --consent: the voice owner must accept https://voicelab.uz/terms and agree to the clone.");
  process.exit(3);
}

const vars = Object.fromEntries(
  readFileSync(".dev.vars", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);
const KEY = vars.VOICELAB_API_KEY;
if (!KEY) throw new Error("VOICELAB_API_KEY missing in .dev.vars");
const BASE = (vars.VOICELAB_BASE_URL || "https://api.voicelab.uz").replace(/\/+$/, "");
const H = { Authorization: `Bearer ${KEY}` };

const caps = (await (await fetch(`${BASE}/v1/voice-enrollments/capabilities`, { headers: H })).json()) as Record<string, unknown>;
console.log("capabilities:", JSON.stringify(caps));
if (caps.eligible === false || caps.available === false) throw new Error("This account can't clone voices right now (needs an active paid plan).");

if (flag("dry-run")) console.log("dry run: checks passed, nothing uploaded.");
else await enroll();

async function enroll() {
const fd = new FormData();
fd.append("audio", new Blob([bytes]), path.basename(file));
fd.append("language", "uz");
fd.append("name", `To2 ${character}`);
fd.append("consent_accepted", "true");
fd.append("description", `To2 tutor voice for ${character}`);
fd.append("remove_noise", flag("no-denoise") ? "false" : "true");
const labels: Record<string, string> = { language: "uz" };
if (gender) labels.gender = gender;
if (age) labels.age = age;
fd.append("labels", JSON.stringify(labels));

console.log("uploading… (VoiceLab allows up to ~3 minutes)");
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 200_000);
const res = await fetch(`${BASE}/v1/voice-enrollments`, { method: "POST", headers: H, body: fd, signal: ctrl.signal });
clearTimeout(timer);
const body = (await res.json().catch(() => ({}))) as { voice_clone?: { voice_id?: string; id?: string; status?: string; reference_transcript?: string }; error?: { code?: string; message?: string } };
if (res.status !== 201 || !body.voice_clone?.voice_id) {
  console.error(`enrollment failed: HTTP ${res.status} ${body.error?.code ?? ""} ${body.error?.message ?? ""}`);
  if (res.status === 402) console.error("→ voice cloning needs an active paid VoiceLab plan.");
  if (res.status === 409) console.error("→ the account already has 5 custom voices; delete one first.");
  if (res.status === 422) console.error("→ check: one speaker only, 10–30 s, clear speech.");
  process.exit(1);
}
const voiceId = body.voice_clone.voice_id;
console.log(`cloned: ${voiceId} (enrollment ${body.voice_clone.id}, ${body.voice_clone.status})`);
console.log(`VoiceLab heard: "${body.voice_clone.reference_transcript ?? ""}"`);

// ---- store the voice_id in config ----
const setIn = (f: string, re: RegExp, line: (old: string) => string) => {
  const src = readFileSync(f, "utf8");
  if (!re.test(src)) {
    console.warn(`! ${f}: no entry for ${character}; add it by hand: ${voiceId}`);
    return;
  }
  writeFileSync(f, src.replace(re, line));
  console.log(`updated ${f}`);
};
const esc = character.replace(/[-]/g, "\\-");
setIn("src/lib/ai/index.ts", new RegExp(`(\\n\\s*"?${esc}"?: )"voice_[^"]*",[^\\n]*`), (m) => m.replace(/"voice_[^"]*",.*$/, `"${voiceId}", // cloned ${new Date().toISOString().slice(0, 10)} (scripts/clone-voice.ts)`));
setIn("cloudflare.config.ts", new RegExp(`("${esc}": )"voice_[^"]*"`), (m) => m.replace(/"voice_[^"]*"/, `"${voiceId}"`));
console.log("Next: listen to /api/tts?voice=" + character + "&text=Salom! — then commit and deploy.");
}

function wavSeconds(b: Buffer): number {
  if (b.toString("ascii", 0, 4) !== "RIFF") throw new Error("not a WAV file");
  let off = 12;
  let byteRate = 0;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4);
    const n = b.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = b.readUInt32LE(off + 16);
    if (id === "data") return Math.min(n, b.length - off - 8) / byteRate;
    off += 8 + n + (n & 1);
  }
  throw new Error("WAV has no data chunk");
}
