# Inklyuziv rejim — To2 hamma uchun

To2 works for learners who are blind or have low vision, are deaf or hard of hearing, have motor
difficulties, or have attention difficulties or dyslexia. Where to switch it on: the **"Qulaylik"**
badge on the splash screen, the **"Sizga qanday qulay?"** step right after onboarding, and
**Sozlamalar → Qulaylik**. A learner can combine the 4 presets and also turn each option on or off
by itself. Settings stay on the device only (localStorage), because disability is sensitive personal
data. The OS settings **"reduce motion"** and **"increase contrast"** are always respected, even when
no option is chosen.

| Preset | What it switches on | What the learner gets |
|---|---|---|
| **Ko'zi ojiz / zaif ko'ruvchi** (blind / low vision) | voice first · high contrast · 150 % text · big buttons | When the tutor stops, the new board writing is **spoken** (fractions, powers, roots, EKUK… through `speakMath`: *"iks kvadrat minus besh iks qo'shuv olti teng nol"*). "Doskani o'qib berish" reads the whole board. Quiz and diagnostic questions are read with their options (*"A javob: to'rtdan uch…"*) and can be **answered by voice** ("javob B", "be", "birinchisi", or a number). All of this also goes to an app-wide live region for TalkBack / VoiceOver / NVDA. Captions are an `aria-live` region, controls have Uzbek labels, and focus moves in a logical order. |
| **Eshitishda qiyinchilik** (deaf / hard of hearing) | big captions · vibration | **Large live captions** under the board. The word being spoken is highlighted, timed from the real audio position. A big coloured **indicator with an icon and a word**: *Ustoz gapiryapti / o'ylayapti / sizni tinglayapti / Sizning navbatingiz*. A **vibration** (`navigator.vibrate`) on every new step. No information is given only by sound: every spoken line is also on screen. |
| **Harakatda qiyinchilik** (motor) | hands-free voice commands · big buttons | While the lesson waits (a question, "Davom etamizmi?", the end) the app **keeps listening** for commands: *davom et · qaytar · sekinroq · tezroq · tushunmadim · javob A/B/C/D · doskani o'qi · to'xta · bosh sahifa*. A question of 3 or more words goes to the tutor. The lesson's big mic button runs these commands too. Tap targets are ≥ 56 px. There are no time limits anywhere in the app. |
| **Diqqat / disleksiya** (attention / dyslexia) | calm mode · dyslexia font · speed 0.9× | **Calm mode**: no bouncing, confetti or animated transitions; the 3D tutor uses its reduced-motion mode; captions show **one sentence at a time**. The **Lexend** font with wider letter, word and line spacing. A **speech-speed slider from 0.75× to 1.25×**. |

**How it is built.** `src/lib/a11y/` holds the pieces:
- `settings.ts`: zustand store, presets, OS preferences
- `commands.ts`: the voice-command parser
- `narrator.ts`: board and question to Uzbek speech
- `speech.ts`: live region, narration voice and vibration
- `recognition.ts`: the browser speech recogniser

The UI is in `src/components/a11y/`:
- `A11yRoot`: sets `<html data-*>` and owns the live region
- `QulaylikPanel` and the `/qulaylik` page
- `LessonA11y`
- `QuizA11y`

The lesson code is untouched apart from hooks marked `// a11y-hook`: two lines in `LessonPlayer`, and in `engine.ts` a getter for the line being spoken plus a command hook on the mic path.

**Voice commands for the town and the games: the `to2:voice` event.** In hands-free mode the app
also listens on every other screen (`GlobalVoiceCommands`): the town, the games and home. Commands
are sent as a `window` CustomEvent named **`to2:voice`**, the format feat/roadmap's TownScreen
already listens for, so those screens import nothing from the inclusive mode:

```ts
window.addEventListener("to2:voice", (e) => {
  const d = (e as CustomEvent).detail; // { command: "next" | "prev" | "open" | "back" | "continue" | "home" } or { command: "answer", n: 1–4 }
});
```

| Learner says | `detail` |
|---|---|
| *keyingi bino* / *keyingi uy* | `{ command: "next" }` |
| *oldingi bino* | `{ command: "prev" }` |
| *ochish*, *och*, *kirish* | `{ command: "open" }` |
| *orqaga* | `{ command: "back" }` |
| *davom et* | `{ command: "continue" }` |
| *bosh sahifa* | `{ command: "home" }` |
| *javob bir / ikki / uch / to'rt* (or *javob A–D*, *javob 2*) | `{ command: "answer", n: 1–4 }` (games) |

When no screen handles *orqaga* or *bosh sahifa*, the app goes back in history or opens /home itself.
There is one exception: on `/town/…` the town screen does this on its own, and because it doesn't
call `preventDefault()`, the app skips its fallback there so nothing navigates twice. Any other
listener can call `e.preventDefault()` to say "handled". Lesson-only commands (*sekinroq*,
*qaytar*, *to'xta*…) are not sent. The lesson and quiz screens run their own recogniser and pause
the app-wide one (`claimListening`). Any town or game command they don't use themselves is sent as
`to2:voice`.

**Cost: 0 VoiceLab credits.** Narration plays in the tutor's voice only when `/api/tts?check=1` says the line is already cached. Otherwise the device's own speech synthesiser reads it, and the live region always has the text. Always-on listening uses the browser recogniser (`uz-UZ`), not VoiceLab STT.

**Tests.**
- `src/lib/a11y/commands.test.ts`: command parser and presets.
- `src/lib/a11y/narrator.test.ts`: 13 formulas, the board and a quiz question.
- `e2e/a11y.spec.ts`: axe-core (WCAG 2.1 A/AA) on 6 screens (splash, Qulaylik, home, settings, lesson, quiz), with the mode **off and on**: **0 serious or critical violations**. It also checks that presets switch the modes on, and that the hearing mode shows captions and the indicator.
- Fixing the baseline violations meant small app-wide changes: brand blue `#2f6bff` → `#2a5ce8` (white text on it went from 4.49:1 to 5.5:1), muted text `#6b7393` → `#5f6787`, tab labels darkened, the progress bar labelled, and the tutor carousel made focusable.

**Limits (honest).**
- Browser speech recognition and Uzbek synthesis voices depend on the device. Chrome on Android is best. iOS has no vibration API, so the visual indicator is the cue there.
- Without an Uzbek device voice, narration that isn't cached is left to the screen reader through the live region.
- Spoken number answers work for digits as the recogniser writes them. Number words ("o'n ikki") are not parsed yet.
- LLM segment length is unchanged: segments are already ≤ 2 sentences, and calm mode shortens what is *shown*, not what is generated.
- The 150 % text size uses CSS `zoom` (the UI uses px sizes); the lesson stage keeps its own scale.
- To verify with real users: TalkBack on a real Android phone, with a blind learner and a teacher from a special school.
