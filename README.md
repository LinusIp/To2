# To2 — AI math tutor that speaks Uzbek and draws on the board

**Live:** https://to2.locallabs-io.workers.dev

National AI Hackathon, Tashkent 2026 · Ministry task **#3 "Shaxsiylashtirilgan o'qitish"** — *an AI tutor that works in Uzbek, finds knowledge gaps and builds an individual learning path.*

| Task wording | What To2 does |
|---|---|
| **O'zbek tilida ishlaydigan** | Learner asks by voice in Uzbek (VoiceLab STT), the tutor answers by voice (VoiceLab TTS), lessons are generated in Uzbek (VoiceLab LLM). The whole UI is in Uzbek. |
| **bilimdagi bo'shliqlarni aniqlab** | 8-question adaptive diagnostic walks *down* the prerequisite graph on a miss and *up* on a hit; a mastery score per skill updates after every answer. |
| **individual o'quv trayektoriyasi** | A personal roadmap (roadmap.sh style): weak skills + their unmastered prerequisites, topologically ordered. |
| **SI-tyutor** | A 3D voxel tutor who talks to the learner, turns to the chalkboard and writes stroke by stroke, and can be interrupted mid-sentence with "Savol berish". |

## Demo (2 minutes)
1. Open the URL on a phone → **Boshlash** → **Blokbek**, grade 6 → *Diagnostikani boshlash*.
   Tutor art: drop Blender renders into `public/characters/` as `<id>_<pose>_<frame>.png` — the build picks them up (and makes WebP copies).
2. Answer the first question (adding unlike fractions) wrong, the rest right → the roadmap shows *Maxrajlari har xil kasrlarni qo'shish* as **Hozir · Zaif nuqta**.
3. **Darsni davom ettirish** → **Darsni boshlash**: Blokbek explains 1/2 + 1/3 with fraction bars, by voice, while the chalk draws.
4. Hold the mic and ask *"Nega maxrajlarni ko'paytirdik?"* → the lesson pauses, Blokbek answers in orange chalk in a side note → **Davom et** resumes exactly where it stopped.
5. Answer the in-lesson questions → XP, confetti → *Mashqqa o'tish*, answer one practice problem → the roadmap node turns green.
6. Open the same URL on a laptop / tablet — responsive layouts. `/teacher` shows the class weak-point heatmap (task #4 story).

## Run locally
```bash
pnpm install
cp .dev.vars.example .dev.vars      # add your VoiceLab key, or keep MOCK_AI=1
pnpm dev                            # http://localhost:5173
pnpm test                           # vitest: mastery, roadmap, diagnostic, checker, board, player
```
`MOCK_AI=1` (or no key) → no network calls: canned lessons, canned interruption answers, captions with a silent timer instead of voice. The full demo works offline this way.

## Deploy (Cloudflare Workers)
```bash
pnpm wrangler login                 # once, a human approves in the browser
pnpm deploy                         # vite build + scripts/deploy.mjs → wrangler deploy
pnpm wrangler secret put VOICELAB_API_KEY --name to2
node scripts/warm-tts.mjs           # pre-generate demo voice + demo answers (cached in KV)
```
Bindings live in `cloudflare.config.ts` (D1 `to2`, KV, optional R2 `AUDIO`). The DB schema is in `src/db/schema.ts` → `drizzle/0000_init.sql`; the app also creates tables idempotently on first use.

## Stack
vinext (Next.js 16 App Router on Vite) · Cloudflare Workers + D1 + KV (+ R2 when enabled) · Drizzle · Tailwind v4 · zustand · three.js voxel tutors · SVG handwriting board (single-stroke chalk glyphs) · mathjs · React Flow + dagre · zod · vitest · VoiceLab STT/TTS/LLM.

More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/pitch/](docs/pitch) · build log & open questions: [REPORT.md](REPORT.md)
