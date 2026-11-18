# Ilmobod — the story in one page

**Name:** *Ilmobod* = **ilm** (knowledge) + **-obod**, the Uzbek town suffix (as in Xonobod, Obod) → **"the town of knowledge"**.
**Tagline:** *Har bir fan — bir shahar. Har bir topshiriq — bir bino.* (Every subject is a town. Every task is a building.)

## Core loop
Each **course is a voxel town**. Each **building is a quest**:

| Building | Quest | What happens |
|---|---|---|
| **Maktab** (school) | board lesson | a talking Uzbek tutor explains on the chalkboard, stroke by stroke; the learner can interrupt by voice |
| **Arena** | mini-game | quick practice as a game round |
| **Kutubxona** (library) | test | checks the skill; feeds the mastery score |
| **Ustaxona** (workshop) | career mission *"Kasb sinovi"* | the skill used in a real job scenario |
| **Ibodatxona / minora** (temple) | mastery | the skill's final building: lit up when the skill is mastered |

**The placement test decides the map.** The adaptive diagnostic finds the learner's gaps; the personal roadmap then decides **which buildings unlock first**. Two learners in the same town see different open buildings. This is the ministry's task #3 (*bo'shliqlarni aniqlab, individual o'quv trayektoriyasi*) shown as a place, not a list.

## Courses (towns)
- **Matematika:** 47 skills, grades 5–9, the full board-lesson engine.
- **Fizika:** same engine, formulas and diagrams on the board.
- **Ingliz tili:** English words pronounced by **Gemini TTS** (cached), explained by an Uzbek tutor.

## Inklyuziv rejim (inclusive mode)
- **Voice-first lessons:** the tutor speaks every step; the learner answers by voice.
- **Live captions** on everything the tutor says (sound-off works too).
- **Hands-free voice commands:** "keyingi", "orqaga", "och", "davom et" move through the town and the lesson.
- **Calm / dyslexia mode:** fewer animations, softer colours, a dyslexia-friendly font and wider spacing.

## Tutors with real Uzbek voices
**Lola**, **Ziyo**, **Blokbek** (and more) speak on **Uzbek VoiceLab voices**, each with their own voice and teaching style. Lola is a female tutor, warm and patient.

## Why us, not an "all-subjects lab"
Other teams show a lab with every subject in one menu. We differ on three things:
1. **A game world with a reason to come back.** Towns grow, buildings light up, tutors unlock. A menu has no "tomorrow".
2. **Accessibility built in.** Voice-first, captions, hands-free and calm mode reach learners a lab leaves out (low vision, motor or reading difficulties, kids who can't type yet).
3. **Native Uzbek voice.** The tutor hears and speaks Uzbek and uses school terms (*kasr, maxraj, EKUK*), not a translated English tutor.

## What is built (be honest on stage)
- **Everything below is live on the demo URL** (https://to2.locallabs-io.workers.dev, release `8bf833a`, 18 Nov): math lessons on the board,
  voice interrupt, diagnostic, roadmap + course towns (Matematika, Fizika, Ingliz tili), games + career missions (O'yinlar, Kasb sinovi),
  Fizika (7-sinf), Ingliz tili (Beta, pinned "To be" lesson + practice), Inklyuziv rejim, 8 tutors, Ilmobod brand.
- English 🔊 word pronunciation (Gemini) is built but switched off until its API key is set — the button stays hidden; don't promise it on stage.
