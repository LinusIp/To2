# CLAUDE.md — To2 · AI Math Tutor in Uzbek

> You are the Claude Code agent building this project **in ONE day** at the National AI Hackathon (Tashkent, Nov 2026).
> Read this whole file before writing code. Follow it as the source of truth.
> If something is unclear, **do not stop** — make the safest assumption, write it down in `REPORT.md`, and keep building (see §12).

Product name: **To2** (temporary — the team will rename it later, so put the name ONLY in `src/config/brand.ts` and `src/i18n/uz.ts`, never hard-code it).

---

## ★ Design update (latest — overrides older design notes below)
The team's final direction is in **`docs/prototypes/`** (read its README):
1. **App UI = `docs/prototypes/mobile-app.html`** — light, friendly mobile design (lavender/white cards, blue primary, coloured subject tiles, bottom tabs). Replaces the dark/brutalist token sets in §10 and in `docs/mockups/`. Desktop/tablet: same components in a centred phone-width column or a 2-column layout; the lesson goes full-width.
2. **Lesson = `docs/prototypes/board-handwriting.html`** — warm classroom, 3D voxel tutor (three.js) that faces the learner when talking, turns to the board and writes stroke-by-stroke (handwriting engine §5b), barge-in via "Savol berish".
3. **Characters = the 8 voxel tutors** built by `makeChar(cfg)` (same file) — replace the layered-SVG characters. Use pre-rendered portraits for UI, live 3D in the lesson. Blender renders will replace portraits later (file-name convention in the README).
Keep all working backend/engine code; this is a front-end re-skin + character swap.

## 0. Official hackathon problem we solve

National AI Hackathon, Tashkent, 17–19 Nov 2026 — task list from the **Ministry of Higher Education, Science and Innovation / Ta'lim va ilm-fan vazirligi** (`docs/hackathon/problems.pdf`):

> **#3 — Shaxsiylashtirilgan o'qitish.** Yechim: *O'zbek tilida ishlaydigan, bilimdagi bo'shliqlarni aniqlab, individual o'quv trayektoriyasi tuzadigan SI-tyutor.*

Map every feature to these three words of the task, and say them in the UI/pitch:
| Task wording | Our feature |
|---|---|
| **O'zbek tilida ishlaydigan** (works in Uzbek) | Uzbek voice in & out (VoiceLab STT/TTS/LLM), Uzbek UI, Uzbek math terms |
| **bilimdagi bo'shliqlarni aniqlab** (finds knowledge gaps) | adaptive diagnostic + mastery model per skill (§7) |
| **individual o'quv trayektoriyasi** (individual learning path) | personal roadmap generated from gaps + prerequisites (§7) |
| **SI-tyutor** (AI tutor) | character that explains step by step, talks and draws on the board |

Neighbouring tasks from the same ministry we touch as **stretch / business story only** (do not build before M6):
- **#4 O'quvchi yordamchisi** (teacher assistant: lesson plans, tasks, tests, reports) → `/teacher` page: class weak-point heatmap + "generate a practice set for this weak skill" button. This is our B2B story.
- **#2** AI agent for students/teachers — our tutor is that agent for math.

## 1. What we are building

A personal AI math tutor that **teaches by talking and drawing**, in **Uzbek (Latin script)**:

1. The learner picks an **animated character** (game-style tutor, see §6) and their grade.
2. A short **adaptive diagnostic** finds their weak points.
3. The app builds a **personal roadmap** (a skill graph like roadmap.sh) — weak skills + their prerequisites, in the right order.
4. In a **lesson**, the character **speaks in Uzbek** (TTS) while **drawing step-by-step on a whiteboard** (formulas, number lines, graphs, shapes). The learner can **interrupt and ask by voice** (STT) or type, and answer practice problems.
5. Mastery updates after every answer → the roadmap re-colours → XP, streaks, character unlocks.

**Goal of the demo:** a judge opens the URL on a phone/tablet/laptop, talks to the tutor in Uzbek, watches it explain *e.g.* "kasrlarni qo'shish" (adding fractions) on the board, and sees their roadmap update.

Target users (assumption — log it): school students **grades 5–9 (age 10–15)** in Uzbekistan, their parents, and schools/tutoring centres.

---

## 2. Tech stack (fixed — do not swap without logging why in REPORT.md)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **vinext** (Next.js 16 App Router API, built on Vite) | Cloudflare's recommended way to run Next.js on Workers. Beta → if you hit a gap, check `npx vinext check` / vinext.dev/compatibility, then log it. |
| Runtime / hosting | **Cloudflare Workers** (+ static assets) | Deploy with `npx @vinext/cloudflare deploy` (or `npm run deploy` if scaffolded with C3). |
| Language | **TypeScript** strict | |
| UI | **Tailwind CSS v4** + **shadcn/ui** (Radix) + **lucide-react** icons | |
| Animation | **motion** (Framer Motion) for UI; **three.js** for the 3D voxel tutor (§6b); SVG stroke animation for the board | |
| Whiteboard | **Custom SVG board** driven by JSON "board commands" (§5) with a **stroke-by-stroke handwriting engine** (§5b) + **rough.js**-style wobbly shapes. No typeset math on the board. | Do NOT use tldraw/Excalidraw (licence + weight + no scripted playback). |
| Graphs on board | Own SVG plotter (axes + `y=f(x)` sampled with **mathjs**) | |
| Math checking | **mathjs** (`evaluate`, `simplify`) to verify learner answers locally — never trust the LLM alone for correctness. | |
| Roadmap view | **@xyflow/react** (React Flow) + **dagre** for auto layout | roadmap.sh look. |
| Database | **Cloudflare D1** (SQLite) + **Drizzle ORM** (`drizzle-orm/d1`, `drizzle-kit` for migrations) | |
| Cache / sessions | **Cloudflare KV** | session → user, rate limits, LLM response cache |
| Audio cache | **Cloudflare R2** | TTS mp3/wav keyed by `sha256(voice+text)` so repeated phrases are free & instant |
| Validation | **zod** (every API input + every LLM JSON output) | |
| State (client) | **zustand** | lesson player state |
| AI — STT / TTS / LLM | **VoiceLab** (voicelab.uz) — Uzbek STT, TTS, LLM (§8), behind adapters in `src/lib/ai/` | Plus `MOCK_AI=1` mode so the demo works offline. |
| Tests | **vitest** for pure logic (mastery, roadmap, board parser, answer checker) | Keep it light — logic only. |
| Package manager | **pnpm** | |

Bindings are accessed in server code with:
```ts
import { env } from "cloudflare:workers"; // env.DB, env.KV, env.AUDIO, env.VOICELAB_API_KEY ...
```
After editing `wrangler.jsonc` run `pnpm wrangler types` to regenerate `worker-configuration.d.ts`.

### Scaffold
```bash
pnpm create cloudflare@latest . --framework=next   # creates a vinext app + wrangler config
# (or, inside an existing Next app: npx vinext check && npx vinext init)
pnpm add drizzle-orm zod zustand motion mathjs katex roughjs @xyflow/react dagre lucide-react
pnpm add -D drizzle-kit vitest @types/dagre
pnpm dlx shadcn@latest init
```

### Cloudflare access (do this FIRST in M0)
1. Run `pnpm wrangler whoami`.
2. If not logged in, **stop and ask the human** to run `pnpm wrangler login` (it opens a browser; a person must approve). Do not try to work around it.
   - Alternative for headless runs: the human creates an API token (Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template + D1 Edit + Workers KV Storage Edit + Workers R2 Storage Edit) and exports `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the shell. Never write these into the repo, `.dev.vars` or REPORT.md, and never echo them.
3. When `whoami` shows the account, create D1/KV/R2 (commands below), paste the returned ids into `wrangler.jsonc`, run migrations (`pnpm wrangler d1 migrations apply to2 --remote`), set secrets (`pnpm wrangler secret put VOICELAB_API_KEY`, value from `.dev.vars`), and deploy.
4. Write the live `*.workers.dev` URL at the top of REPORT.md.

### wrangler.jsonc (bindings to add)
```jsonc
{
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{ "binding": "DB", "database_name": "to2", "database_id": "<fill>" }],
  "kv_namespaces": [{ "binding": "KV", "id": "<fill>" }],
  "r2_buckets":   [{ "binding": "AUDIO", "bucket_name": "to2-audio" }],
  "vars": { "MOCK_AI": "0", "DEFAULT_LOCALE": "uz-Latn" }
}
```
Create resources: `pnpm wrangler d1 create to2`, `pnpm wrangler kv namespace create KV`, `pnpm wrangler r2 bucket create to2-audio`.
Secrets: `pnpm wrangler secret put VOICELAB_API_KEY`. Local secrets go in `.dev.vars` (git-ignored).

---

## 3. Architecture

```
 Browser (mobile / tablet / desktop)
 ┌──────────────────────────────────────────────────────────────┐
 │ LessonPlayer (zustand)                                       │
 │  ├─ Character (SVG + motion, lip-sync from audio amplitude)  │
 │  ├─ Board (SVG, plays BoardCommand[] step by step)          │
 │  ├─ MicButton (MediaRecorder → webm/opus)                    │
 │  └─ AnswerInput (keypad / text / stylus later)              │
 └───────────────▲─────────────────────────┬────────────────────┘
                 │ SSE stream (segments)   │ fetch
 ┌───────────────┴─────────────────────────▼────────────────────┐
 │ Cloudflare Worker (vinext route handlers /app/api/*)         │
 │  /api/stt      → VoiceLab STT adapter                           │
 │  /api/tutor    → builds prompt (skill, mastery, history)     │
 │                  → VoiceLab LLM → zod-validated        │
 │                  LessonSegment JSON → SSE to client          │
 │  /api/tts      → R2 cache hit? return : VoiceLab TTS → R2       │
 │  /api/answer   → mathjs check → update mastery (D1)          │
 │  /api/roadmap  → skill graph + mastery → nodes/edges         │
 │  /api/diagnostic → next adaptive question                    │
 └──────┬──────────────┬──────────────┬─────────────────────────┘
        D1 (Drizzle)   KV (sessions)  R2 (audio cache)
```

### The core loop (one tutor turn)
1. Learner speaks → `MediaRecorder` → `POST /api/stt` (audio blob) → `{ text }`.
2. Client `POST /api/tutor` `{ lessonId, skillId, userText }` → server streams **SSE** events, one per `LessonSegment`.
3. For each segment the client: requests `/api/tts?text=…&voice=…` (starts immediately, cached in R2), then **plays audio and the segment's board commands together**; the character's mouth follows the audio's amplitude (Web Audio `AnalyserNode`).
4. Segment types: `explain` · `ask` (waits for answer) · `hint` · `praise` · `check`.
5. Answer → `POST /api/answer` → mathjs verifies → mastery update → tutor reacts.

### Drawing while talking (sync)
- Each segment's audio and its `board` commands start **together**. The player spreads the commands over the audio duration: each command gets a time slot proportional to its "weight" (`write`/`latex` ≈ text length, shapes ≈ 1, `pause` = its ms), so the chalk is still moving while the character speaks the matching words.
- If VoiceLab TTS returns word timestamps, use them (a command may carry `at: "<word>"` to start on that word); otherwise use the proportional rule. Log which one you used.
- While drawing, a chalk-tip dot follows the stroke and the character "points" at the board.

### Interrupting mid-explanation ("barge-in") — must work in the demo
1. Learner presses the mic (or starts typing) **at any moment** → the player immediately **pauses**: audio stops, board animation freezes at the current command, character switches to `listening`.
2. The question is sent to `/api/tutor` with `mode: "interrupt"` plus context: current skill, the segment the learner stopped at, the **current board state** (list of drawn element ids + their text), and the last 6 turns.
3. The LLM answers the question with 1–3 short segments. Its drawings go on a **separate layer** in a different chalk colour (default `orange`), in free space or a side "note" area, so the main explanation is not destroyed. It may `highlight` existing board elements by id ("this 6 here…").
4. The last segment is always `type: "check"` asking "Tushunarli bo'ldimi? Davom etamizmi?" with buttons **[Davom et]** / **[Yana tushuntir]**.
5. **Davom et** → the orange layer fades to 30% (or is erased), and the main lesson **resumes from the exact command where it paused**. **Yana tushuntir** → another simpler explanation of the question.
6. Off-topic questions → one friendly sentence steering back to math, then resume.
7. Pressing the mic again while the tutor is answering the question interrupts that answer too (same flow, nesting max 1 level).
Implement the player as a small state machine in `src/lib/lesson/player.ts`: `idle → speaking → paused → listening → thinking → answering → (resume) speaking`. Unit-test the transitions with vitest.

Latency rules: stream the first segment ASAP; keep each `say` ≤ 2 sentences so TTS is fast; pre-fetch TTS for the next segment while the current one plays.

---

## 4. LLM contract (the most important part — get this right first)

The LLM must return **JSON only** matching this schema (zod in `src/lib/ai/schema.ts`). Validate; on failure retry once with the error appended; then fall back to a canned segment.

```ts
type LessonSegment = {
  id: string;
  type: "explain" | "ask" | "hint" | "praise" | "check";
  layer?: "main" | "note";   // "note" = interruption answers (drawn on top in orange, removable)
  say: string;               // Uzbek (Latin) text for TTS, ≤ 2 sentences, numbers written so TTS reads them well
  emotion: "neutral" | "happy" | "thinking" | "excited" | "encouraging";
  board: BoardCommand[];     // drawn while `say` is spoken
  expect?: {                 // only for type "ask"
    kind: "number" | "fraction" | "expression" | "choice";
    answer: string;          // canonical, checked with mathjs on the server
    choices?: string[];
  };
};
```

System prompt essentials (store in `src/lib/ai/prompts/tutor.uz.ts`):
- You are {characterName}, a friendly math tutor for a {grade}-grade student in Uzbekistan. Speak **only Uzbek (Latin)**, simple words, short sentences, warm, a little playful in the character's style — but **math must be exact**.
- Teach Socratically: explain one tiny step, draw it, then ask. Never dump the full solution at once.
- Use the board for every step. Coordinates are on a 1000×625 canvas.
- Current skill: {skill.title_uz}; learner mastery {p}; recent mistakes {mistakes}.
- Output: JSON array of LessonSegment, nothing else.

Few-shot examples live in `src/lib/ai/prompts/examples/` (fractions, linear equation, percentages, area of rectangle). Write them by hand — they matter more than the prompt.

---

## 5. Board command language

```ts
type BoardCommand =
  | { op: "write";   id: string; x: number; y: number; text: string; size?: "s"|"m"|"l"; color?: Color }
  | { op: "latex";   id: string; x: number; y: number; tex: string; size?: "s"|"m"|"l"; color?: Color }
  | { op: "line";    id: string; from: [number,number]; to: [number,number]; color?: Color; arrow?: boolean }
  | { op: "rect" | "circle" | "ellipse"; id: string; x: number; y: number; w: number; h: number; color?: Color; fill?: Color }
  | { op: "numberline"; id: string; x: number; y: number; w: number; min: number; max: number; marks?: number[] }
  | { op: "fractionbar"; id: string; x: number; y: number; w: number; parts: number; filled: number; color?: Color }
  | { op: "plot";    id: string; x: number; y: number; w: number; h: number; fn: string; xRange: [number,number]; yRange: [number,number] }
  | { op: "highlight"; target: string; color?: Color }
  | { op: "erase";   target: string | "all" }
  | { op: "pause";   ms: number };
type Color = "ink" | "blue" | "red" | "green" | "orange" | "purple";
```
- Rendered in `src/components/board/` as SVG in a fixed `viewBox="0 0 1000 625"` → scales on every screen.
- Strokes animate in (stroke-dashoffset / rough.js); `write`/`latex` reveal left-to-right. Duration ≈ proportional to the segment's audio length.
- Unknown ops are ignored (log to console), never crash.
- Board has "dark chalkboard" and "light whiteboard" themes.

---

## 5b. The board must write like a REAL tutor (most important UX in the app)

The #1 thing that makes the app feel real or "AI-generated" is the board. **Never show typeset text that appears all at once.** A real tutor writes stroke by stroke with chalk. Working prototype: `docs/prototypes/board-handwriting.html` (open it in a browser). It contains the handwriting engine, the **tutor who faces the learner while talking, turns his back to the board, walks along it and writes with an IK arm that follows the chalk tip**, bends for low rows, and the **interrupt flow** (pause → turn to learner → listen → answer in orange → resume). Port it to React: `src/components/board/` (engine), `src/components/characters/Tutor.tsx` (front/back views, turn, walk, IK), `src/lib/lesson/player.ts` (sequence + pause/resume). Keep its behaviour and timings; replace the placeholder SVG character with the final art parts (front set + back set) when the team delivers them.

**Handwriting engine**
- **Single-stroke glyphs** (centre-line paths, not font outlines) for `0–9 x y a b n + − × · ÷ = ( ) [ ] / < > ² ³ √ π %` and the Uzbek words the tutor writes on the board (`yoki`, `demak`, `javob`, `tekshir`). Start from the prototype's glyph table, add the missing ones. (Option: Hershey single-line fonts, which are public domain, for more glyphs.)
- Each glyph is drawn with `stroke-dashoffset` **at hand speed** (≈ 500 px/s on a 1000-wide board, ×0.85–1.15 random), with 25–70 ms pauses between strokes and longer pauses between tokens, so it looks like real writing.
- **Human imperfection every time:** per glyph rotate ±3°, scale 0.96–1.04, baseline ±2%. The same lesson never looks identical twice.
- **Chalk look:** an SVG filter (`feTurbulence` + `feDisplacementMap` for rough edges, plus a noise mask for small gaps in the chalk). Faint smudges on the board. No digital glow.
- **A chalk piece follows the stroke tip** while writing. The character's arm IK (§6b) points at that same tip.
- Freehand shapes are slightly wobbly: lines bend a little, circles overshoot their closing point, arrows curve, ticks are quick.

**How a tutor uses the board (the LLM board-command prompt must follow these):**
1. Work top-left → down, one step per line, aligned on `=` where possible.
2. Side calculations go in a corner area (right column, behind a faint divider), in yellow.
3. Arrows connect the side calculation to where it is used.
4. **Self-correction is allowed and good:** sometimes write a step, say "to'xta, tekshiramiz", cross it out in orange and write the right one. Use it at most once per lesson, on purpose, at a typical student mistake (sign errors, common denominator).
5. The final answer is in yellow, circled, with a green tick.
6. Speak while writing: start the TTS audio for a segment, then begin drawing 200–400 ms later. Writing time ≈ audio time (§3 sync rules).
7. Erasing: a quick wipe animation, never an instant clear.

New board commands for this (add to §5 `BoardCommand`): `{op:"write", text, x, y, size, color}` (now handwritten, not typeset), `{op:"strike", target}`, `{op:"circle", target}`, `{op:"arrow", from:[x,y]|target, to:[x,y]|target, bend}`, `{op:"tick", x, y}`, `{op:"divider", x}`, `{op:"wipe", area|"all"}`. LaTeX/KaTeX is **not** used on the board: everything is handwritten. KaTeX is allowed only in UI captions if needed.

## 6. Characters (fun layer)

Game-**inspired**, but **100% original** characters — **do not** use Minecraft, Counter-Strike, Roblox, Fortnite etc. names, logos, skins, sounds or assets (trademark/copyright risk, and judges will ask). Keep everything **kid-safe: no weapons, no violence**.

| id | Name | Vibe | Teaching style |
|---|---|---|---|
| `blokbek` | **Blokbek** | voxel teen in a black To2 hoodie (sandbox-game vibe) | "Let's build it block by block" — great for area, volume, fractions-as-blocks |
| `agent-shox` | **Agent Shox** | tactical squad leader with headset & visor (team-shooter vibe, **no weapons**) | "Mission briefing" — problems are missions, steps are objectives |
| `robo-rayhon` | **Robo-Rayhon** | friendly robot (sci-fi vibe) | precise, logical, loves equations |
| `chaqmoq` | **Chaqmoq** | street racer / speedster (racing-game vibe) | speed rounds, mental math |

**Art direction (team reference image).** Cosy **classroom scene** + a **voxel teen tutor** pointing at a big chalkboard, speech bubble at the top, step list on the right, a voice bar at the bottom. Characters look like cool teenagers (age 15–17 vibe), **not kids' cartoons**: block proportions with the head ≈ ¼ of the height, 3D-shaded sides, streetwear, confident expressions, no blush, no bouncing. Never reproduce a known game character (face, skin colours, outfit, tools, textures, fonts). Uzbek identity in details (ikat pattern hem/cuffs, Samarkand-blue tiles in the scene, Uzbek posters).
- **Blokbek** (default) — black To2 hoodie with an **ikat-pattern hem and cuff**, messy dark hair, teal headphones around the neck, white sneakers; friendly confident smile; holds chalk and points at the board.
- **Agent Shox** — tactical jacket + vest, gloves, cyan visor, headset with mic; calm, serious; turns problems into "missions".
- **Robo-Rayhon**, **Chaqmoq** — shown as locked silhouettes in the MVP (unlock by XP).

### Character roster (team design — choose-tutor screen)
All tutors use the **same 3D voxel rig** (§6b); a character is just a config in `src/config/characters.ts`: colours, hair style blocks, outfit textures, one accessory, face details, VoiceLab voice id, personality/teaching style for the LLM prompt, unlock cost.

| id | Name | Tagline (UI) | Look | Teaching style (prompt) | Unlock |
|---|---|---|---|---|---|
| `blokbek` | **Blokbek** | Matematika ustasi | black [To2 hoodie, ikat hem, messy dark hair, teal headphones | friendly, builds solutions "block by block" | free (default) |
| `agent-shox` | **Agent Shox** | Aqlli strateg | dark jacket, dark sunglasses, slicked hair | calm, problems are missions, plans steps first | free |
| `ziyo` | **Ziyo** | Bilimga chanqoq | green hoodie with hood up, big headphones | curious, asks "nega?" a lot, explores | 200 XP |
| `lola` | **Lola** | Mehribon tutor | long dark hair, flower clip, white top + pink vest | warm, patient, encourages after mistakes | free |
| `sardor` | **Sardor** | Mantiq ustasi | black cap, dark jacket, arms crossed | logic-first, short and precise | 300 XP |
| `ravshan` | **Ravshan** | Hisobchi | red/auburn hair, headphones, light jacket | fast mental math, tricks and shortcuts | 400 XP |
| `diyorbek` | **Diyorbek** | Ilmiy yordamchi | glasses, white lab coat | explains the "why", real-world science examples | 500 XP |
| `shadow` | **Shadow** | Maxfiy qahramon | dark purple hood, face hidden, glowing violet eyes | mysterious, riddles; secret reward | hidden: unlock by a 7-day streak |

Rules: keep at least two free characters with different voices, and at least one free female tutor (Lola). **Shadow must not look like any existing game mob** (no tall black body with purple particle eyes, no Enderman look): keep him clearly a hooded teenager. Each character needs its own VoiceLab voice (Lola = female voice). The choose-tutor screen shows the selected tutor large and in 3D (idle animation, waves on select) with name, tagline and a "Ovozini eshit" (hear voice) button; the grid shows the others, with locked ones as silhouettes plus their unlock condition.

Implementation: one SVG per character in `src/components/characters/`, each with states `idle | talking | thinking | happy | celebrate`, driven by `emotion` + an `isSpeaking` amplitude value (0–1) for the mouth. Character config (`name`, `voiceId`, `catchphrases_uz[]`, colours) in `src/config/characters.ts`. Unlocks: Blokbek & Robo-Rayhon free; others unlocked by XP.

---

## 6b. Scene & animation (2D, must feel smooth and alive)

**Decision (updated):** 2D scene layers (SVG room + SVG chalk board) **+ the tutor as a real-time 3D voxel model in three.js** on a transparent canvas above the board (orthographic camera mapped 1:1 to the 1600×900 scene, so chalk-tip coordinates feed the arm IK directly). The character is ~20 boxes with canvas pixel-textures (face, hoodie print, hair), warm key light + cool fill + rim, ACES tone mapping, colours converted sRGB→linear. Turning to the board is a real Y-rotation; mouth/blink are redrawn on the 16×16 face texture. See `docs/prototypes/board-handwriting.html` — it already runs at 60 fps. Add `three` (r128+ or current) to the stack; render the canvas only while the lesson screen is visible. Target look = the team's reference render: voxel teen tutor in a cosy classroom, big chalkboard, speech bubble, step list, bottom voice bar. Target performance: **60 fps on a mid-range Android, ≤ 2 s first load on 4G**.

### Scene layers (back → front), all absolutely positioned in one 16:9 stage that scales to fit
1. `bg` — painted classroom per character world (WebP ≤ 200 KB, plus a blurred 20 KB placeholder).
2. `board` — our SVG board (§5) placed exactly over the chalkboard area of the background (store its rect in % per background in `src/config/scenes.ts`).
3. `character` — the rigged character (below).
4. `ui` — speech bubble, step list, XP, bottom voice bar (HTML).
5. `fx` — one `<canvas>` for particles (chalk dust, block confetti).
Mobile portrait uses the same layers recomposed: board on top full-width, character smaller bottom-left overlapping, bubble beside it, voice bar at the bottom.

### Character = cut-out rig, NOT pose swapping
**Two views are required:** `front` (talking to the learner, pointing at the board) and `back` (facing the board while writing; we see the back of the head and the hoodie, and the right arm is a separate IK arm). Turning = squash scaleX 1→0, swap view, 0→1 (≈250 ms total). While writing the tutor stands about 265 px left of the chalk tip and walks smoothly as the tip moves, bending (scaleY ≥ 0.8) for low rows. Whenever he talks without writing, he turns to face the learner.

Swapping whole images looks choppy. Instead the character is cut into parts (easy for a voxel character — the parts are boxes):
`torso`, `head`, `hair/hat`, `upperArmL/R`, `foreArmL/R + hand` (right hand holds chalk), `legs`, eyes (`open`, `half`, `closed`), brows, mouths (`closed`, `small`, `open`, `wide`, `smile`, `o`).
Parts are transparent PNG/WebP (render them from Blender or cut from an AI image) or simple SVG boxes, each with a pivot point in `src/config/characters.ts`. Animate ONLY `transform` and `opacity` (GPU) with **motion** springs:
- **Idle (never frozen):** breathing (torso scaleY 1→1.012, 3.5 s loop), slight head sway (±1.5°), random **blink** every 2.5–5 s (120 ms).
- **Talking / lip-sync:** Web Audio `AnalyserNode` on the TTS audio → smoothed amplitude (attack 30 ms, release 90 ms) → choose mouth `closed/small/open/wide`; head nods slightly on loud syllables.
- **Pointing at the board:** 2-bone IK (upper arm + forearm, ~30 lines of math) so the chalk hand **follows the chalk tip** while the board draws. Smoothed with a spring so it never snaps.
- **Emotions** from `segment.emotion`: brows + mouth + small body pose blend (happy = bounce + smile, thinking = hand to chin + eyes up, excited = jump 6 px + block-confetti, encouraging = nod).
- **Listening** (mic open): leans 2° toward the learner, eyebrows up, eyes follow the mic wave.
- **Thinking** (waiting for AI): taps chalk on the board / scratches head, small "..." in the bubble — this covers the 1–3 s AI wait.
- Every state change crossfades over 150–250 ms; nothing jumps.
(Optional upgrade if a teammate can animate: author the same rig in **Rive** with a state machine and drive inputs `talking`, `amplitude`, `emotion`, `pointX/Y` — same interface, `src/components/characters/Rig.tsx` stays the API.)

### Board animation
- Strokes draw with `stroke-dashoffset` and ease-out; text/LaTeX reveals left→right with a mask that moves **with the chalk tip**; tiny chalk-dust particles at the tip; 1–2 px hand jitter so it looks hand-drawn.
- Highlight = chalk circle drawn around the element; erase = quick wipe animation.

### Ambient life (subtle)
- 2–3 px parallax drift between `bg`, `board`, `character` on idle; dust motes in the window light; step list items slide in as the tutor reaches them; XP counts up; correct answer = block-confetti + a short sound.

### Performance rules
- Only `transform`/`opacity` animations, `will-change` on the rig parts, one rAF loop for lip-sync + IK + particles, no layout reads inside it.
- Max ~150 particles; pause everything when the tab is hidden.
- Preload the next scene + character parts; images sized for 2× DPR max.
- Test with Chrome DevTools CPU throttling 4× and a real cheap Android before the demo. Respect `prefers-reduced-motion` (keep lip-sync, drop parallax/particles).

## 7. Learning engine (roadmap + weak points)

### Skill graph
`src/data/skills.uz.json` — a DAG of math skills aligned to Uzbekistan's school math curriculum, grades 5–9. Each node:
```json
{ "id": "frac-add-unlike", "title_uz": "Maxrajlari har xil kasrlarni qo'shish", "grade": 5,
  "prereqs": ["frac-equivalent", "lcm"], "section": "Kasrlar" }
```
Start with ~30–40 skills in sections: Natural sonlar · Bo'linish va EKUK/EKUB · Kasrlar · O'nli kasrlar · Foizlar · Manfiy sonlar · Ifodalar · Chiziqli tenglamalar · Geometriya (perimetr, yuz) · Koordinatalar va grafiklar. Each skill needs ≥ 5 templated problems in `src/data/problems/` (parameterised generators, e.g. random fractions) so practice never runs out and answers are always mathjs-checkable.

### Mastery model
Simple **BKT-lite** per (user, skill) in D1: `p_mastery` ∈ [0,1], start 0.3.
- correct: `p = p + (1-p)*0.25`; wrong: `p = p*0.6`; hint used: smaller gain.
- `≥ 0.85` mastered · `0.5–0.85` in progress · `< 0.5` weak.
- Pure functions in `src/lib/learning/mastery.ts` + vitest.

### Diagnostic = a game, not a test ("Sarguzasht boshlanishi" / The first expedition)
The learner must never feel they are taking an exam. It is the character's first mission together with them:
- **Framing:** "Blokbek dunyoni quryapti — yo'lni ochish uchun yordam ber!" (Blokbek is building the world — help open the path). The screen is a blocky side-scrolling world; every question is a **gate / gap in a bridge / ore block** in front of the character.
- **Each question:** the character asks it by voice + it's drawn small on a sign/board in the world. Answer by tapping big choice blocks or typing a number. Correct → the block is placed / bridge extends / ore is mined with a block-particle burst and +XP. Wrong → **no penalty**: the character says something like "Bu blokni keyinroq birga quramiz" (we'll build this one together later) and the path takes a detour — no red X, no lives lost.
- **"Bilmayman" (I don't know) button** is always visible and is rewarded the same as an attempt — this stops random guessing, which would ruin the measurement.
- **No timers, no lives, no leaderboard during the diagnostic** — game pressure would distort the results. Time taken is recorded silently only as a weak signal.
- **Adaptive under the hood:** 8–12 questions, start mid-grade, go **down** the prerequisite graph after a wrong / "Bilmayman" answer and **up** after a right one (§7 mastery update). The learner just sees the world progressing.
- **Biome per section:** Kasrlar = forest, Tenglamalar = mountains, Geometriya = desert city with Samarkand-style domes, etc. The biomes visited become the regions on their roadmap, so the diagnostic visually turns into the map.
- **Finish:** the camera zooms out and the explored world **becomes their roadmap** — mastered skills appear as finished buildings, weak skills as "under construction" sites with a crane and the character standing next to the first one: "Mana sening yo'ling. Birinchi qurilish — kasrlarni qo'shish!" (Here's your path. First build: adding fractions!). No score in percent is shown to the learner; the parent/teacher view shows the details.
- Takes ≤ 5 minutes. Can be repeated later as a "qayta tekshiruv" (re-check) mission to show growth.

### Roadmap generation (`src/lib/learning/roadmap.ts`)
1. Targets = weak skills at the learner's grade.
2. Add all prereqs not yet mastered (transitive).
3. Topologically sort; prioritise lowest mastery & most-blocking skills.
4. Node status for UI: `mastered` (green) · `current` (pulsing, character avatar on it) · `next` (yellow) · `locked` (grey) · `optional`.
5. Rendered with React Flow, vertical roadmap.sh-style, sections as groups; tap a node → start lesson.

---

## 8. External AI APIs — VoiceLab (voicelab.uz)

Provider for **all three**: STT, TTS and LLM → **VoiceLab** (Uzbek-first). Docs: https://docs.voicelab.uz · SDK quickstart: https://docs.voicelab.uz/libraries/sdk · keys: https://voicelab.uz/app/developer/api-keys
The team may also hand over a **customised** endpoint/model later — keep everything behind adapters so only `src/lib/ai/voicelab/*` changes.

What we know (verify against the docs before coding, log anything different in REPORT.md):
- **TTS**: TypeScript SDK `@voicelab/sdk` → `new VoiceLab({ apiKey })`, `voiceLab.tts.synthesize({ text, language, voiceId })` → `speech.audio` (wav). Voice ids look like `voice_...` (pick from the voice catalog, one per character). There is also a **"Realtime speech" WebSocket** for streaming TTS (stretch: lower latency).
- **STT**: REST "transcribe audio" endpoint (+ long-audio upload; a **"Realtime" WebSocket** exists for streaming STT — stretch).
- **LLM**: REST "list models" + "chat completion" (+ "request status" → it may be async/polling; check). Find out: model name, whether it supports streaming and a JSON/structured-output mode, max tokens.
- Uzbek language code: not shown in the quickstart — check the docs (probably `uz`); log it.
- **Cloudflare Workers compatibility is unverified.** Try the SDK first; if it needs Node-only APIs (fs, streams) or bloats the bundle, call the REST API directly with `fetch` (works everywhere). Never use the SDK's file-writing examples — return audio bytes in the Response / put them in R2.

Adapters (`src/lib/ai/`):
```ts
interface STT { transcribe(audio: ArrayBuffer, mime: string): Promise<{ text: string }> }
interface TTS { synthesize(text: string, voiceId: string): Promise<{ audio: ArrayBuffer; mime: string }> }
interface LLM { complete(messages: Msg[], opts?: { json?: boolean; stream?: boolean }): Promise<string> | AsyncIterable<string> }
```
Implementations: `voicelab/stt.ts`, `voicelab/tts.ts`, `voicelab/llm.ts`, plus `mock/*`.

Secrets / vars:
- `VOICELAB_API_KEY` (secret; scopes needed: TTS access, Voices read, STT, LLM)
- `VOICELAB_BASE_URL` (var, from docs)
- `VOICELAB_LLM_MODEL` (var)
- `VOICELAB_LANG` (var, default `uz`)
- `VOICE_IDS` (var, JSON: `{"blokbek":"voice_…","agent-shox":"voice_…","robo-rayhon":"voice_…","chaqmoq":"voice_…"}`)
- `MOCK_AI` (`1` = no network calls)

Rules:
- **Never** call VoiceLab from the browser; the key stays in the Worker.
- **`MOCK_AI=1`**: STT returns a fixed phrase, LLM returns segments from `src/lib/ai/mock/`, TTS falls back to pre-recorded files in `/public/audio/` or browser `speechSynthesis`. The full demo must work in mock mode.
- If the VoiceLab LLM is weak at strict JSON: keep the prompt short, give few-shot examples, validate with zod, retry once, then use a canned segment for that skill. Log quality issues in REPORT.md so the team can decide.
- Cache every TTS result in R2 by `sha256(voiceId + text)`; pre-generate the audio for the 4 demo lessons at build/seed time so the live demo never waits on TTS.

## 9. Data model (D1 / Drizzle, `src/db/schema.ts`)

- `users` (id, nickname, grade, characterId, xp, streak_days, last_active_at, created_at)
- `skill_mastery` (user_id, skill_id, p_mastery, attempts, correct, updated_at) — PK (user_id, skill_id)
- `attempts` (id, user_id, skill_id, problem_json, answer, is_correct, hint_used, ms_taken, created_at)
- `lessons` (id, user_id, skill_id, started_at, finished_at, segments_json)
- `roadmaps` (user_id, nodes_json, generated_at)
- `parents` (optional, later): parent_phone, linked user ids

Auth for the hackathon: **guest-first** — anonymous user created on first visit, id in an HttpOnly cookie → KV session. Nickname + grade at onboarding. (Telegram login = stretch goal.)

---

## 10. Screens & responsive layout

Uzbek UI copy everywhere (`src/i18n/uz.ts`; keep strings out of components so `ru` can be added later).

| Route | Purpose |
|---|---|
| `/` | Landing: hero with characters, "Boshlash" CTA, value props, for parents/schools section |
| `/onboarding` | nickname → grade → pick character |
| `/diagnostic` | **game-based** first expedition (§7): blocky world, each question is a block/bridge gap, no penalties, ends by turning into the roadmap |
| `/roadmap` | personal skill map (home screen after onboarding) |
| `/lesson/[skillId]` | the board + character + mic (the hero screen) |
| `/practice/[skillId]` | quick-fire problems, XP |
| `/profile` | XP, streak, badges, character collection |
| `/parent` (stretch) | weekly report: progress per skill, time spent |

Layouts (mockups in `docs/mockups/`):
- **Mobile (< 768px)**: board on top (16:10, full width), character bubble overlaid bottom-left of the board, captions under it, big round mic button + answer input at the bottom, bottom tab bar (Xarita · Dars · Mashq · Profil).
- **Tablet (768–1279px)**: landscape-first; board ~70% left, character + chat/captions column right; stylus/finger scratchpad toggle; side rail nav.
- **Desktop (≥ 1280px)**: left sidebar nav + mini roadmap, centre board, right column character + transcript + answer input.

**Mockups (source of truth for the look):** https://claude.ai/artifact/H3mU9qcfDgd76MRFyuTw5k — Web lesson, Tablet interruption state, Mobile lesson, Mobile diagnostic expedition, Mobile roadmap world, Mobile onboarding, Character rig sheet, Design tokens, plus the Scene / Character / Board building blocks. Match them. **The same files are in `docs/mockups/` (see its README) — read those, you cannot open the claude.ai link.**

**Design tokens** (put in `src/app/globals.css` as Tailwind v4 `@theme`; the "Tokens" artboard in the mockups shows them all):
- App/chrome: deep `#121729` · panel `#1b2238` (UI panels float over the scene) · panel line `#34437a` · text `#ffffff` · muted text `#aab4d4`
- Primary blue `#2f6bff` (hover `#5b8cff`) for mic, play, primary buttons, active step glow · gold `#ffc83d` (stars, XP) · success `#4ade80` · interruption/note orange `#ff9f43`
- Scene: wall `#3b4563`, wood `#b0773a`/`#8a5a2c`, floor `#6b4a2e`, window sky `#8fd0ff`, lamp `#ffe7a3`
- Chalkboard `#233029`; chalk meaning: white = main work, **yellow = the answer / current question**, blue & pink = parts being compared, **orange = answer to an interruption (note layer)**, green = check mark
- Fonts (Google): **Fredoka** 600/700 (logo, headings, numbers, buttons) · **Manrope** 500/700 (body, captions) · **Kalam** 700 (chalk)
- Shapes: panels radius 20, buttons pill or circle, 44px+ targets. Panel shadow `0 8px 24px rgba(0,0,0,.35)` + 2px inner line `#34437a`. **Glow only on the active thing** (current step, mic while listening) — never on everything.

**Fun, but NOT "AI slop" — forbidden:** purple/blue gradient washes, glassmorphism, emoji as icons, generic stock illustrations, left-border accent cards, "✨ AI-powered" badges, lorem ipsum, fake stats. Fun comes from the characters, the chalkboard, chunky pixel UI, XP/streak/missions and micro-animations (character bob + lip-sync, chalk strokes drawing in, node pulse, block-confetti on success).

**UX must never be confusing (hard rules):**
1. **One primary action per screen**, always the biggest gold/green button (lesson → mic/answer; roadmap → "Darsni davom ettirish").
2. Every icon button has a text label or `aria-label` + tooltip; the mic button always says what to do ("Bosib gapiring").
3. The tutor's words are **always shown as captions** next to the character, so sound-off still works.
4. The learner always knows **where they are**: lesson title + "Qadam 3/5" pips + current roadmap node highlighted.
5. Roadmap states differ by **colour + icon + word** (O'zlashtirildi / Hozir / Keyingi / Yopiq) — never colour alone.
6. Wrong answer = friendly hint from the character, never a red "error" screen; after 2 misses offer "Ko'rsatib ber" (show me).
7. Max 3 taps from opening the app to talking with the tutor. No modals during a lesson.
8. Tap targets ≥ 44px, text contrast ≥ 4.5:1, `prefers-reduced-motion` respected.

Visual style: bright, playful, game-HUD touches (XP bar, level chip, streak flame), rounded cards, large tap targets (≥ 44px), dark chalkboard board as default. Accessibility: captions always shown under the character (doubles as reading practice), keyboard-operable, respects `prefers-reduced-motion`.

---

## 11. Repo structure

```
src/
  app/                 # vinext / Next App Router
    (marketing)/page.tsx
    onboarding/ diagnostic/ roadmap/ lesson/[skillId]/ practice/[skillId]/ profile/
    api/ stt/ tts/ tutor/ answer/ roadmap/ diagnostic/  (route.ts each)
  components/
    board/  characters/  roadmap/  lesson/  ui/ (shadcn)
  lib/
    ai/ (stt.ts tts.ts llm.ts schema.ts prompts/ mock/)
    learning/ (mastery.ts roadmap.ts diagnostic.ts checker.ts)
    audio/ (recorder.ts player.ts lipsync.ts)
  db/ (schema.ts client.ts) 
  data/ (skills.uz.json problems/)
  config/ (brand.ts characters.ts)
  i18n/uz.ts
drizzle/               # migrations
docs/ mockups/  pitch/
REPORT.md              # your running log (see §12)
```

---

## 12. How you (the agent) must work

0. Also produce for the judges: `README.md`, `docs/ARCHITECTURE.md`, `docs/pitch/{business,pedagogy,legal}.md` (see §14) — short and honest, with `TODO(team)` where real numbers are needed.

1. **Build in the order of §13.** Commit after every milestone with a clear message (`feat: board renderer`, …). Push to `origin main`.
2. **Never block on a question.** If unclear: choose the simplest reasonable option, implement it behind a flag/config if possible, and add an entry to `REPORT.md`:
   ```
   ## ❓ Unclear / assumption  — <time>
   - What: …   - I assumed: …   - To change: edit <file>
   ```
3. `REPORT.md` also gets, per milestone: ✅ done · ⚠️ known issues · 🔑 what the team must provide (API docs, keys, voices, D1 ids). At the end write a **final summary** with the live URL, how to run locally, what's mocked, and the demo script.
4. Keep everything deployable: `pnpm build` must pass before each commit; deploy to Cloudflare at milestones M2, M4, M6.
5. Don't add heavy deps beyond §2 without logging why. No paid services besides VoiceLab and Cloudflare. The VoiceLab key lives ONLY in `.dev.vars` (local, git-ignored) and as a Wrangler secret in production — never print it, log it, commit it or put it in client code.
6. Secrets never in git. `.dev.vars`, `.env*` in `.gitignore`.
7. Mobile performance matters (judges will use phones): code-split the board/roadmap, lazy-load KaTeX fonts, keep JS for `/lesson` small.

---

## 13. One-day build plan (milestones)

| # | Time | Milestone | Done when |
|---|---|---|---|
| M0 | 0:00–0:45 | **VoiceLab speed test first** (`scripts/bench-voicelab.ts`: 10× STT on a 4 s Uzbek clip, 10× LLM short answer, 10× TTS one sentence → median/p90 ms into REPORT.md). Then scaffold vinext + Tailwind + shadcn, wrangler bindings, Drizzle schema + migration, `MOCK_AI` flag, deploy "hello" to Workers | live URL works |
| M1 | 0:45–2:30 | **Board renderer** + BoardCommand zod schema + 4 hand-written demo lessons playing in mock mode | fractions lesson plays with animation |
| M2 | 2:30–4:00 | **Characters** (2 first: Blokbek, Agent Shox) with states + lip-sync; audio player; TTS route + R2 cache | character "talks" while board draws |
| M3 | 4:00–6:00 | **Real AI loop**: STT route + mic button, `/api/tutor` streaming SSE with LLM + JSON validation/retry, answer checking with mathjs, **barge-in: pause → answer on note layer → resume** | interrupt the tutor mid-sentence by voice in Uzbek → spoken + drawn answer → lesson resumes where it stopped |
| M4 | 6:00–7:30 | **Skill graph + diagnostic + mastery + roadmap** (React Flow) | finish diagnostic → personal roadmap appears |
| M5 | 7:30–9:00 | Onboarding, landing, profile, XP/streak/unlocks, responsive polish for mobile/tablet/desktop | all 3 breakpoints look like the mockups |
| M6 | 9:00–10:00 | Hardening: fallbacks, loading states, error toasts in Uzbek, seed demo user, final deploy, REPORT.md final summary | demo script runs 3× without failure |
| M7 | stretch | **teacher page (task #4): class weak-point heatmap + generate practice set**, parent weekly report, Telegram login, stylus scratchpad, Russian UI | — |

---

## 14. Judging criteria (official, each 1–10) → what must exist

Score = average of 3 mentors: Technical (T), Business (B), Domain/Soha (S), each = (x1+…+x5)/5. Build so every line below has something to **show**.

### T — Texnik mentor
| Code | Criterion | How we win it |
|---|---|---|
| T1 | Texnik amalga oshirilish (technical implementation) | Working live URL; real Uzbek voice loop STT → LLM → TTS with streaming; board drawn from structured LLM output; mathjs-verified answers; mastery + roadmap really update. |
| T2 | Kod tayyorligi (code readiness) | Clean typed modules (§11), zod everywhere, vitest for learning logic, `pnpm build` green, migrations, `.dev.vars.example`, README with run/deploy steps, mock mode, graceful errors. Commit history that shows progress. |
| T3 | Yechimning innovatsionligi (innovation) | Tutor that **speaks Uzbek and draws** at the same time with a lip-synced game character; LLM → deterministic "board command" language; adaptive roadmap.sh-style skill graph from diagnosed weak points. |
| T4 | Jamoa bilim darajasi (team knowledge) | Mentors will question the team: write `docs/ARCHITECTURE.md` in simple language (Uzbek or English) explaining every part, data flow, and *why* each choice was made, so any team member can answer. Keep code readable — no magic. |
| T5 | Texnologiyalar to'plami (tech stack) | Modern, coherent, serverless stack (§2): vinext/Next 16 + Cloudflare Workers, D1, KV, R2, Drizzle, React Flow, KaTeX, mathjs. One-slide stack diagram in `docs/pitch/`. |

### B — Biznes mentor
Write `docs/pitch/business.md` (1–2 pages) covering:
| Code | Criterion | Content |
|---|---|---|
| B1 | G'oya va muammoning dolzarbligi (idea & problem relevance) | Private math tutors are expensive and concentrated in cities; most AI tutors don't speak Uzbek; students lose motivation. TODO(team): add real numbers (students in grades 5–9, tutor price per month, PISA/national results). |
| B2 | Biznes modeli / monetizatsiya | Freemium B2C (free daily lesson; Premium subscription via Click/Payme: unlimited voice lessons, all characters, parent reports) + B2B per-seat licence for schools/learning centres + possible B2G pilots. |
| B3 | Raqobatdagi ustunlik (competitive advantage) | Uzbek-first voice + drawing, local curriculum, game characters, adaptive roadmap; vs. YouTube lessons (not personal), offline tutors (expensive), global AI tutors (no Uzbek voice, foreign curriculum). |
| B4 | Moliyaviy barqarorlik (financial sustainability) | Unit economics: edge hosting ≈ near-zero idle cost, R2 TTS cache cuts repeated speech cost, short LLM turns. Show a simple cost-per-lesson vs. price table (TODO(team): real API prices). |
| B5 | O'sish imkoniyati (growth) | More subjects (physics, English), Russian & Karakalpak UI, Central Asia (KZ, KG, TJ), school partnerships, Telegram mini-app channel. |

### S — Soha (domain) mentor
| Code | Criterion | How we win it |
|---|---|---|
| S1 | Muammoning dolzarbligi (problem relevance) | We solve the ministry's **official task #3** word for word (§0). Weak math foundations accumulate: a gap in fractions breaks algebra later — the roadmap directly targets those gaps. |
| S2 | Sohani tushunish chuqurligi (domain depth) | Skill graph aligned to Uzbekistan's national math curriculum grades 5–9 with correct Uzbek terminology (kasr, surat, maxraj, EKUK, EKUB, tenglama…); mastery learning, Socratic method, spaced practice, visual representations (fraction bars, number lines). Explain this in `docs/pitch/pedagogy.md`. |
| S3 | Amaliy qo'llanilishi (practical applicability) | Works on cheap Android phones and slow mobile internet (small JS, cached audio), no install (web/PWA), usable at home or in class; teacher/parent view (stretch). |
| S4 | Qonunchilikka muvofiqlik (legal compliance) | **Important:** Uzbekistan's personal-data law requires citizens' personal data to be stored in Uzbekistan. So: collect **minimum data** (nickname + grade, anonymous id; no real names, phones or photos in the MVP), store voice only transiently (never persist recordings), no ads/tracking for kids, parental consent screen for under-16s, privacy policy page in Uzbek (`/maxfiylik`). Document in `docs/pitch/legal.md` that for production personal data moves to a local Uzbek data centre while Cloudflare serves the app/static/cache. Original characters only (no game IP). Content aligned to the official curriculum. Flag uncertainty in REPORT.md — the team should verify with a lawyer. |
| S5 | Ta'sir ko'lami (scale of impact) | Millions of school students in Uzbekistan; rural students get a tutor in their own language for the price of a phone; schools get weak-point analytics. TODO(team): real figures. |

## 15. Demo script (keep working at all times)
1. Open on phone → landing → "Boshlash" → nickname, 6-sinf, pick **Blokbek**.
2. Diagnostic expedition: 8 questions as bridge blocks in the world (seeded so it finds "kasrlarni qo'shish" weak); one wrong answer shows the friendly detour; ends by zooming out into the roadmap.
3. Roadmap appears, current node pulses → tap it.
4. Blokbek explains `1/2 + 1/3` with fraction bars on the board, in Uzbek, by voice.
5. Judge presses mic and asks: *"Nega maxrajlarni ko'paytirdik?"* → tutor answers by voice + drawing.
6. Judge answers a practice question → XP + roadmap node turns green.
7. Show the same lesson on tablet & laptop (responsive).
