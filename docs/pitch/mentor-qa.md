# Mentor Q&A — rehearse before judging

Short answers for the questions each mentor is likely to ask. Every teammate should be able to say any of these.
**Rule:** answer in one or two sentences, then *show* it (the live app, or a file). If you don't know, say "we measured X, Y is next", never guess.

---

## Technical mentor (T1–T5)

**1. "Is this real AI or a recorded video?"**
It's real: Uzbek speech → VoiceLab STT → VoiceLab LLM → our JSON board commands → VoiceLab TTS. Show it: ask a *new* question live. The demo questions are cached, so they're instant. A fresh one takes ~7 s to the first spoken line, with "Hmm…" fillers while the tutor thinks.

**2. "Why not just ChatGPT?"**
Four things ChatGPT doesn't do: it doesn't speak and hear **Uzbek** by voice, it doesn't **draw step by step on a board while talking**, it doesn't follow **our curriculum** (47 skills, EKUK/EKUB/maxraj terms), and it doesn't **check its own math**. We check every answer with mathjs in code, never with the LLM.

**3. "What if the LLM makes a math mistake?"**
Learner answers are checked by **mathjs** (`src/lib/learning/checker.ts`), not by the LLM. LLM output must pass a **zod schema** (`src/lib/ai/schema.ts`); if it fails we retry once with the error, then fall back to a canned lesson built from our problem generators. The 4 core lessons are hand-written.

**4. "How does the board drawing work?"** *(our key idea, T3)*
The LLM never draws pixels. It writes a tiny JSON language (`write`, `fractionbar`, `numberline`, `arrow`, `tick`…). Our code turns it into **single-stroke chalk handwriting** (`src/components/board/handwriting.ts`) and spreads it over the audio's duration, so the chalk moves while the tutor speaks. It's deterministic, cheap (no image generation), works on every screen size, and is unit-tested.

**5. "How do interruptions work?"**
`src/lib/lesson/player.ts` is a tested state machine: speaking → paused → listening → thinking → answering → resume. When you press "Savol berish" we save the exact audio position and chalk command. The answer is drawn on a separate note layer, and "Davom et" continues from the saved point.

**6. "Latency?"**
Measured on production: thinking pose + "Hmm…" filler in **26 ms**, filler voice in **0.3 s**. For a fresh question the first answer caption arrives in **~6 s** and the spoken answer lines at **~7 / 10 / 14 s**. A cached question takes **~2 s**. While a voice line is generating, the tutor says a short cached filler every ~3 s. If a line's voice isn't ready within 15 s, it plays with captions and a moving mouth, and the voice is cached for next time. The tutor never freezes.

**7. "What breaks at scale? Worker limits?"**
We already hit and fixed two real limits. KV's 1,000 writes/day cap made us move writes to D1. Reading audio as a D1 BLOB hit the Worker CPU limit (error 1102), so we store it as base64 text now. Both are in the git log.

**8. "What if VoiceLab is down or the money runs out?"**
All AI goes through adapters (`src/lib/ai/voicelab/*`), with a full **mock mode** (`MOCK_AI=1`) that runs the whole demo offline. There's a **daily credit cap** (`src/lib/server/credits.ts`): a warning level (15k/day, 40k on demo days), and above **40k/day** new lines are captions-only. A spike can't run up an unbounded bill.

**9. "Code quality?"**
TypeScript strict, zod on every API input and LLM output, **193 unit tests + 12 Playwright e2e** (mastery, roadmap, diagnostic, checker, board, player), Drizzle migrations, `.dev.vars.example`, README with run/deploy steps. The commit history shows the build step by step.

**10. "Why this stack?"**
Cloudflare Workers + vinext gives one deploy for UI + API on the edge with near-zero idle cost. D1 is SQL without a server, three.js renders a 20-box voxel tutor at 60 fps, mathjs checks answers deterministically, and VoiceLab is Uzbek-first. See `docs/ARCHITECTURE.md` → "Why this stack".

**10a. "Why the name Ilmobod?"**
*Ilm* = knowledge, *-obod* = the Uzbek town suffix: "the town of knowledge". *Har bir fan — bir shahar, har bir topshiriq — bir bino.* It is the product: each course is a town, each building is a quest.

## Business mentor (B1–B5)

**11. "Who pays?"**
Parents (Premium **49,000 so'm/month**, about 1/14 of a private tutor at ~680,000 so'm/month) and schools/learning centres (**120,000 so'm per student per year**, with the teacher panel). The tiers are hypotheses: **billing isn't built yet**. The free tier keeps diagnostic, roadmap and practice free.

**12. "What does one learner cost you?"**
About **19,400 so'm/month** early on and **~5,800 so'm** at scale (before STT and payment fees). Lessons are cached once per tutor, so only fresh questions cost money, giving a ≈ 60 % → 88 % gross margin. Full table: `docs/pitch/business.md` B4.

**13. "How big is the market?"**
**6.87 M** school pupils (2025/26), so ≈ **3.1 M** in grades 5–9. 1 % paying Premium ≈ **15 bn so'm/year**. One average school ≈ 280 learners in grades 5–9 ≈ 33.6 M so'm/year.

**14. "What's your moat? Can't a big company copy it?"**
A curriculum-aligned skill graph + problem bank, Uzbek voice and terminology, and the data on *which gaps are common and which explanation fixes them*. That data grows with every learner. Every cached lesson also lowers our cost.

**15. "Why would kids use it?"**
Characters, XP, streaks, unlockable tutors, and a diagnostic that feels like a game (no timers, no red X). They can also ask questions they'd be shy to ask in class.

**15a. "Other teams have an all-subjects lab. Why you?"**
A lab is a menu. We have (1) **a game world with a reason to come back**: towns grow and buildings open in the order your placement test decided; (2) **accessibility**: Inklyuziv rejim is voice-first, captioned, hands-free, calm/dyslexia mode; (3) **native Uzbek voice** tutors (Lola, Ziyo, Blokbek on VoiceLab).

**15b. "Why Gemini for English?"**
Only for pronouncing English words (native accent, cached once per word). The tutor still explains in Uzbek on VoiceLab.

## Domain mentor (S1–S5)

**16. "Which official problem do you solve?"**
Ministry task **#3, Shaxsiylashtirilgan o'qitish**, word for word: *O'zbek tilida ishlaydigan* (Uzbek voice), *bilimdagi bo'shliqlarni aniqlab* (adaptive diagnostic + mastery), *individual o'quv trayektoriyasi* (personal roadmap), *SI-tyutor* (the talking, drawing tutor). The teacher panel touches task #4.

**17. "Why does it matter?"**
In **PISA 2022 only 19 %** of Uzbek 15-year-olds reached basic Level 2 in maths (OECD 69 %); the score was 364 vs 472. *If asked about PISA 2025:* it came out in Sep 2026, but Uzbekistan's maths result wasn't reported because of data inconsistencies, so 2022 is the latest maths figure.

**18. "How do you know the diagnostic is right?"**
Honest answer: it's 8 adaptive questions on the prerequisite graph. It goes *down* after a miss to find the real gap (a fractions error may really be an EKUK gap), and *up* after a hit. Mastery is a simple BKT-lite rule (start 0.3, +25 % of the remainder when right, ×0.6 when wrong). **It's not validated yet.** The next step is a pilot class, comparing against teacher grades.

**19. "Is the content correct for our curriculum?"**
47 skills in 10 sections, grades 5–9, using Uzbek school terms. It hasn't been reviewed by a teacher yet; that's the first thing we'd do (it's marked in `pedagogy.md`).

**20. "Personal data / children / the law?"**
We collect **minimum data**: a nickname and grade with an anonymous id, no name, phone or photo. **Voice is never stored.** There are no ads or trackers, a parental-consent line for under-16s and a privacy page in Uzbek (`/maxfiylik`). The law (ZRU-547, Art. 27¹) required citizens' data to be stored in Uzbekistan. Since the **27 March 2026 amendment**, mandatory localisation reportedly covers mainly **biometric/genetic** data, and we store none (voice is never kept). We still plan the stricter setup for production: the user DB in a local data centre, with Cloudflare serving only the app and non-personal caches. A lawyer hasn't reviewed this yet; we say so.

**21. "Are the characters copyrighted game characters?"**
No. All 8 are our own designs, game-*inspired* voxel style only, with no names, skins or assets from any game. They're kid-safe: no weapons.

**22. "Does it work on a cheap phone / bad internet?"**
It's a web app (no install), plus an Android APK. The 3D tutor loads only on the lesson screen, audio is cached, and there are CSS fallbacks for old WebViews (tested on an Android 11 emulator). If the voice is slow, captions are always on.

**23. "What happens with an off-topic or bad question?"**
The prompt tells the tutor to give one friendly sentence steering back to math, then resume the lesson. Answers are short and math-only.

---

## Things NOT to claim
- That billing / Premium exists (it doesn't yet).
- Anything about the town, games, physics, English or Inklyuziv rejim that isn't running on the demo URL (they were in feature branches on 18 Nov; check after the merge).
- That inclusive mode is certified or tested with learners with disabilities (it isn't yet).
- That the diagnostic is scientifically validated (it isn't yet).
- That a teacher or lawyer has reviewed the content / legal setup (not yet).
- Exact STT cost (rate not public; ask VoiceLab).
- That all data is already stored in Uzbekistan (it's the production plan, not the MVP).
