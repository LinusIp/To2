# REPORT — agent build log

**Live URL:** https://to2.locallabs-io.workers.dev  ·  Repo: `origin/main`

## Final summary (17 Nov 2026)

**What works (live, real VoiceLab):**
- Landing → onboarding (1 tap with defaults) → adaptive diagnostic (8 q.) → personal roadmap (list + React Flow graph) → lesson → practice → profile. Teacher panel `/teacher` (sample data) for task #4.
- Lesson: Blokbek/Robo-Rayhon/Agent Shox/Chaqmoq speak Uzbek (VoiceLab TTS) while the chalkboard draws in sync; captions always shown; answers checked by mathjs; XP, streak, confetti.
- **Barge-in:** mic (push-to-talk, Space on desktop) or typed question → lesson freezes → VoiceLab STT → LLM answer streamed as SSE segments → drawn in an orange note panel + highlights → *Davom et* resumes at the exact audio position / chalk command; *Yana tushuntir* re-explains more simply.
- Verified live: STT transcribed a VoiceLab Uzbek clip exactly ("Nega maxrajlarni ko'paytirdik?", ~4 s); LLM interrupt answer ~6–10 s uncached, ~2 s cached; LLM lesson first segment ~7 s then ~1 s per segment; TTS ~0.8–2.8 s uncached, cached afterwards.
- 29 vitest tests (player state machine, mastery, roadmap, diagnostic, answer checker, board parser/model, demo lessons, generators for all 47 skills).

**How to run locally:** see README (`pnpm install`, copy `.dev.vars.example`, `pnpm dev`). `MOCK_AI=1` → fully offline demo (no voice, captions + timers).

**What is mocked / simplified:**
- `MOCK_AI=1` mode only (production uses real VoiceLab).
- Teacher panel uses generated sample class data (labelled "Namuna ma'lumot").
- The 4 core lessons (fractions, 2-step equation, percentages, rectangle area) are hand-written and served instantly; other skills are LLM-generated (cached 7 days) with a canned fallback.

**Demo script (CLAUDE.md §15) — prepared:**
1. Phone → landing → *Boshlash* → grade 6 + Blokbek (pre-selected) → *Diagnostikani boshlash*.
2. Diagnostic starts with *1/2 + 1/4*; answer it wrong, the rest right → roadmap: *Maxrajlari har xil kasrlarni qo'shish* = **Hozir · Zaif nuqta**.
3. *Darsni davom ettirish* → *Darsni boshlash* → Blokbek explains 1/2 + 1/3 with fraction bars (voice pre-cached).
4. Hold mic: *"Nega maxrajlarni ko'paytirdik?"* → filler "Yaxshi savol!…" → cached answer + voice (pre-warmed by `scripts/warm-tts.mjs`).
5. Answer the 3 in-lesson questions (6, 2, 3/4) → lesson done → *Mashqqa o'tish* → one correct practice answer → node turns green (0.4 → 0.55 → 0.66 → 0.75 → lesson finish 0.81 → practice 0.86).
6. Same URL on tablet/laptop.
- Before the demo: run `node scripts/warm-tts.mjs` once (idempotent) and do a dry run on the demo phone (mic permission prompt!).

## ★ Design update — re-skin + voxel tutors (17 Nov, evening) ✅
Per CLAUDE.md "★ Design update" and `docs/prototypes/`:
- **App UI = `mobile-app.html`**: light lavender/white, blue primary `#2f6bff`, Nunito 700–900, white cards r22, bottom tabs **Bosh sahifa · Darslar · Progress · Sozlamalar** (sidebar on ≥768 px). All 8 prototype screens exist: splash `/`, home `/home`, lesson `/lesson/[id]`, tutors `/tutors`, progress `/progress`, quiz style in `/diagnostic` + `/practice/[id]`, "A'lo!" success screen, settings `/settings`. Onboarding, roadmap (list + React Flow), teacher and privacy re-skinned.
- **8 voxel tutors** (Blokbek, Agent Shox, Lola, Ziyo, Sardor, Ravshan, Diyorbek, Shadow) from `makeChar(cfg)`, ported to TypeScript for three.js r180 (`src/components/characters/voxel.ts`). Free: Blokbek, Agent Shox, Lola · 200/300/400/500 XP · Shadow = 7-day streak. Each has its own VoiceLab voice (Lola female: *Safiya*).
- **Portraits:** `/characters/<id>_<pose>_<frame>.png` if listed in `src/config/characterRenders.json` (generated at build from `public/characters/`), else an in-browser three.js render. The team's 144 Blender renders were picked up automatically; the build also writes WebP copies (3.6 MB vs 28 MB PNG) served via `<picture>`.
- **Lesson stage** = `board-handwriting.html` ported: classroom SVG + chalkboard + live 3D tutor (`TutorCanvas`) who faces the learner while talking, turns his back and walks along the board while writing, right arm follows the chalk tip with 2-bone IK, bends for low rows, lip-syncs from the real TTS amplitude, leans in while listening, hand-to-chin while thinking, cheers on correct answers. Phones get a board-focused crop with a 0.75× tutor.
- **Handwriting engine** (`src/components/board/handwriting.ts`): every board command becomes single-line chalk strokes revealed at hand speed in writing order; per-glyph ±3° / 0.96–1.04 / baseline jitter; fractions stacked by hand; fraction bars shaded with chalk hatching; chalk SVG filter; chalk piece at the tip; chalk-circle highlights; erase = wipe-out. New §5b ops: `strike`, `arrow` (point or target), `tick`, `divider`, `wipe`, `circle{target}`. Writing starts 300 ms after speech. No typeset math on the board any more.
- "Savol berish" = push-to-talk (hold, or tap-to-toggle, Space on desktop) + keyboard; barge-in engine unchanged.
- Backend, engine, VoiceLab, learning logic: unchanged (35 vitest tests).
- **Fix found in the demo run:** an LLM interruption answer contained `erase`, which wiped the main explanation. The board model now lets the note layer erase only its own notes (regression test added).
- Demo re-run on live (phone viewport): splash → onboarding → diagnostic (exact demo path, "A'lo!" at the end) → roadmap shows *Maxrajlari har xil kasrlarni qo'shish* as Hozir · Zaif nuqta → lesson starts, the typed "Nega maxrajlarni ko'paytirdik?" interrupt is answered in ~2.5 s from cache → 3 answers + lesson finish + 1 practice answer → node **O'zlashtirildi** (0.40 → 0.86). TTS warmed for all 8 tutors (149 phrases, 0 failures).
- ⚠️ The final visual pass of the lesson's interrupt → "Davom et" on live could not be completed: the Browser pane was hidden, which pauses `requestAnimationFrame` (the chalk timeline). It was verified earlier on localhost (desktop + phone). **Re-run steps 4–6 on a real phone before judging**, including the mic.
- ⚠️ If the learner switches apps mid-lesson the chalk timeline pauses until the tab is visible again (rAF), by design.
- Team files committed as found: `public/characters/` (144 Blender renders + `blender/` sources, ~51 MB) and `tools/blender/to2_characters.py`.

## ❓ Unclear / assumption — design update
- What: repo `docs/prototypes/*.html` were older than the attached versions (repo `board-handwriting.html` had no `makeChar`). - I assumed: the attached files are current and copied them over. - To change: replace the files.
- Letters: single-stroke glyphs from **EMS Tech** (SIL OFL, via the MIT `hersheytext` package, extracted to `src/components/board/glyphs.json` by `pnpm glyphs`). It reads like teacher handwriting; the prototype's own glyph table covered only ~15 characters.
- Subjects on the home screen map to our curriculum sections (`src/config/subjects.ts`): Algebra, Geometriya, Funksiyalar, Kasrlar, Sonlar (+ "Tez orada: Fizika"). The prototype's "Ehtimollar" has no skills in our graph yet.
- Old characters Robo-Rayhon and Chaqmoq were replaced by the new roster; existing users with them fall back to Blokbek.
- three.js r180 instead of the prototype's r128 (colour management on, lights ×π to match).
- Pose `sig` exists in the Blender set but isn't used by the UI yet.

## Board auto-layout hardening (geo-perimeter) ✅
Team added `src/lib/board/layout.ts` (main-layer auto-layout on the server). Re-running the live geo-perimeter lesson found gaps; fixed and covered by tests on **three real LLM lessons** saved in `src/lib/board/__fixtures__/` (checked against the real chalk strokes, not boxes):
- a handwritten line wider than the board (1055 px) is stepped down l → m → s instead of being left on top of other writing;
- only short labels ("5 sm") stick to a shape; full lines of text next to a shape are their own row;
- labels that cut into their shape — including triangle sides drawn as `line`s — are nudged just outside;
- a rect/circle counts as an annotation only if it surrounds content; lines meeting end-to-end are a polygon (a new diagram), unless they trace an existing shape's outline;
- annotations are matched in the LLM's own coordinates and follow their target when the layout moves it (perimeter lines stay on the rectangle);
- a segment's anchored annotations are obstacles for the rest of that segment.
- ⚠️ The LLM's coordinates collide often, so the layout moves most drawings (15–20 of ~21 per lesson). Readable, but the board may not look exactly as the prompt intended.
- Deploy: `scripts/deploy.mjs` now skips `public/models/raw/`, `public/characters/blender/` and `_*.png` (source art; `models/raw/blokbek.glb` is 61 MB, over Cloudflare's 25 MiB asset limit).
- Push identity pinned: `origin` push URL is `https://LinusIp@github.com/LinusIp/To2.git` (Git Credential Manager only holds LinusIp).

## 🔑 Team must provide / decide
- [x] VoiceLab key — `.dev.vars` (local) + Wrangler secret on Worker `to2`.
- [x] Base URL `https://api.voicelab.uz`, language `uz`, model `aisha-gemma-4` (from docs + live API).
- [ ] **Listen to the 4 voices** and change if needed (`cloudflare.config.ts` → `VOICE_IDS`; current picks below).
- [ ] **Enable R2** in the Cloudflare dashboard (account returned code 10042). Then `pnpm wrangler r2 bucket create to2-audio` and uncomment `AUDIO` in `cloudflare.config.ts`. Until then TTS audio is cached in KV (works fine, 60-day TTL).
- [ ] Real numbers for `docs/pitch/business.md` (students, tutor prices, VoiceLab TTS/STT prices) — all marked `TODO(team)`.
- [ ] Lawyer review of `docs/pitch/legal.md` and `/maxfiylik`; teacher review of the skill graph.
- [ ] Optional: `npx cf auth login` so `pnpm deploy:cf` (official vinext deploy) works; today `pnpm deploy` uses wrangler.

## ⚠️ Known issues
- STT is async (job + polling) → ~3–4 s after releasing the mic. VoiceLab has a realtime WebSocket STT (stretch).
- Uncached LLM answers take 6–10 s; we cover the gap with a spoken filler and a thinking character; repeated questions are cached.
- The preview pane used for testing blocks the microphone, so push-to-talk was verified via the STT API round-trip and typed questions, not a physical mic. **Do a real-phone mic test before the demo.**
- The answer key for practice/lesson questions is sent to the client (needed for offline checking); fine for a hackathon, not for graded tests.
- vinext prints `INEFFECTIVE_DYNAMIC_IMPORT` / sourcemap warnings during build — harmless.
- shadcn/ui was not installed: the chunky block UI from the mockups is built directly with Tailwind (see assumption below).
- A teammate's prototype `docs/prototypes/board-handwriting.html` (hand-written chalk) was committed as-is; not wired in.

## Log

### M0 — scaffold ✅
- vinext 1.4 (Next 16 App Router API on Vite 8) via `pnpm create cloudflare --framework=next`, Tailwind v4 tokens, Drizzle schema + `drizzle/0000_init.sql`, D1 `to2` + KV created, deployed.

### M1 — board ✅
- zod contract (`src/lib/ai/schema.ts`), board model (apply / schedule / bbox / fit / note layout), SVG renderer (rough.js strokes with dash-offset animation, chalk fractions, KaTeX fallback, number line, fraction bar, plot via mathjs, highlight), 4 hand-written demo lessons.

### M2 — characters + TTS ✅
- 4 layered pixel-SVG characters (Blokbek + Agent Shox from the mockups; Robo-Rayhon + Chaqmoq new, original): bob, blink, mouth from Web Audio amplitude, pointing arm, thinking, celebrate + block confetti. `/api/tts` with cache.

### M3 — real AI loop ✅
- STT (async job polling), LLM streaming with incremental JSON segment extraction, zod per segment, retry → canned fallback, barge-in state machine + engine, KV caches, filler phrase.

### M4 — learning engine ✅
- 47-skill graph, generators for every skill, BKT-lite mastery, adaptive diagnostic, roadmap (list + React Flow/dagre).

### M5 — screens ✅
- Landing, onboarding, diagnostic, roadmap, lesson, practice, profile (collection, unlocks, badges, reset), privacy; mobile bottom tabs, tablet rail, desktop sidebar + mini roadmap.

### M6 — hardening ✅ (partly)
- Fallbacks everywhere, Uzbek error messages, rate limits (KV), TTS/LLM warm-up script, final deploy. Not done: automated e2e run of the demo 3× on a physical phone.

### M7 — stretch
- ✅ `/teacher` heatmap + one-click printable practice set (sample data). ❌ parent report, Telegram login, stylus scratchpad, Russian UI.

## ❓ Unclear / assumption — M0: config format
- What: C3 now scaffolds **`cloudflare.config.ts`** (new `cf` CLI config) instead of `wrangler.jsonc`, and `vinext-cloudflare deploy` uses the `cf` login (not logged in here; `wrangler` is).
- I assumed: keep `cloudflare.config.ts` as the source of truth; `pnpm deploy` = `vite build` + `scripts/deploy.mjs` (converts the build's `worker.config.json` → `.cloudflare/deploy/wrangler.json` → `wrangler deploy`).
- To change: after `npx cf auth login`, use `pnpm deploy:cf`.

## ❓ Unclear / assumption — M0: migrations
- What: no `wrangler.jsonc` to drive `wrangler d1 migrations apply`.
- I assumed: `src/db/client.ts` runs idempotent `CREATE TABLE IF NOT EXISTS` (mirrors `drizzle/0000_init.sql`) once per isolate; `pnpm db:migrate:remote` applies the SQL explicitly.
- To change: switch to `wrangler d1 migrations apply` if a wrangler config is adopted.

## ❓ Unclear / assumption — VoiceLab (verified against docs.voicelab.uz + live API)
- Auth `Authorization: Bearer vlk_…`, base `https://api.voicelab.uz/v1`. SDK not used (plain fetch, small bundle).
- TTS `POST /v1/tts` `{text, language:"uz", voice_id}` → WAV 24 kHz; **no word timestamps → proportional sync rule** (CLAUDE.md §3).
- STT `POST /v1/stt` multipart (`audio`, `language=uz`, UUID `Idempotency-Key`) → always 202 → poll `/v1/stt/transcriptions/{id}`.
- LLM `POST /v1/chat/completions` (OpenAI-compatible, SSE streaming). Models on our key: `aisha-gemma-4` (chosen: fast, `reasoning` off by default), `aisha-orbit`, `aisha-halo`, `aisha-muon`. No documented JSON mode → prompt + few-shot + zod; it follows the format well. Requesting `aisha-comet` silently served `aisha-gemma-4`.
- Voices: Blokbek → *Javohir — Bright presenter*; Agent Shox → *Rustam — Anime hero*; Robo-Rayhon → *Gulnoza*; Chaqmoq → *Botir — Bomba streamer*.

## ❓ Unclear / assumption — design
- What: the newer team mockups in `docs/mockups/` (Onboarding, Diagnostic) use a dark navy palette with Fredoka/Manrope, while CLAUDE.md §10 tokens (paper/ink/gold, Pixelify/Nunito/Kalam) match the lesson/roadmap mockups.
- I assumed: CLAUDE.md tokens everywhere (one consistent look); took the newer UX ideas (bridge progress, "Bilmayman — keyin birga quramiz", no-penalty note, locked-tutor silhouettes, "Ovozini eshit").
- To change: tokens are in `src/app/globals.css` `@theme`.
- shadcn/ui not installed — the mockups' chunky block style is simpler to build with plain Tailwind classes (`.btn`, `.btn-primary` in `globals.css`), and it keeps the bundle smaller. Radix can be added for dialogs/menus later.

## ❓ Unclear / assumption — learning
- Target users grades 5–9 (age 10–15); skill graph covers grades 5–8 (9th-grade nodes TODO with a teacher).
- Each skill has 1–3 parameterised templates (randomised → unlimited problems) instead of "≥5 fixed problems".
- Diagnostic: a miss sets mastery 0.4 (weak), a hit 0.86, prerequisites of a hit ≥ 0.7. Unmeasured skills below the learner's grade are assumed known when building the roadmap. A finished lesson counts as one more correct observation. Change in `src/lib/learning/*`.
- Characters unlock: Blokbek + Robo-Rayhon free; Agent Shox 150 XP; Chaqmoq 300 XP (`src/config/characters.ts`).
- Note layer: the LLM's note drawings are re-laid out by code into a fixed orange panel (bottom-right) so they never cover the main lesson; the LLM may still `highlight` main elements.
- Extra dev dependency: `esbuild` (only for `scripts/warm-tts.mjs`).

## ✅ Relative board placement (2026-11-18)
- Drawing commands (write/latex/rect/circle/ellipse/numberline/fractionbar/plot) may carry `place` instead of x/y:
  `{row:"next"}` (new line under everything), `{row:"same"}`, `{rightOf|leftOf|below|above: "<id>"}`.
  Parsed in `src/lib/ai/schema.ts` (also accepts `place:"next"` and the keys at top level), resolved to x/y in
  `mainLayouter()` (`src/lib/board/layout.ts`) before the collision pass, which stays as the safety net.
  Text rows left-align under text; labels centre on shapes. A full board wraps to the top → layouter wipes (new page).
- Prompt: BOARD_SPEC in `src/lib/ai/prompts/tutor.uz.ts` asks for `place` (with a rect + labels example). The few-shot lessons still use x/y.
- Measured (geo-perimeter, aisha-gemma-4, 3 raw lessons): the LLM used `place` on 46/46 placeable drawings.
  Live after deploy (3 fresh lessons): 0 text-on-chalk collisions; only the triangle's own corners touch (expected).
- ⚠️ Not measured: how many drawings the safety-net pass still moves after placement. Line/arrow commands keep absolute coordinates.

## ⚠️ Diyorbek 3D model disabled (2026-11-18)
- `public/models/tripo/diyorbek.glb` shows a green-hooded boy with headphones (Ziyo's look), not Diyorbek's
  lab coat + glasses from his card. Until it is re-exported, Diyorbek uses the `makeChar` voxel rig.
- 🔑 Team: re-export diyorbek.glb, then remove `"diyorbek"` from `DISABLED` in `src/components/characters/glbTutor.ts`.
  ✅ Resolved: that model was Ziyo (now `ziyo.glb`); MVP playable = Blokbek, Lola, Ziyo; Diyorbek is "Tez orada".

## ✅ Tutor animation: smooth and alive (2026-11-18)
- `src/components/characters/anim/animator.ts` drives every tutor (GLB and makeChar). States: idle, talk, listen,
  think, turnToBoard, write, walkAlongBoard, turnToLearner, point, praise; 220 ms ease-in-out crossfades.
- Every joint follows a TARGET with a critically damped spring (`src/lib/anim/spring.ts`): arms 14, elbows 11
  (lag the shoulders), head 10 (+ follow-through on turns), body/root 8, writing arm 22. dt clamped to 1/30 s,
  `renderer.setAnimationLoop`, paused on hidden tabs, nothing allocated per frame (heap flat over 20k frames with forced GC).
- Periodic motion (breathing 2.6 s, weight shift, walk cycle, turn hop, praise jumps, 3 Hz wave) is layered on top
  of the springs with smoothed weights — a k=8 spring would flatten a 380 ms hop to nothing.
- Walk: phase driven by distance moved; stride derived from each rig's hip height so feet don't slide.
- Praise: Blokbek thumbs-up + 2 bounces, Lola wave + head tilt, Ziyo double jump with squash/stretch.
  Emotion from the lesson: excited → bigger gestures + bounce; thinking → hand to chin.
- Lip-sync: envelope 25/90 ms, hysteresis (up .12/.3/.55, down .08/.22/.45), ≥ 60 ms per mouth frame, rest face
  after 150 ms of silence. Blinks 2.5–5 s, 110 ms, 15% double, forced at the start of a turn. Reduced motion: no hops/bobs, instant mouth.
- **Walk first, then write:** the tutor raises `tutorGate.hold` (`src/lib/board/tip.ts`) while it turns to the board or
  walks to a stroke out of reach; the lesson timeline (`engine.ts` tick) freezes until the chalk (forward kinematics)
  is on the tip — capped at 1.6 s so speech and drawing never drift apart.
- Highlights: `boardFocus` (set by the board's Highlight) → the tutor points at the circled element for 1.5 s.
- Measured (headless, `animator.test.ts`, Blokbek rig, scripted lesson at 60 fps), chalk-to-tip while ink is laid:
  phone p50 19.5 / p90 35 stage px, desktop p50 19.7 / p90 44 (≈ 5 CSS px on a phone). This is the cost of the k≈22
  smoothing on glyph corners (~2v/k); the IK aims ahead by the tip's relative velocity, which removes the steady lag.
- `/dev/tutor` (dev only, 404 in production): tutor picker (+ makeChar), a button per state, speed 0.25–1×,
  "Play lesson script" (talk → turn → write 3 strokes → walk → turn back → praise).
- ⚠️ Not verified yet: 60 fps / long frames in the Chrome performance panel and screen captures — the in-app browser
  pane was hidden during this run (requestAnimationFrame stops), so no live frame-time numbers or videos.

## ✅ Expressive tutor voices (2026-11-18)
**Catalog on our key** (`GET /v1/tts/languages`, `GET /v1/voices?language=uz`):
- Models for `uz`: **`lison`** (Lison v1, "Studio Quality", 1 credit/char, default) and **`lison-v2`** (Lison v2, "Expressive",
  1.5 credits/char) with speech tags `happy sad excited angry calm whispering sarcastic neutral laugh sigh gasp cry breath cough
  short pause long pause`. Tag syntax isn't documented; `[excited] …`, `(excited) …` and `<excited> …` all work (none is read
  aloud, checked with STT). We use `[tag]`. Output is always WAV 24 kHz mono. No SSML, no word timestamps.
- 20 uz voices (all `system`): Abdulhay Otaxo'jayev, Amir, Botir, Dilnoza, Firdavs Urinov, Gulnoza, Gulya, Jasur, Javohir, Kamola,
  Lola, Madina, Malika, Nozima, Qora Shoh, Rustam, Safiya, Sardor, Shohruxmirzo, Xurshid. 13 of them also run on lison-v2
  (Amir, Botir, Dilnoza, Gulya, Jasur, Javohir, Kamola, Madina, Malika, Nozima, Qora Shoh, Rustam, Safiya).

**A/B** (2 lines: excited "Voy, barakalla! …" and thinking "Hmm… qani, o'ylab ko'raylik. Nega …?"; 12 candidate voices × both
models = 42 clips; pitch variation in semitones from F0 tracking = proxy for "expressive"; intelligibility = STT round-trip CER):
| voice | model | pitch SD | excited/calm median F0 | CER |
|---|---|---|---|---|
| Rustam | lison-v2 | 5.13 | 247 / 110 Hz | 0.00 |
| Javohir | lison | 4.90 | 153 / 175 Hz | 0.01 |
| Javohir | lison-v2 | 4.64 | 224 / 125 Hz | 0.02 |
| Gulya | lison-v2 | 4.52 | 279 / 190 Hz | 0.01 |
| Madina | lison | 4.44 | 178 / 180 Hz | 0.02 |
| Safiya (old Lola) | lison | 3.15 | 162 / 169 Hz | 0.01 |
v1 sounds the same for both moods (F0 barely moves between lines); v2 + tags really changes the tone by emotion.
**Picks** (in `src/config/characters.ts` → `tts`, voice ids in `src/lib/ai/index.ts` + `cloudflare.config.ts`):
Blokbek = Javohir · lison-v2 · base speed 1.28; **Lola = Gulya (female)** · lison-v2 · 1.22; Ziyo = Rustam · lison-v2 · 1.3.
v2 speaks ~1.4× slower than v1 at speed 1, hence the base speeds > 1. The 42 A/B clips are in the session scratchpad, not in git
— 🔑 team: listen to `docs/voice-samples/*.wav` and adjust voice/speed in config if you prefer another one.

**Speech-ready text**: prompt (`tutor.uz.ts`) asks for 2–3 phrases of ≤ 12 words, `! ? …`, emotion interjections ("Voy!",
"Barakalla!", "Hmm…", "Qani, o'ylab ko'raylik…", "Hechqisi yo'q,"), no symbols/markdown, in the tutor's own style; the 37
demo-lesson lines (also the few-shot examples) were rewritten that way. Fresh LLM lessons (3 tutors): 0 phrases > 12 words,
0 symbols/digits, 4–5 interjections per lesson. ⚠️ one LLM maths slip seen ("beshdan bir yuz" for 5 %) — content, not voice.

**Prosody** (`src/lib/ai/prosody.ts`, tested): split into clips at `. ! ? …` and after a short interjection + comma ("Voy,");
speed = base × emotion (neutral 1, happy 1.06, excited 1.12, encouraging 0.97, thinking 0.9), × 0.95 on a closing question;
v2 tags happy→[happy], excited→[excited], encouraging→[calm]; silences 180 ms after ",", 320 ms after ". ! ?", 450 ms after "…";
250 ms lead-in before the first answer to a learner question. `/api/tts` joins the clips into one WAV (`src/lib/audio/wav.ts`),
so lip-sync still follows the real audio. Every clip is cached in KV by sha256(voice + model + speed + text); the joined
segment is cached too.
**⚠️ Latency → hybrid**: lison-v2 takes **median 6.9 s, p90 11 s per clip** (v1: 0.67 s; 0 of 18 v2 clips under 4.8 s).
So a live request waits only 350 ms for v2 (= cached); on a miss it gets the same lines on **v1 at once** (~1–1.5 s,
`cache-control: no-store`) while v2 finishes in the background (`after()` → waitUntil) and lands in KV. Prefetches of the next
segment (`wait=long`) hold out up to 20 s for v2, so in a running lesson most segments play expressive. Cost of a live miss:
v1 + v2 (2.5 credits/char); warmed phrases cost nothing. `scripts/warm-tts.mjs` now warms with emotions (3 playable tutors).

**Voice cloning** — possible on our plan (`GET /v1/voice-enrollments/capabilities` → eligible, available). `scripts/clone-voice.ts`
(`node scripts/clone-voice.ts --character lola --file lola.wav --gender female --age young --consent`) checks the file, uploads
(`POST /v1/voice-enrollments`, multipart) and writes the new `voice_id` into `src/lib/ai/index.ts` + `cloudflare.config.ts`.
🔑 Requirements for tonight's recordings (from the docs + our account):
- **10–30 s** of speech per tutor (NOT 30–60 s: longer is rejected), ONE speaker, ≤ 10 MiB; WAV/MP3/M4A/WebM all fine.
  Quiet room; lively, varied reading (a question, an exclamation, a calm explanation) — the clone copies the delivery.
- **Consent**: `consent_accepted=true` = the voice owner accepted https://voicelab.uz/terms and agrees to the clone. Get it in
  writing from each speaker (for minors: a parent). The script refuses to upload without `--consent`.
- Paid plan only; **max 5 custom voices per account**; ≤ 5 enrollments/hour; language fixed (uz); clones are private.
- Optional labels: gender (male/female/neutral), age (young/middle-aged/old), accent. `remove_noise` is on by default.
- A cloned voice works on both models; re-check it on lison-v2 after cloning (`x-tts-model` header on /api/tts).

**Samples**: `docs/voice-samples/{blokbek,lola,ziyo}.wav` — one thinking + one excited line from each tutor's fresh LLM lesson,
rendered by the real pipeline on lison-v2 (pitch SD 5.5 / 4.5 / 5.9 semitones; STT reads them back correctly).
