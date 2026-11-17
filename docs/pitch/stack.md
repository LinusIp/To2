# Tech stack — one slide

```
            ┌───────────────────────── Browser (phone · tablet · laptop) ─────────────────────────┐
            │  vinext / React 19 · Tailwind v4 · zustand                                          │
            │  SVG chalkboard (rough.js, chalk math, KaTeX)  ·  pixel characters + lip-sync       │
            │  MediaRecorder (push-to-talk)  ·  React Flow + dagre roadmap                        │
            └──────────────────────────────▲───────────────────────┬─────────────────────────────┘
                                           │ SSE segments          │ fetch
            ┌──────────────────────────────┴───────────────────────▼─────────────────────────────┐
            │  Cloudflare Workers (edge)  ·  vinext route handlers  ·  zod on every input/output  │
            │  tutor (LLM stream → validate → SSE) · tts · stt · answer (mathjs) · roadmap        │
            └──────┬────────────────┬────────────────┬──────────────────────┬────────────────────┘
                   │                │                │                      │
             D1 + Drizzle       KV (sessions,     R2 (audio cache,     VoiceLab (Uzbek)
             users, mastery,    LLM/TTS cache,    when enabled)        STT · TTS · LLM
             attempts           rate limits)
```

**Why:** serverless edge (near-zero idle cost, fast everywhere), deterministic "board command" rendering instead of image generation, code-checked math (mathjs) instead of trusting the LLM, Uzbek-first speech provider, everything typed (TypeScript strict + zod) and unit-tested (vitest).
