# REPORT — agent build log

**Live URL:** https://to2.locallabs-io.workers.dev

The Claude Code agent appends here (see CLAUDE.md §12): milestones done, assumptions, questions, what the team must provide.

## 🔑 Team must provide
- [x] VoiceLab API key → in `.dev.vars` (local) and set as Wrangler secret `VOICELAB_API_KEY` on the `to2` Worker.
- [x] VoiceLab base URL (`https://api.voicelab.uz`), Uzbek code (`uz`), LLM model (`aisha-gemma-4`) — found from docs + live API.
- [x] Voice ids — picked from `GET /v1/voices?language=uz` (see below). **Team: listen and change if you prefer** → `cloudflare.config.ts` `VOICE_IDS` (+ `.dev.vars` locally).
- [ ] **Enable R2** in the Cloudflare dashboard (account returned code 10042). Until then TTS audio is cached in KV. After enabling: `pnpm wrangler r2 bucket create to2-audio` and uncomment `AUDIO` in `cloudflare.config.ts`.
- [ ] Any customised VoiceLab endpoint/model later → only `src/lib/ai/voicelab/*` + `cloudflare.config.ts` vars change.
- [ ] Real numbers for the pitch docs (`TODO(team)` markers in `docs/pitch/*`).

## Log

### M0 — scaffold ✅ (≈0:45)
- ✅ vinext 1.4 (Next 16 App Router API on Vite 8) via `pnpm create cloudflare --framework=next`, Tailwind v4 tokens in `src/app/globals.css`, Drizzle schema + `drizzle/0000_init.sql`, D1 `to2` + KV namespace created, `/api/health` live and reaches D1.
- ⚠️ Known: first request right after a deploy once returned Cloudflare `1042`; a retry was 200.

## ❓ Unclear / assumption — M0
- What: C3 now scaffolds **`cloudflare.config.ts`** (new `cf` CLI config) instead of `wrangler.jsonc`, and `vinext-cloudflare deploy` uses the `cf` login (not logged in here; `wrangler` is).
- I assumed: keep `cloudflare.config.ts` as the source of truth for bindings; `pnpm deploy` = `vite build` + `scripts/deploy.mjs`, which converts the build's `worker.config.json` into `.cloudflare/deploy/wrangler.json` and runs `wrangler deploy` on the prebuilt bundle.
- To change: once someone runs `npx cf auth login`, `pnpm deploy:cf` deploys the official way.

## ❓ Unclear / assumption — M0 DB migrations
- What: no `wrangler.jsonc` to drive `wrangler d1 migrations apply`.
- I assumed: `src/db/client.ts` runs idempotent `CREATE TABLE IF NOT EXISTS` (mirrors `drizzle/0000_init.sql`) once per isolate, so the DB is always ready. `pnpm db:migrate:remote` also applies the SQL file explicitly.
- To change: switch to `wrangler d1 migrations apply` when a wrangler config is adopted.

## ❓ Unclear / assumption — VoiceLab (verified against docs.voicelab.uz + live API, 17 Nov)
- Auth `Authorization: Bearer vlk_…`. Base `https://api.voicelab.uz/v1`.
- **TTS** `POST /v1/tts` `{text, language:"uz", voice_id}` → raw WAV (24 kHz mono) in ~0.8 s for a short sentence. **No word timestamps** → board sync uses the **proportional weight rule** (CLAUDE.md §3).
- **STT** `POST /v1/stt` multipart (`audio`, `language=uz`, UUID `Idempotency-Key`) → always async (202) → poll `GET /v1/stt/transcriptions/{id}` for `transcript`. webm/opus accepted.
- **LLM** `POST /v1/chat/completions`, OpenAI-compatible. Models on our key: `aisha-gemma-4` (default, fast, ~3–6 s for a short answer), `aisha-orbit`, `aisha-halo`, `aisha-muon`. No documented JSON mode → we prompt for JSON, validate with zod, retry once, then fall back to canned segments. Calling `aisha-comet` silently served `aisha-gemma-4`.
- Voices chosen: Blokbek → *Javohir — Bright presenter*; Agent Shox → *Rustam — Anime hero*; Robo-Rayhon → *Gulnoza* (neutral); Chaqmoq → *Botir — Bomba streamer*.
- SDK not used — plain `fetch` works on Workers and keeps the bundle small.
