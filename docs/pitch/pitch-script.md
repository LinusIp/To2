# 3-minute pitch + demo-day checklist

**One story, not 20 features:** *Ilmobod — har bir fan bir shahar, har bir topshiriq bir bino. The placement test finds the gap → the town opens the right building → the tutor explains it on the board in Uzbek → you interrupt → the building lights up.*
Speaker A talks; speaker B holds the phone (screen mirrored). Practise until it fits in 3:00.

## 0:00–0:30 · Problem
> "In PISA 2022 only **19 %** of Uzbek 15-year-olds reached the basic level in maths; the OECD average is 69 %. Gaps start early: if you miss fractions in grade 5, algebra breaks in grade 7. A private tutor costs about **680,000 so'm a month**, and most families can't pay that. Global AI tutors don't speak Uzbek."
> "Meet **Ilmobod**, the town of knowledge. *Har bir fan — bir shahar. Har bir topshiriq — bir bino.* We solve the ministry's **task #3** word for word: an AI tutor that **works in Uzbek**, **finds knowledge gaps** and **builds an individual learning path**."

## 0:30–2:00 · Live demo (B drives, A narrates)
1. **Diagnostic (20 s):** grade 6, Blokbek → answer *1/2 + 1/4* wrong, the rest right. *"No timers, no red X. It feels like a game, but underneath it walks the prerequisite graph to find the real gap."*
2. **Town (15 s):** the Matematika town opens; the roadmap has unlocked the **Maktab** for *Maxrajlari har xil kasrlarni qo'shish* first. *"Their test decided which buildings open. School is a lesson, the arena is a game, the library is a test, the workshop is a career mission, the temple is mastery."*
3. **Lesson (30 s):** *Darsni boshlash*. Blokbek speaks Uzbek and writes 1/2 + 1/3 stroke by stroke. *"Nothing here is a video. The AI writes a small drawing language and our engine writes it in chalk, in time with the voice."*
4. **Interrupt (20 s):** hold **Savol berish**: *"Nega maxrajlarni ko'paytirdik?"* → it answers by voice and drawing → **Davom et** resumes at the exact word.
5. **Answer (10 s):** answer the in-lesson questions → XP → back in town the building lights up.
6. **Inclusive + other towns (10 s):** turn on **Inklyuziv rejim** and say *"keyingi"*: hands-free, captions on. Swipe to the **Ingliz tili** town: a word pronounced by Gemini. *"Same engine: math, physics, English."*

## 2:00–2:40 · Why it works and why it lasts
> "Others show a lab with every subject in a menu. We give three things a lab doesn't: **a game world with a reason to come back tomorrow**, **accessibility** for kids who can't read well or type, and a **native Uzbek voice**: Lola, Ziyo and Blokbek speak on Uzbek VoiceLab voices."
> "Answers are checked by code (mathjs), never by the AI. The whole thing runs on the edge for almost zero idle cost, and every spoken line is cached, so a lesson costs us once, not per learner. At scale one learner costs about **5,800 so'm a month**. Premium is **49,000**, one-fourteenth of a tutor. Schools pay **120,000 per student per year** for the teacher panel showing their class's weak skills."

## 2:40–3:00 · Close
> "6.87 million pupils, 3 million in grades 5 to 9. Next: a pilot class with a teacher, then Russian and more towns. Ilmobod: *har bir fan — bir shahar*. A personal tutor in their own language, for the price of a phone."

---

## Demo-day checklist
- [ ] **Real phone test of the mic**, 3 full runs of the path above (the permission prompt appears on the first run).
- [ ] Phone charged, brightness up, Do Not Disturb, browser tab already open at the landing page, a fresh guest (no old progress).
- [ ] Mirror the screen (cable or app) and test it in the room. A hotspot is the backup if the venue Wi-Fi is bad.
- [ ] Check `/dev/credits`: today's total well under the 40k hard cap, otherwise fresh lines are captions only.
- [ ] Laptop open on the same URL for the "responsive" moment, plus a tablet if you have one.
- [ ] If a mentor asks their own question: say "ask anything about fractions". Expect ~7 s to the first spoken line; the tutor fills the wait with "Hmm…". Don't apologise; say "it's generating live in Uzbek."
- [ ] Each teammate has read `mentor-qa.md` and can answer at least: *Why not ChatGPT? What if the AI is wrong? Who pays? Where is the data?*
- [ ] Fallback if the network dies: the 2-minute screen recording of the path (record it today).
