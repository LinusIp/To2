# Pedagogy — why To2 teaches this way

## Curriculum alignment
- 47 skills in 10 sections, grades 5–8(9): *Natural sonlar · Bo'linish va EKUK/EKUB · Kasrlar · O'nli kasrlar · Foizlar · Manfiy sonlar · Ifodalar · Chiziqli tenglamalar · Geometriya · Koordinatalar va grafiklar* (`src/data/skills.uz.json`).
- Uzbek school terminology throughout: *kasr, surat, maxraj, EKUK, EKUB, tenglama, noma'lum, perimetr, yuz, abssissa*.
- TODO(team): have a math teacher check the skill list and grade placement against the current official programme.

## Principles we implement
| Principle | In the product |
|---|---|
| **Mastery learning** | Each skill has a mastery score; a skill is "O'zlashtirildi" only at ≥ 85%. The roadmap does not move on until the foundations are solid. |
| **Diagnose before teaching** | An 8-question adaptive diagnostic walks *down* the prerequisite graph when a learner misses, to find the real gap (e.g. a fractions mistake may really be an EKUK gap). |
| **Prerequisite-ordered path** | Weak skills + their unmastered prerequisites, in topological order — the learner always studies what they are ready for. |
| **Socratic method** | The tutor explains one small step, draws it, then asks. It never dumps the full solution. |
| **Dual coding (words + pictures)** | Speech and chalk drawing happen together: fraction bars, number lines, balance scales, area grids. |
| **Concrete → abstract** | Fractions as blocks (*Blokbek*), equations as a balance, area as tiles, before the formula. |
| **Immediate, kind feedback** | Every answer is checked instantly (mathjs). Wrong answers get a friendly hint, never a red error screen; after 2 misses: "Ko'rsatib ber". |
| **Questions are welcome** | The learner can interrupt at any moment by voice; the answer is drawn in a side note and the lesson resumes exactly where it stopped. |
| **Retrieval practice** | Infinite generated practice problems per skill; mastery grows with each correct answer. |
| **Motivation** | Characters, XP, levels, streaks, unlockable tutors — game feel without ads or pressure (no timers in the diagnostic). |
| **Accessibility** | Captions always on (sound-off works and doubles as reading practice), keyboard operable, large tap targets, reduced-motion respected. |

## What we measure
Per learner and skill: attempts, correct answers, hints used, time per answer, mastery over time. Per class (teacher panel): which skills are weak for most students → one-click practice sets.

## Honest limits (MVP)
- Mastery model is a simple BKT-lite rule, not a fitted model yet.
- LLM-generated lessons are validated for format and answers are checked by code, but explanations are not yet reviewed by teachers — the 4 core demo lessons are hand-written.
