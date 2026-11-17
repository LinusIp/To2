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
