# Architecture — how To2 works (for anyone on the team)

## The big picture
```
 Phone / tablet / laptop (browser)
 ┌──────────────────────────────────────────────────────────────────┐
 │ LessonPlayer  (src/components/lesson)                            │
 │ Board (SVG chalk)  3D tutor (three.js, lip-sync)  Mic / answers  │
 │   └── lesson engine (src/lib/lesson/engine.ts, zustand)          │
 └──────────▲──────────────────────────────┬────────────────────────┘
            │ SSE: one event per segment   │ fetch
 ┌──────────┴──────────────────────────────▼────────────────────────┐
 │ Cloudflare Worker (vinext route handlers, src/app/api/*)         │
 │  /api/tutor   prompt → VoiceLab LLM (stream) → zod → SSE         │
 │  /api/tts     KV/R2 cache → VoiceLab TTS (WAV)                   │
 │  /api/stt     multipart audio → VoiceLab STT (async job, polled) │
 │  /api/answer  mathjs check → mastery (D1) → XP / streak          │
 │  /api/diagnostic, /api/roadmap, /api/practice, /api/user         │
 └─────┬─────────────────┬─────────────────┬────────────────────────┘
       D1 (users,        KV (sessions,     R2 (audio — when enabled;
       mastery, attempts) LLM + TTS cache)  KV is used until then)
```

## One tutor turn
1. The learner holds the mic → `MediaRecorder` records webm/opus → `POST /api/stt` → VoiceLab returns a job → we poll until `transcript` is ready (~2–4 s). The audio is never stored.
2. `POST /api/tutor` with the question + context (skill, the sentence being spoken, what is on the board, last 6 turns).
3. The Worker streams the LLM reply. `src/lib/ai/streamJson.ts` pulls each complete JSON object out of the stream **as soon as it closes**, validates it with zod (`src/lib/ai/schema.ts`) and sends it as an SSE `segment` event. The first segment is spoken while the LLM is still writing the rest.
4. For each segment the client fetches `/api/tts?voice&text` (cached by `sha256(voiceId+text)`), plays it, and draws the segment's board commands spread over the audio's duration.

## Why "board commands" (the key idea)
The LLM never draws pixels. It writes a tiny JSON language (`write`, `latex`, `fractionbar`, `numberline`, `plot`, `highlight`…, CLAUDE.md §5). Our code renders it deterministically in a 1000×625 SVG viewBox, so:
- it scales on every screen, it is cheap (no image generation), and it is testable;
- bad LLM output can be repaired: unknown ops are dropped, colours default, `fitToBoard()` keeps text on the canvas, and interruption notes are always placed in the orange note panel (`noteLayouter()`), so they never cover the main explanation.

## The lesson stage (handwriting + 3D tutor)
- `src/components/board/handwriting.ts` turns each board command into **single-line chalk strokes** (polylines in board coordinates): letters from the EMS Tech single-stroke font (`glyphs.json`), fractions stacked by hand, fraction bars shaded with hatching, wobbly lines and circles that overshoot. Progress p∈[0,1] of an element reveals its strokes in writing order (`progressOf`) and gives the exact **chalk-tip** point. Pure functions, unit-tested.
- `Board.tsx` renders the strokes with a chalk SVG filter and a chalk piece at the tip, and writes the tip into `boardTip` (`src/lib/board/tip.ts`).
- `ClassroomStage.tsx` = classroom SVG (1600×900) + the board at translate(420,100) scale(1.104) + `TutorCanvas`: a three.js orthographic camera mapped 1:1 onto the stage, so the chalk tip feeds the **2-bone arm IK** directly. Each frame it reads the tip, the lesson state and the TTS amplitude: writing → turn the back, walk along the board, arm follows the tip; talking → face the learner, mouth from amplitude; listening → lean in; thinking → hand to chin; correct answer → cheer + hop.
- The 8 tutors are one voxel rig (`voxel.ts`) + configs (`src/config/characters.ts`). UI portraits come from Blender PNG/WebP renders when present, else from an offscreen three.js render (`portraits.ts`).

## Drawing in sync with speech
VoiceLab TTS returns no word timestamps, so we use the **proportional rule**: each command gets a time slot proportional to its "weight" (text length, ~1 for shapes, `pause` = its ms) inside 90% of the audio duration (`scheduleSegment()` in `src/lib/board/model.ts`). Strokes animate with `stroke-dashoffset`, text reveals left→right with a clip path, and a chalk dot follows the stroke while the character points at the board.

## Interrupting the tutor (barge-in)
`src/lib/lesson/player.ts` is a small, unit-tested state machine:
`idle → speaking → paused → listening → thinking → answering → checking → (resume) speaking` (+ `awaiting` for questions).
Pressing the mic freezes audio and the chalk timeline and **remembers the exact audio position and command index**. The answer is drawn on a separate `note` layer in orange; **Davom et** dims the notes to 30% and resumes the main lesson from the saved position. Interrupting the answer itself replaces it (nesting max 1).

## Learning engine (pure functions, vitest)
- **Skill graph** `src/data/skills.uz.json`: 47 skills, grades 5–8(9), 10 sections, each with prerequisites.
- **Problems** `src/data/problems/`: parameterised generators for every skill (infinite practice); answers are checked by mathjs, never by the LLM.
- **Mastery** `src/lib/learning/mastery.ts` (BKT-lite): start 0.3; correct `p+(1-p)·0.25`; wrong `p·0.6`; hint → smaller gain. ≥0.85 mastered, 0.5–0.85 in progress, <0.5 weak.
- **Diagnostic** `src/lib/learning/diagnostic.ts`: starts mid-grade, walks down on a miss (and probes the missed skill's other prerequisites), up on a hit, 8 questions.
- **Roadmap** `src/lib/learning/roadmap.ts`: targets = weak skills ≤ grade; add their unmastered prerequisites (unmeasured lower-grade skills are assumed known); Kahn topological sort, preferring lowest mastery and most-blocking skills.

## Reliability choices
- **Mock mode** (`MOCK_AI=1` or no key): everything works offline with canned content.
- LLM output: zod-validate each segment → retry once with the error → canned lesson (`src/lib/ai/canned.ts`) built from the problem generators.
- **Caches:** TTS audio (KV/R2), generated lessons (KV, 7 days), interruption answers per skill+question (KV, 7 days). `scripts/warm-tts.mjs` pre-generates the demo so it never waits.
- The 4 hand-written demo lessons (`src/lib/ai/mock/lessons.ts`) are served instantly and double as the LLM's few-shot examples.
- Guest auth: random session id in an HttpOnly cookie → KV → user id. No personal data.

## Why this stack
| Choice | Why |
|---|---|
| Cloudflare Workers + vinext | Next.js-style app on the edge, near-zero idle cost, one deploy for UI + API. |
| D1 + Drizzle | SQL with types and migrations, no server to run. |
| KV | sessions, rate limits, LLM/TTS caches (R2 for audio once enabled). |
| Custom SVG board + handwriting engine | scripted, time-synced, stroke-by-stroke chalk writing (tldraw/Excalidraw can't do that and are heavy). |
| three.js voxel tutor | real 3D turn/walk/IK at 60 fps from ~20 boxes; lazy-loaded only on the lesson screen. |
| mathjs | deterministic answer checking (equivalent fractions, `0,5`, `x = 4`, expressions). |
| React Flow + dagre | roadmap.sh-style graph with automatic layout. |
| VoiceLab (fetch, no SDK) | Uzbek-first STT/TTS/LLM; plain REST keeps the Worker bundle small. |

## Where things are
```
src/app/            pages + api routes
src/components/     board/ characters/ lesson/ roadmap/ ui/ landing/
src/lib/ai/         schema (contract), prompts, voicelab adapters, mock, caches
src/lib/board/      board model: apply/schedule/fit/note layout
src/lib/lesson/     player state machine + engine (client)
src/lib/learning/   mastery, diagnostic, roadmap, checker
src/lib/server/     session, repo (D1)
src/data/           skills graph + problem generators
```
