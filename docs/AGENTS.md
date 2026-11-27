# Agents working on Buddy (formerly Ilmobod / To2)

Snapshot: **2026-11-25**. Written by the current orchestrator from each session's last turns, its branch and its diff.
Production: **https://to2.locallabs-io.workers.dev**, live commit **`9fbd1e1`** (P1 + P2 complete; P3: TutorHero `8c87d18`, UI clean-up `56a9ee0`, games part 1 `9fbd1e1`; Juftini top + G5 still open).
`main` is at `d287dfe` and later; the commits after `8bf833a` are docs, the pitch deck PDF and README only, so nothing is waiting to deploy.

> **Name check:** the pitch deck (`buddy-pitch-deck.pdf`) and the README link say **Buddy**. The app itself still says **Ilmobod**
> (`src/config/brand.ts`, `src/i18n/uz.ts`), and code, URLs, the worker and D1 still say `to2`. Renaming the app means editing `brand.ts`
> (plus the hoodie art, which shows "[To2]" in the team's Blender renders). Nobody owns this rename yet.

---

## How to hand off (read this first if you are the next orchestrator)

1. **Read, in this order:** this file → `REPORT.md` (the newest sections are at the bottom; "🔀 Integration release" and
   "🔁 HANDOFF" are the orchestrator's) → `CLAUDE.md` → the memory notes (`one-deployer`, `kv-write-cap`, `code-freeze`).
2. **See who is alive:** `list_sessions` (include archived). To read a session's last turns, use `list_events` with `limit: 4–12`.
   The session ids are in the table below.
3. **Releasing:** only the orchestrator deploys, and only through `node scripts/release.mjs`.
   - **Gotcha:** the script starts with `git pull --rebase origin main`. If your branch holds merge commits that aren't on `origin/main`
     yet, the rebase replays them one by one and fails. First merge `origin/main` into your branch, then
     `git push origin HEAD:main` (it must be a fast-forward). After that, run the script.
   - The script then tests, builds from a clean worktree, deploys, and checks `/version` against HEAD.
   - **Rollback target:** the last known-good commit is `8bf833a` (before that, `70985d2`).
4. **Checks after a release, all free:**
   - `curl …/version`
   - `node scripts/demo-check.mjs 1 --no-gen=blokbek,lola,ziyo` (it plays cached lines only; expect 72/72 `cached-v2`)
   - the routes `/home`, `/towns`, `/games`, `/fan/ingliz` and `/fan/fizika`
   - Do **not** run `prod-check-answers.mjs` or any `warm-*.mjs` without a credit budget from the user: they spend VoiceLab credits.
5. **Budget rules:**
   - VoiceLab: no generation unless the user grants a number for that day; always dry-run (`check=1`) first.
   - KV: writes are capped at 1,000/day, so use the D1 `kv_store`.
   - Never touch secrets, including `GEMINI_API_KEY`, `VOICELAB_API_KEY` and Cloudflare tokens.
6. **Merging feature work:**
   - Merge with `--no-ff` and keep both sides of a conflict.
   - Conflicts usually show up in `REPORT.md`, `src/app/globals.css`, `src/components/ui/AppShell.tsx`, `src/i18n/uz.ts` and
     `src/components/lesson/LessonPlayer.tsx` (see "Overlaps").
   - Run `pnpm vitest run`, `pnpm tsc --noEmit` and `pnpm build` after each merge.
   - For e2e, start your **own** dev server on another port with no `.dev.vars`, so it runs in mock mode and spends 0 credits, then run
     `E2E_BASE=http://localhost:<port> pnpm e2e`. **Never reuse :5173**: that is the main checkout's server, which has the real key.
7. **Update this file** whenever an agent starts, finishes or changes branch.

---

## Agents

Status key: **active** = running or has work in flight · **done** = finished, work merged · **blocked** = waiting on something ·
**archived** = retired (stopped, context full or superseded; the app may still list it).
At this snapshot **no session is running** except the current orchestrator, and every feature branch is merged into `main` and live.

| # | Old title → **final session title** (renamed in the app 2026-11-25) | Session id | Branch / worktree | Status |
|---|---|---|---|---|
| 1 | main agent 2 → **To2-Orchestrator v2 · release (current)** | `local_490d08cd…` | `claude/to2-integration-release-3ff198` · `.claude/worktrees/to2-integration-release-3ff198` | active |
| 2 | main agent → **To2-Orchestrator v1 (retired)** | `local_48179255…` | `main` · `Desktop/To2` (the main checkout) | archived |
| 3 | AI Math Tutor mockups → **To2-Core · original build (retired)** | `local_e5dea886…` | `main` · `Desktop/To2` | archived ⚠️ |
| 4 | Tutor animation: springs + state machine → **To2-Tutor · animation** | `local_590813f3…` | `main` · `Desktop/To2` | done |
| 5 | UI polish for kids learning game → **To2-UI · design system & brand** | `local_da4f7361…` | `feat/ui-polish` · `worktrees/ui-polish-kids-game-79ea75` (PR LinusIp/To2#1, merged) | done |
| 6 | Mind map and personalized roadmap → **To2-Roadmap · planner (duplicate)** | `local_76d430f4…` | `claude/mind-map-personalized-roadmap-685f5f` (no commits; it delegated to #7) | done ⚠️ |
| 7 | Mind map + personalized roadmap (feat/roadmap) → **To2-Roadmap · towns & mind map** | `local_52b3c9ac…` | `feat/roadmap` · checked out in **`Desktop/To2-roadmap`**, not in its own worktree `sweet-cray-31a608` | done ⚠️ |
| 8 | Multi-subject engine with Physics demo → **To2-Subjects · physics & engine** | `local_9050a48f…` | `feat/subjects-2` · `worktrees/multi-subject-physics-demo-a72871` | done |
| 9 | language → **To2-Subjects · English course** | `local_0af84270…` | `feat/languages` · `worktrees/multi-subject-physics-demo-eae58d` (misleading folder name) | done ⚠️ |
| 10 | O'yinlar (Games) tab → **To2-Games · arena & careers** | `local_32b4f583…` | `feat/games` · `worktrees/oyinlar-games-tab-dacd57` | done |
| 11 | Inklyuziv rejim: To2 accessibility → **To2-Access · inclusive mode** | `local_c07e1fd4…` | `feat/inclusive` · `worktrees/to2-inclusive-accessibility-bc99f9` | done |
| 12 | Ilmobod pitch update → **To2-Pitch · story & docs** | `local_ccdd7d76…` | `docs/pitch-numbers` · `worktrees/ilmobod-pitch-update-fecf04` (local branch `pitch-ilmobod`) | done |
| 13 | Restore chats from folder → **To2-Ops · chat restore** | `local_99ee1f0f…` | `claude/restore-chats-folder-8b734a` (no code changes) | done |
| 14 | *(new 25 Nov)* → **To2-3D · tutor re-export** | `local_c0055ed5…` | `fix/3d-reexport` · own worktree | done |

### 1 · Orchestrator · integration & release *(current)*
- **Responsible for:** merging the feature branches, the cross-feature wiring, the single release, production checks, and this file.
  It is the only agent allowed to deploy.
- **Last finished (18 Nov):** merged all 7 branches plus their follow-ups. Wired English in (subject tile, skills, pinned "To be"
  demo, prompt flavour). Made the games use the physics and English banks and the real skill ids. Pointed the towns header at
  `brand.townsHeader`. Added per-subject greeting captions. Released `8bf833a`. Production checks passed. Updated `story.md`.
- **Next:** this report. After that, nothing is planned; it is waiting for the user. The open items are under "Open items".
- **Owns:** `REPORT.md` (the integration and handoff sections), `docs/AGENTS.md`, `src/config/subjects.ts` (the English entry),
  `src/lib/ai/mock/lessons.ts` (the `DEMO_LESSONS` registry), `src/app/api/games/route.ts` (the shared bank), and the merge resolutions
  in the files listed under "Overlaps".

### 2 · Orchestrator v1 · demo lock-down *(archived, context full)*
- **Responsible for:** pre-demo hardening on `main`: demo lock-down, phone-test bugs 1–4, the TTS budget caps, releases up to
  `70985d2`.
- **Last finished:** the REPORT.md HANDOFF (`1c2fda4`) and the budget note "no VoiceLab generation for the rest of today"
  (`6e6a352`). It then stopped for v2 to take over.
- **Next:** none. Retired. Its session is still listed and not archived in the app.
- **Owned:** `scripts/release.mjs`, `scripts/demo-check.mjs`, `scripts/prod-check-answers.mjs`, `src/lib/ai/pinned.ts`, the TTS budget
  code, and `src/app/api/tutor/route.ts` (answer sources).

### 3 · Core · original build ⚠️
- **Responsible for:** the original one-day build and the mockups: the board, the tutors, the lesson engine, the AI loop, the
  diagnostic and the roadmap. It started #2 and #4. Late in its life it was also releasing and fixing bugs ("tutor stops mid-answer").
- **Last finished:** a production bug investigation (17 Nov, late), which ended on a failed Worker log tail.
- **Next:** none known.
- **Owned:** most of `src/` before 18 Nov.
- **⚠️ Unsure:** it is not marked archived. It acted as a de facto orchestrator *before* #2 and also deployed, which breaks the
  one-deployer rule if it is ever resumed. **Archive it, or never resume it.**

### 4 · Tutor · animation
- **Responsible for:** the 3D voxel tutor's animation: springs, a state machine, lip-sync and IK.
- **Last finished:** commit `0738233`, live in production. The user skipped the live 60 fps check (noted in REPORT.md).
- **Next:** none.
- **Owns:** `src/components/characters/anim/` (animator + tests), `src/components/characters/TutorCanvas.tsx`, `src/app/dev/tutor/` (bench), `src/lib/board/tip.ts`.

### 5 · UI · design system & brand
- **Responsible for:** the kids-game design system (tokens, 3D buttons, cards, motion, skeletons, toasts) and the user-facing
  rebrand from To2 to Ilmobod.
- **Last finished:** `d2944cc` (Ilmobod rebrand: `brand.ts`, title, manifest, wordmark, splash, Android name), merged and live.
- **Next:** none. ⚠️ It is the natural owner of the **Buddy** rename, which no one has done yet.
- **Owns:** `src/config/brand.ts`, `src/components/ui/` (Card, Progress, CountUp, Skeleton, States, Toast, icons), `src/i18n/uz-ui.ts`,
  the design tokens in `src/app/globals.css`, `public/manifest.webmanifest`, `mobile/` (app name), and the onboarding, progress,
  settings and tutors pages.

### 6 · Roadmap · planner ⚠️
- **Responsible for:** planning the mind map and personal path. It spawned #7 to do the building.
- **Last finished:** reported #7's first push (`54d2a10`: the path engine and the `/map` mind map).
- **Next:** none.
- **Owns:** nothing directly.
- **⚠️ Duplicate:** it covers the same task as #7. Archive it.

### 7 · Roadmap · towns & mind map ⚠️
- **Responsible for:** the personal learning path, the "Aql xaritasi" mind map (`/map`), and the **course towns**: one voxel town per
  course, where each building is a quest.
- **Last finished:** `a31f9d2`, real town art for all 3 towns, with Fizika and Ingliz tili playable. Merged and live.
- **Next:** none.
- **Owns:** `src/app/{map,town,towns,roadmap}/`, `src/components/{roadmap,town}/`, `src/lib/learning/` (path, town),
  `src/lib/client/town.ts`, `src/config/towns.ts`, `src/data/curricula.ts`, `public/ui/town-*`.
- **⚠️ Odd setup:** the session's own worktree (`sweet-cray-31a608`) sits unused at `15b3846`. The real work was done in a separate
  clone-like folder, `Desktop/To2-roadmap`. To pick this work up again, use `Desktop/To2-roadmap`.

### 8 · Subjects · physics & multi-subject engine
- **Responsible for:** the subject registry, the Fizika course (grade 7 skills, lessons, the pinned "Tezlik" demo, a 27-question bank)
  and "Istalgan mavzu" (any topic, beta). It also fixed the tutor bugs (distinct live answers, the 12 s voice wait, restart on the
  main board, the tutor standing beside its writing).
- **Last finished:** `5137567`, merged and live. Its interrupt cache key is now `int:v4:<subject>:…`.
- **Next:** none. Known open issue: "Istalgan mavzu" boards show the topic twice.
- **Owns:** `src/config/subjects.ts`, `src/config/mathTopics.ts`, `src/data/skills.ts`, `src/data/skills.fizika.uz.json`,
  `src/data/questions.fizika.ts`, `src/app/fan/`, `src/lib/ai/prompts/tutor.uz.ts`, `src/lib/ai/interruptKey.ts`, `src/lib/ai/mock/physics.ts`,
  and parts of `src/lib/lesson/engine.ts` and `src/components/characters/anim/animator.ts`.

### 9 · Subjects · English course ⚠️ — what "language" actually does
- **What it really is:** despite the title "language" and the folder name `multi-subject-physics-demo-eae58d`, it built **one course:
  English (Ingliz tili, Beta)**, taught in Uzbek. It does not translate the app UI and adds no Russian or Karakalpak; the UI is still
  Uzbek only. Its first prompt never arrived, so it assumed "one language = English".
- **What it built:**
  - **The course:** a 9-skill English graph for grades 5–7 (alphabet → pronouns → to be → articles → plurals → have got → Present Simple
    → Present Continuous → Past Simple).
  - **The pinned lesson "To be: am / is / are":** explained in Uzbek with English on the board. In the `say` text, the English words are
    spelled the way the Uzbek voice reads them ("ay em", "iz").
  - **Voice:** 33 voice lines warmed for Blokbek, Lola and Ziyo (≈ 3,266 VoiceLab credits on 18 Nov).
  - **Practice:** 4-choice exercises for all 9 skills, plus `EN_PAIRS` (16 word pairs used by the memory game).
  - **Pronunciation:** an English pronunciation route, `/api/english/say`, using **Gemini TTS** (server-side and cached), with a 🔊 button
    for each English phrase in a lesson.
- **Status:** done, merged and live, but **pronunciation is switched off** in production because `GEMINI_API_KEY` is not set as a Worker
  secret. `/api/english/say?check=1` returns `enabled:false`, and the 🔊 buttons stay hidden.
- **Next:** none. To turn pronunciation on, a human runs `pnpm wrangler secret put GEMINI_API_KEY`. The Gemini model name was never
  checked against Google's docs; `GEMINI_TTS_MODEL` overrides it.
- **Owns:** `src/config/courses/english/`, `src/lib/english/`, `src/app/api/english/`, `src/components/lesson/EnglishSay.tsx`,
  `scripts/warm-english.mjs`, `scripts/english-shots.mjs`.
- **⚠️ Overlap history:**
  - It first started its own multi-subject engine, which was #8's job. That attempt is parked on the **local-only** branch
    `wip/subjects-parked-eae58d` (`5b90537`, never pushed). **Delete it or ignore it; don't merge it.**
  - It also edited shared files: `getSkill` in `src/data/skills.ts`, `generateProblem` in `src/data/problems/index.ts`, and
    `LessonPlayer.tsx`.
  - It is the only agent that spent VoiceLab credits on 18 Nov besides the two orchestrators.

### 10 · Games · arena & career missions
- **Responsible for:** the O'yinlar tab (Blok minorasi, Tezkor hisob, Juftini top), Kasb sinovi (5-step career missions), the
  `openQuest(kind, skillId)` launcher, and the optional `maxP` mastery cap in `recordAnswer`.
- **Last finished:** `b888900`, merged and live. The orchestrator later swapped its placeholder skill ids for real ones and connected
  the physics and English banks.
- **Next:** none.
  - ⚠️ The games don't listen for inclusive mode's `to2:voice` events yet.
  - ⚠️ Don't make games submit on voice `answer` while they run on the quiz page, or the answer is submitted twice.
- **Owns:** `src/app/games/`, `src/components/games/`, `src/lib/games/`, `src/app/api/games/`, `src/data/careers.uz.json`, and `maxP` in
  `src/lib/server/repo.ts`.

### 11 · Access · inclusive mode
- **Responsible for:** Inklyuziv rejim: voice-first mode, live captions, hands-free voice commands, high contrast, big targets, calm
  mode, a dyslexia-friendly font, and the `/qulaylik` presets.
- **Last finished:** `2ff9681`: voice commands are sent as the `to2:voice` window event (next, prev, open, back, continue, home,
  answer n). Merged and live.
- **Next:** none.
  - Real phone speech recognition was never tested.
  - Its browser checks were not re-run after the last change. The orchestrator's e2e run passed afterwards.
- **Owns:** `src/lib/a11y/`, `src/components/a11y/`, `src/app/qulaylik/`, `docs/INCLUSIVE.md`, `docs/demo-inclusive.md`,
  `e2e/a11y.spec.ts`, the contrast colours (`--color-blue #2a5ce8`, `--color-mut #5f6787`), and the `html[data-*]` blocks in
  `globals.css`.

### 12 · Pitch · story & docs
- **Responsible for:** the pitch documents: the story, the script, business, pedagogy, legal, mentor Q&A and the stack.
- **Last finished:** `979c995` (the Ilmobod story, merged). The orchestrator later rewrote `story.md` to say everything is live.
- **Next:** none in the repo. ⚠️ The **Buddy** pitch deck PDF was uploaded to `main` by hand through GitHub (`d287dfe`), outside any
  agent. The markdown docs still say Ilmobod.
- **Owns:** `docs/pitch/`, `docs/ARCHITECTURE.md`.

### 13 · Ops · chat restore
- **Responsible for:** a one-off: copying the 12 To2 chats into the Claude account the app now uses, after an account switch hid them.
- **Last finished:** copied the 12 session files. They appear only after a full restart of the Claude app; this was not confirmed.
- **Next:** none. It can delete the copies if asked.
- **Owns:** no repo files. It wrote only to `AppData\Local\Claude-Data\…\claude-code-sessions\`.

---

## 🛠️ Dispatch — 25 Nov problem report (checked at `d287dfe`)
Every agent works on a **new branch from `main` (`8061293`)** in its own worktree. Only the orchestrator merges and releases.

| Session | Fix ids | Branch | Priority / status |
|---|---|---|---|
| #14 To2-3D · tutor re-export | M1–M5, M8, then M7 (portrait re-light) — Blender job; writes `docs/3d/reexport-steps.md` if Blender isn't reachable | `fix/3d-reexport` | P1 — ✅ released in `2cfde8f` (3 tutors ~30k tris, 0 non-manifold, 54 AgX portraits) |
| #5 To2-UI · design system & brand | U1 (5 tabs, Mukofotlar → Profil), U2 + C8 (shared bottom padding), C1 (greet on tap), C2 (bubble fallback + static greeting files, **no generation**), C3 (warm/export scripts read `characters.ts`) | `fix/ui-p1` | P1 — ✅ released in `2cfde8f` |
| #5 (second batch) | C6, U3, U4, U6, G5/U7 (decimal comma outside games), C5 + C7 (page side) | `fix/ui-p3` | P3 — ✅ released in `56a9ee0` |
| #4 To2-Tutor · animation | M6 (lighting / tone mapping), lesson smoothness (memo stage, stroke cache, isolated chalk filter, adaptive pixel ratio), C4 (3D tutor driver for the picker) | `fix/tutor-render` (needs a worktree — it used the main checkout before) | P2 ✅ · P3 ✅ released in `8c87d18` (TutorHero component, back button over the head) |
| #10 To2-Games · arena & careers | Kasb sinovi scenes + ≥ 2 more jobs per subject (P2); G1–G4, G6, G7, G5 inside games (P3) | `feat/games-scenes` | P2 ✅ · P3 part 1 ✅ released in `9fbd1e1` (tower + race); Juftini top + G5 in progress on `feat/games-p3` |
| #11 To2-Access · inclusive mode | real text scaling, voice-first + hands-free in games, motor → untimed, typed board, self-hosted Lexend, profile-card UI | `feat/inclusive-2` | P2 — ✅ released (`2cfde8f`), typed board released in `4d3f272` |

**Ownership rules for P3 (27 Nov):**
- #4 builds `TutorHero` (live 3D tutor) and never edits the picker pages; #5 places it in TutorPicker after it's merged.
- #10 may change `GameKit.tsx` / Choices for G3, but must keep #11's hooks (`GameVoice`, `to2:voice` answers, memory "karta N", untimed mode, calm mode) and a11y/inclusive2 e2e green.
- Decimal comma: #10 inside `src/components/games` + `src/lib/games`; #5 everywhere else.
- Games use full-body renders, not the live 3D tutor.

**Ownership rules for this round (P1/P2):**
- `AppShell.tsx` belongs to #5 only.
- `LessonPlayer.tsx` / `ClassroomStage.tsx`: #4 goes first (smoothness); #11 asks the orchestrator before editing them.
- `TutorCanvas.tsx` belongs to #4; #5 only places it on the picker page.
- `Board.tsx` belongs to #4 this round (stroke cache, filter groups). #11's typed-board option comes after, sequenced by the orchestrator.
- `GameKit.tsx` / Choices (game input) belongs to #11 for voice answers; #10 stays in the mission and scene components and data.
- `src/lib/audio/player.ts`: #5 fixed the greeting race (C2) there; nobody else edits it this round.

**Facts checked by the orchestrator:**
- The Kasb sinovi skill ids are already the real ones on `main` (`fiz-*`, `en-*`; fixed 18 Nov). The report is wrong there. Only scenes and more jobs remain.
- C2: the 3 selectable tutors' greetings ARE cached in production (`lison-v2`, 0 credits).
- The 5 locked tutors' greetings: the user approved 242 credits; #5 spent exactly 242 (checked on `/dev/credits`) and they're live in `5334c0e`. **Nothing else in this round may spend VoiceLab credits.**

## Overlaps and conflicts

| Shared file / area | Agents that edit it | Risk / rule |
|---|---|---|
| `REPORT.md` | all | Always conflicts. Keep both sides and append your own section; never rewrite others'. |
| `src/app/globals.css` | 5 (tokens), 7 (mind map), 10 (games), 11 (a11y + contrast) | The contrast colours from 11 win over 5's. Keep each block separate. |
| `src/components/ui/AppShell.tsx` (tab bar, ScreenTop) | 5, 7, 10, 11, 1 | 6 tabs: Bosh sahifa · Darslar (→ /towns) · O'yinlar · Progress · Mukofotlar · Profil. They must still fit at 375 px. |
| `src/i18n/uz.ts` | 5, 7, 8, 10, 11 | Add keys in your own block (`games`, `a11y`, `town`…). |
| `src/components/lesson/LessonPlayer.tsx` | 8, 9, 11, 1 | This is the hottest file; coordinate before editing it. |
| `src/lib/lesson/engine.ts` | 3, 4, 8, 11 | Engine timing (`VOICE_WAIT_MS`) is 8's; the a11y hooks are 11's. |
| `src/data/skills.ts` / `getSkill` | 8, 9, 1 | The single lookup is `ANY_SKILL_BY_ID` (maths, Fizika and English). Don't add a second one. |
| Fizika and English skill JSON | 8 and 9 own them; 7 **copied** them into `feat/roadmap` | They are identical now. If 8 or 9 changes a skill id, the towns (7) and `careers.uz.json` (10) must change with it. |
| `src/app/api/*` | 7, 8, 9, 10, 2 | Separate routes, so no real conflicts. `api/tutor/route.ts` belongs to 2 and 8. |
| `progress`, `home` and `roadmap` pages | 5, 8, 10, 11 | These were the main merge conflicts. |
| Voice-command contract `to2:voice` | 11 (sender), 7 (towns listen), 10 (not listening) | Possible double submit on the quiz page. |
| Deploying | 1 only (2 and 3 used to) | One deployer. Sessions 2 and 3 must not be resumed for releases. |
| Product name | 5 (`brand.ts`), 12 (docs), the user (Buddy PDF) | The code says Ilmobod and the deck says Buddy. Rename only in `brand.ts` and `uz.ts`. |

## Agents I'm unsure about
- **#3 Core · original build:** it was never archived, it deployed, and it was the first orchestrator. I'm not sure whether the user
  still uses it. Archive it.
- **#6 vs #7:** two sessions for one task. #7 did the work in `Desktop/To2-roadmap`, outside its own worktree, so it is easy to lose
  track of.
- **#9 "language":** misleading title and folder. It built the English course only; it did not translate the UI.
- **Leftovers:** `feat/subjects` (an empty branch, now gone from origin) and `wip/subjects-parked-eae58d` (local only). The worktrees
  `mind-map-personalized-roadmap-685f5f` and `sweet-cray-31a608` sit unused at `15b3846` and can be pruned.

## Open items (no owner yet)
1. **Buddy rename** in the app (`brand.ts`, `uz.ts`, the manifest, the Android name, and the hoodie art "[To2]"). Natural owner: #5.
2. **`GEMINI_API_KEY`** Worker secret, so English pronunciation turns on. This needs a human.
3. The games don't listen for `to2:voice` (#10 and #11).
4. "Istalgan mavzu" topic shown twice; an LLM lesson's first heading can sit under the phone toolbar (#8).
5. Archive the finished sessions (2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13) once the user agrees, and prune the unused worktrees.
