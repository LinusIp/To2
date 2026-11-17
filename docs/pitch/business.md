# Business — To2

## B1 · The problem
- Math builds on itself: a gap in fractions in grade 5–6 breaks algebra in grade 7–8. Most learners don't know *which* foundation is missing.
- A private math tutor is expensive and concentrated in big cities. TODO(team): typical monthly tutor price in Tashkent vs regions.
- Video lessons are not personal and don't answer questions; global AI tutors don't speak Uzbek by voice and follow foreign curricula.
- TODO(team): number of grade 5–9 students in Uzbekistan; national / PISA 2022 math results for Uzbekistan (cite the source).

## B2 · Business model
| Segment | Offer | Price (to validate) |
|---|---|---|
| B2C free | 1 voice lesson per day, diagnostic, roadmap, practice | free |
| B2C Premium | unlimited voice lessons, all characters, parent weekly report | TODO(team) so'm / month via Click / Payme |
| B2B schools & learning centres | per-seat licence, teacher panel (class weak-point heatmap, one-click practice sets), printable worksheets | TODO(team) so'm / student / year |
| B2G | pilots with regional education departments | grant / tender |

## B3 · Competitive advantage
| | To2 | YouTube lessons | Offline tutor | Global AI tutors |
|---|---|---|---|---|
| Uzbek voice in & out | yes | listen only | yes | no / weak |
| Finds *your* gaps, builds a path | yes | no | sometimes | partly |
| Draws step by step while talking | yes | pre-recorded | yes | no |
| Local curriculum + terms (EKUK, EKUB, maxraj) | yes | varies | yes | no |
| Price | low | free | high | subscription in USD |
| Fun (characters, XP, streaks) | yes | no | no | some |

Moat over time: the skill graph + problem bank aligned to the national curriculum, anonymised learning data (which gaps are common, which explanations work), and a cache of reviewed lessons/voice.

## B4 · Unit economics (why it is sustainable)
- **Hosting:** Cloudflare Workers + D1 + KV — near-zero idle cost, pay per request; static assets on the edge.
- **LLM:** VoiceLab `aisha-gemma-4` list price (from `/v1/models`, Nov 2026): 45 ¢ per 1M input tokens, 70 ¢ per 1M output tokens. One generated lesson ≈ 3k input + 1.5k output tokens ≈ **0.24 ¢**; one interruption answer ≈ 2k + 0.4k ≈ **0.12 ¢**. Generated lessons and repeated questions are cached in KV (7 days), so popular lessons are paid for once.
- **TTS / STT:** TODO(team): VoiceLab per-character / per-minute prices. Every TTS phrase is cached by `sha256(voice+text)` — the scripted parts of popular lessons cost once, not per learner.

| Cost per active learner / month (estimate) | Value |
|---|---|
| LLM (20 lessons + 40 questions, ~50% cache hits) | ≈ TODO(team) — formula above |
| TTS (uncached phrases only) | TODO(team) |
| STT (40 questions × ~4 s) | TODO(team) |
| Hosting | ≈ 0 at hackathon scale |
| **Price (Premium)** | TODO(team) |

## B5 · Growth
- More subjects on the same engine: physics, chemistry (formulas on the board), English.
- Russian and Karakalpak UI (all strings are in `src/i18n/uz.ts`, ready for `ru`).
- Central Asia: Kazakh, Kyrgyz, Tajik (VoiceLab already lists `kk`, `ky`, `tg`).
- Channels: school partnerships (teacher panel), Telegram mini-app, parents' word of mouth (weekly report).
