# Business — To2

> Numbers below are public figures (sources at the bottom) or our own estimates, marked **est.** Prices are hypotheses to validate in a pilot.
> Exchange rate used: **1 USD ≈ 12,000 so'm** (Central Bank of Uzbekistan, 12 Nov 2026: 11,964–12,014).

## B1 · The problem
- **The gap is measurable.** In PISA 2022 (Uzbekistan's first PISA), 15-year-olds scored **364 in mathematics** (OECD average 472). Only **19 %** reached the basic Level 2 in maths (OECD: 69 %), and almost no students were top performers (OECD: 9 %). PISA 2025 (published Sep 2026) did not report Uzbekistan's maths score because of data inconsistencies, so 2022 is the latest published maths result.
- **Math builds on itself:** a gap in fractions in grades 5–6 breaks algebra in grades 7–8, and most learners don't know *which* foundation is missing. This is exactly the ministry's task #3: *bilimdagi bo'shliqlarni aniqlab, individual o'quv trayektoriyasi*.
- **A private tutor is expensive.** Advertised math tutor rates in Tashkent and online are **50,000–100,000 so'm per hour** (typical ≈ 85,000). Monthly packages start at **≈ 500,000 so'm** and go up to **1,300,000+ so'm**. Tutoring prices rose **5.7 %** in the first 11 months of 2025. Two lessons a week (8/month) ≈ **680,000 so'm/month**. TODO(team): ask 2–3 tutors in the regions for their rates (we found no public data outside Tashkent and online).
- **Video lessons** are not personal and can't answer questions. **Global AI tutors** don't speak Uzbek by voice and follow foreign curricula.

**Market size (est.):** **6.87 million** pupils in general schools in 2025/26 (11,118 schools). Grades 5–9 are 5 of 11 grades, so that is **≈ 3.1 million** learners (est., assuming equal cohorts), plus their parents, schools and learning centres.

## B2 · Business model
| Segment | Offer | Price hypothesis |
|---|---|---|
| B2C free | diagnostic, roadmap, unlimited practice (generated problems, no AI cost), 3 voice lessons / week. Own questions get a text answer with cached voice; a fresh voice answer is Premium. | free |
| B2C Premium | unlimited voice lessons and fresh voice answers, all 8 tutors, parent weekly report | **49,000 so'm / month** (≈ $4, about **1/14 of a tutor**) via Click / Payme |
| B2B schools & learning centres | per-seat licence, teacher panel (class weak-point heatmap, one-click practice sets), printable worksheets | **120,000 so'm / student / year** (≈ $10) |
| B2G | pilots with regional education departments | grant / tender |

**What one school is worth (est.):** an average school has ≈ 620 pupils (6.87 M / 11,118), so about **280 in grades 5–9 → ≈ 33.6 M so'm/year** at the B2B price.

**Illustrative revenue (est.):** if 1 % of grade 5–9 learners (≈ 31,000) pay Premium for a 10-month school year, that is **≈ 15.2 bn so'm (≈ $1.27 M) per year**. Adding 100 schools on B2B brings **≈ 3.4 bn so'm** more.

## B3 · Competitive advantage
| | To2 | YouTube lessons | Offline tutor | Global AI tutors |
|---|---|---|---|---|
| Uzbek voice in & out | yes | listen only | yes | no / weak |
| Finds *your* gaps, builds a path | yes | no | sometimes | partly |
| Draws step by step while talking | yes | pre-recorded | yes | no |
| Local curriculum + terms (EKUK, EKUB, maxraj) | yes | varies | yes | no |
| Price | 49k so'm / month | free | 500k–1.3M so'm / month | subscription in USD |
| Fun (characters, XP, streaks) | yes | no | no | some |

**Moat over time:**
1. A skill graph and problem bank aligned to the national curriculum (47 skills today).
2. Anonymised learning data: which gaps are common and which explanations work.
3. A growing cache of reviewed lessons and voice. Every cached lesson makes the next learner cheaper to serve.

## B4 · Unit economics (why it is sustainable)

**Prices we pay (VoiceLab, Nov 2026)**
- **LLM** `aisha-gemma-4` (list price from `/v1/models`): 45 ¢ per 1M input tokens, 70 ¢ per 1M output tokens. One generated lesson ≈ 3k input + 1.5k output tokens ≈ **0.24 ¢**. One interruption answer ≈ 2k + 0.4k ≈ **0.12 ¢**.
- **Credits:** VoiceLab's price table lists $0.65 per 1M tokens = 8,125 credits, so **1 USD ≈ 12,500 credits** and **1 credit ≈ 0.96 so'm** (derived; the official conversion is in the API).
- **TTS:** `lison-v2` (expressive voice) ≈ **1.5 credits per character**. That is the rate our credit log (`/dev/credits`) applies; VoiceLab's public docs state 1 credit/char for the base `lison` voice, so these numbers err on the expensive side. A lesson (≈ 8 lines × 100 characters) ≈ **1,200 credits**; an answer to a question (≈ 3 lines × 60 characters) ≈ **270 credits**. Every clip is cached by `sha256(voice+text)`, so a line is paid for once, not once per learner.
- **STT:** billed per second of audio. TODO(team): read the rate from the VoiceLab Billing panel; it isn't on the public pricing page. Usage is small: ≈ 160 s per learner per month.
- **Hosting:** Cloudflare Workers + D1 + KV, pay per request, near-zero idle cost.

**Cost per active Premium learner / month** (20 lessons + 40 own questions, **est.**)
| | Early (few learners, little cache) | At scale (lessons pre-warmed) |
|---|---|---|
| LLM (≈ 50 % cache hits) | ≈ 5 ¢ ≈ 600 so'm | ≈ 600 so'm |
| TTS lessons | 10 uncached × 1,200 = 12,000 cr ≈ 11,500 so'm | ≈ 0 (one-time warm-up: 47 skills × 8 tutors × 1,200 cr ≈ 451k cr ≈ **433,000 so'm in total**) |
| TTS own questions | 28 uncached × 270 = 7,560 cr ≈ 7,300 so'm | 20 uncached × 270 = 5,400 cr ≈ 5,200 so'm |
| STT (≈ 160 s) | TODO(team): rate | TODO(team): rate |
| Hosting | ≈ 0 | ≈ 0 |
| **Total (before STT and payment fees)** | **≈ 19,400 so'm** | **≈ 5,800 so'm** |
| **Premium price** | 49,000 so'm | 49,000 so'm |
| **Gross margin** | **≈ 60 %** | **≈ 88 %** |

- **Free tier costs almost nothing:** its lessons come from the pre-warmed cache, and fresh questions get a text answer through the captions-only path that already exists. That leaves only the LLM, ≈ 30 answers × 0.12 ¢ ≈ **430 so'm/month**.
- **B2B:** with heavy use at scale, a student costs ≈ 10 months × 5,800 ≈ 58,000 so'm/year, against 120,000 so'm/year paid, a **≈ 50 % margin**. Lighter classroom use is cheaper.
- **Budget guard in the product:** a daily credit cap with a warning level, and captions-only above the hard cap. A demo or a viral spike can't run up an unbounded bill.

## B5 · Growth
- More subjects on the same engine: physics, chemistry (formulas on the board), English.
- Russian and Karakalpak UI (all strings are in `src/i18n/uz.ts`, ready for `ru`).
- Central Asia: Kazakh, Kyrgyz, Tajik (VoiceLab already lists `kk`, `ky`, `tg`).
- Channels: school partnerships (teacher panel), Telegram mini-app, parents' word of mouth (weekly report), Android app (APK already built with Capacitor).

## Sources
- OECD, *PISA 2022 Results — Country Note: Uzbekistan*: https://www.oecd.org/en/publications/pisa-2022-results-volume-i-and-ii-country-notes_ed6fbcc5-en/uzbekistan_2bb94bf1-en.html
- PISA 2025, Uzbekistan maths not reported: https://timesca.com/new-oecd-assessment-reveals-central-asias-student-performance/
- Pupils and schools 2025/26 (National Statistics Committee via UzDaily): https://uzdaily.ru/en/number-of-schools-in-uzbekistan-rises-to-11118-students-to-687-million/
- Tutor rates (advertised): https://repet.uz/uz/repetitory/matematika/ · https://education.ustabor.uz/uz/catalog/mathematics · https://darslinker.uz/repetitorlar
- Tutoring price growth 2025: https://talimxabarlari.uz/59522/
- Exchange rate: https://cbu.uz/uz/statistics/dks/4900641/ · https://daryo.uz/2026/11/11/ozbekistonda-dollar-kursi-yana-tushdi-3/
- VoiceLab prices: https://voicelab.uz/pricing · https://docs.voicelab.uz/api/tts · https://docs.voicelab.uz/api/stt
