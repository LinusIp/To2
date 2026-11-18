"use client";
// Lesson engine: owns audio, the chalk timeline and the barge-in flow.
// UI reads everything from the zustand store; side effects live in module scope.
import { create } from "zustand";
import type { Emotion, Expect, LessonSegment } from "@/lib/ai/schema";
import { SIDE_BOARD, sideSpot, type BoardEl } from "@/lib/board/model";
import { isRestartRequest } from "./intents";
import { applyCommand, describeBoard, emptyBoard, fadeHighlights, isDraw, scheduleSegment, scheduleLength, type BoardState, type Layer, type Slot } from "@/lib/board/model";
import { loadSpeech, prefetchSpeech, speak, unlockAudio, type Clip, type Speech } from "@/lib/audio/player";
import { speakMath } from "@/lib/ai/speakMath";
import { resolveStart, type StartAt } from "./resume";
import { startRecording, stopRecording, micSupported } from "@/lib/audio/recorder";
import { initialPlayer, transition, type PlayerEvent, type PlayerState } from "./player";
import { readTutorStream } from "./sse";

import { tutorGate } from "@/lib/board/tip";
import { t as T } from "@/i18n/uz";

export interface TranscriptItem {
  who: "tutor" | "me";
  text: string;
  voice?: boolean;
  highlight?: boolean;
}

export interface Feedback {
  kind: "correct" | "wrong";
  text: string;
  xp?: number;
}

export interface LessonStore {
  player: PlayerState;
  skillId: string;
  characterId: string;
  voice: string;
  grade: number;
  main: LessonSegment[];
  mainDone: boolean;
  note: LessonSegment[];
  noteDone: boolean;
  track: "main" | "note";
  mainIndex: number;
  noteIndex: number;
  board: BoardState;
  active: { key: string; p: number } | null;
  caption: string;
  emotion: Emotion;
  transcript: TranscriptItem[];
  expect: Expect | null;
  misses: number;
  rate: number;
  muted: boolean;
  feedback: Feedback | null;
  celebrate: number;
  waiting: boolean; // waiting for the next streamed segment
  /**
   * The tutor's stream (main lesson or live answer) closed WITHOUT the server's `done`: we show
   * "Davom etamizmi?" once playback reaches the end of what arrived, and retryStream() resumes it.
   */
  broken: "main" | "note" | null;
  /** which path answered the last live question (pinned / interrupt-cache / llm / …) — dev only */
  answerSource: string;
  /** a line's voice is still being made: the tutor is in the think pose ("o'ylayapman…") */
  voiceWait: boolean;
  error: string | null;
  xpGained: number;
  masteryAfter: number | null;
}

const initial = (): Omit<LessonStore, "skillId" | "characterId" | "voice" | "grade"> => ({
  player: initialPlayer,
  main: [],
  mainDone: false,
  note: [],
  noteDone: false,
  track: "main",
  mainIndex: 0,
  noteIndex: 0,
  board: emptyBoard(),
  active: null,
  caption: "",
  emotion: "neutral",
  transcript: [],
  expect: null,
  misses: 0,
  rate: 1,
  muted: false,
  feedback: null,
  celebrate: 0,
  waiting: false,
  broken: null,
  answerSource: "",
  voiceWait: false,
  error: null,
  xpGained: 0,
  masteryAfter: null,
});

export const useLesson = create<LessonStore>(() => ({
  ...initial(),
  skillId: "",
  characterId: "blokbek",
  voice: "blokbek",
  grade: 6,
}));

const get = useLesson.getState;
const set = useLesson.setState;

function fire(e: PlayerEvent) {
  set((s) => ({ player: transition(s.player, e) }));
}

// ── timeline ────────────────────────────────────────────────────────────────
interface Timeline {
  gen: number;
  track: "main" | "note";
  index: number;
  layer: Layer;
  cmds: LessonSegment["board"];
  slots: Slot[] | null;
  applied: number;
  offset: number; // ms of timeline already played
  start: number; // performance.now() when (re)started
  running: boolean;
  speechEnded: boolean;
}

let tl: Timeline | null = null;
let speech: Speech | null = null;
let raf = 0;
let gen = 0;
/** where the main lesson paused, to resume EXACTLY there */
let mainResume: { index: number; t: number; applied: number; audioMs: number } | null = null;
let lastQuestion = "";
/** separate controllers: asking a question must never abort the lesson that is still streaming in */
let mainAbort: AbortController | null = null;
let noteAbort: AbortController | null = null;

const now = () => performance.now();
const tlTime = (x: Timeline) => x.offset + (x.running ? (now() - x.start) * get().rate : 0);

function tick() {
  const x = tl;
  if (!x || !x.running || !x.slots) return;
  // the tutor is still turning / walking to the stroke: hold the chalk where it is
  if (tutorGate.hold) {
    x.offset = tlTime(x);
    x.start = now();
  }
  const t = tlTime(x);
  let board = get().board;
  let changed = false;
  while (x.applied < x.cmds.length && x.slots[x.applied].start <= t) {
    board = applyCommand(board, x.cmds[x.applied], x.layer);
    x.applied++;
    changed = true;
  }
  // active = the latest draw command still in progress
  let active: LessonStore["active"] = null;
  for (let i = x.applied - 1; i >= 0; i--) {
    const c = x.cmds[i];
    const sl = x.slots[i];
    if (sl.end <= t) break;
    if (isDraw(c)) {
      active = { key: `${x.layer}:${c.id}`, p: Math.min(1, Math.max(0, (t - sl.start) / (sl.end - sl.start))) };
      break;
    }
  }
  set(changed ? { board, active } : { active });
  if (x.speechEnded && t >= scheduleLength(x.slots) && x.applied >= x.cmds.length) {
    x.running = false;
    set({ active: null });
    onSegmentDone(x.gen, x.track, x.index);
    return;
  }
  raf = requestAnimationFrame(tick);
}

function stopTimeline() {
  cancelAnimationFrame(raf);
  if (tl) {
    tl.offset = tlTime(tl);
    tl.running = false;
  }
}

function flushTimeline() {
  // apply any remaining commands instantly (used when skipping)
  if (!tl) return;
  let board = get().board;
  while (tl.applied < tl.cmds.length) board = applyCommand(board, tl.cmds[tl.applied++], tl.layer);
  set({ board, active: null });
}

async function playSegment(track: "main" | "note", index: number, resume?: { t: number; applied: number; audioMs: number }) {
  const s = get();
  const list = track === "main" ? s.main : s.note;
  const seg = list[index];
  if (!seg) return;
  const my = ++gen;
  speech?.stop();
  cancelAnimationFrame(raf);
  if (track === "main") saveProgress(s.skillId, s.characterId, index);

  set({
    track,
    [track === "main" ? "mainIndex" : "noteIndex"]: index,
    caption: seg.say,
    emotion: seg.emotion,
    voiceWait: false,
    expect: null,
    feedback: track === "main" ? null : s.feedback,
  } as Partial<LessonStore>);
  if (!resume) set((st) => ({ transcript: [...st.transcript, { who: "tutor", text: seg.say, highlight: seg.type === "ask" }] }));

  // prefetch the next one while this plays
  const next = list[index + 1];
  if (next) prefetchSpeech(next.say, s.voice, { emotion: next.emotion });

  const layer: Layer = seg.layer ?? (track === "note" ? "note" : "main");
  tl = { gen: my, track, index, layer, cmds: seg.board, slots: null, applied: resume?.applied ?? 0, offset: resume?.t ?? 0, start: now(), running: false, speechEnded: false };
  // VOICE FIRST, THEN THE BOARD: never draw in silence. Wait (≤ 15 s) for this line's audio while the
  // tutor thinks out loud with cached fillers and the caption is already in the bubble; then speak it
  // and start writing at the same moment. Only if no audio comes: say so once, then captions-only.
  const tone = { emotion: seg.emotion, lead: track === "note" && index === 0 && !resume };
  let clip: Clip | null = null;
  if (!s.muted) {
    const r = await waitForVoice(seg, tone, my);
    if (my !== gen || !tl) return;
    if (r && r !== "none") clip = r;
    else if (performance.now() - delayNoticeAt > 60_000) {
      // last resort (at most once a minute): explain, then write in captions-only mode
      delayNoticeAt = performance.now();
      set({ caption: DELAY_LINE });
      const d = speak(DELAY_LINE, s.voice, { rate: s.rate, emotion: "encouraging" });
      speech = d;
      await d.ended;
      if (my !== gen || !tl) return;
      set({ caption: seg.say });
    }
  }
  const sp = speak(seg.say, s.voice, { rate: s.rate, fromMs: resume?.audioMs, muted: s.muted || !clip, emotion: seg.emotion, clip: clip ?? undefined });
  speech = sp;
  const dur = await sp.started;
  if (my !== gen || !tl) return;
  tl.slots = scheduleSegment(seg.board, dur);
  tl.start = now();
  tl.running = true;
  raf = requestAnimationFrame(tick);
  await sp.ended;
  if (my !== gen || !tl) return;
  tl.speechEnded = true;
  if (!tl.running) {
    // paused exactly as speech ended — tick() will finish on resume
  }
}

/** said once (≤ 1 per minute) when a line's voice didn't come within VOICE_WAIT_MS */
export const DELAY_LINE = "Ovozim biroz kechikmoqda, yozib ko'rsataman.";
/** cached thinking sounds played every ~3 s while a line's voice is being made */
export const WAIT_FILLERS = ["Hmm…", "Qani, o'ylab ko'raylik…", "Bir daqiqa…"];
/** how long a line (lesson or live answer) waits for its voice before going captions-only */
export const VOICE_WAIT_MS = 12_000;
const FILLER_EVERY_MS = 3000;
/** cached lines come back well within this: no filler for them */
const FILLER_GRACE_MS = 900;
let delayNoticeAt = -Infinity;
/** true while a segment waits for its voice (a barge-in then resumes the segment from its start) */
let waitingVoice = false;

/**
 * Wait for a line's audio (≤ VOICE_WAIT_MS). If it isn't there within a moment, the tutor goes into
 * the think pose and says a short cached filler every ~3 s; the caption is already in the bubble.
 */
async function waitForVoice(seg: LessonSegment, tone: { emotion: string; lead: boolean }, my: number): Promise<Clip | "none" | null> {
  const s = get();
  let result: Clip | "none" | null | undefined;
  const load = loadSpeech(seg.say, s.voice, tone, VOICE_WAIT_MS).then((r) => (result = r));
  await Promise.race([load, new Promise((r) => setTimeout(r, FILLER_GRACE_MS))]);
  if (result !== undefined || my !== gen) return result ?? null;
  waitingVoice = true;
  const emotion = get().emotion;
  set({ emotion: "thinking", voiceWait: true });
  let k = 0;
  while (result === undefined && my === gen) {
    const t0 = performance.now();
    const f = speak(WAIT_FILLERS[k++ % WAIT_FILLERS.length], s.voice, { rate: s.rate, emotion: "thinking", startTimeoutMs: 2500 });
    speech = f;
    await f.ended; // a filler always finishes (they're short) — the real line never talks over it
    if (result !== undefined || my !== gen) break;
    await Promise.race([load, new Promise((r) => setTimeout(r, Math.max(0, FILLER_EVERY_MS - (performance.now() - t0))))]);
  }
  waitingVoice = false;
  if (my === gen) set({ emotion, voiceWait: false });
  await load;
  return result ?? null;
}

function onSegmentDone(g: number, track: "main" | "note", index: number) {
  if (g !== gen) return;
  set((st) => ({ board: fadeHighlights(st.board) })); // a step's highlight fades when the step ends
  const s = get();
  if (track === "main") {
    const seg = s.main[index];
    if (seg?.type === "ask" && seg.expect) {
      fire({ type: "ASK_REACHED" });
      set({ expect: seg.expect, misses: 0 });
      return;
    }
    nextMain();
  } else {
    if (index + 1 < s.note.length) void playSegment("note", index + 1);
    else if (!s.noteDone) {
      set({ waiting: true });
      showStuckPrompt();
    } else {
      fire({ type: "REPLY_END" });
      set({ caption: s.note[index]?.type === "check" ? s.note[index].say : T.lesson.understood });
    }
  }
}

function nextMain() {
  const s = get();
  const i = s.mainIndex + 1;
  if (i < s.main.length) void playSegment("main", i);
  else if (!s.mainDone) {
    set({ waiting: true, mainIndex: i });
    showStuckPrompt(); // the stream already broke: ask "Davom etamizmi?" instead of waiting forever
  } else {
    fire({ type: "FINISH" });
    clearProgress(s.skillId, s.characterId);
    set({ caption: T.lesson.finished, emotion: "excited", celebrate: get().celebrate + 1 });
    void fetch("/api/lesson", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ skillId: s.skillId, finished: true }) }).catch(() => {});
  }
}

// ── resume after a refresh / leaving the page ────────────────────────────────
// The segment being played is saved per (skill, tutor) on the device; the next visit offers
// "Davom etish" and starts there (earlier boards are re-applied instantly). Cleared at the end.
const PROGRESS_TTL = 7 * 24 * 3600_000;
const progKey = (skillId: string, characterId: string) => `to2:lesson:${skillId}:${characterId}`;
function saveProgress(skillId: string, characterId: string, index: number) {
  try {
    localStorage.setItem(progKey(skillId, characterId), JSON.stringify({ i: index, at: Date.now() }));
  } catch {
    /* private mode / storage off: resume just isn't offered */
  }
}
function clearProgress(skillId: string, characterId: string) {
  try {
    localStorage.removeItem(progKey(skillId, characterId));
  } catch {
    /* ignore */
  }
}
/** Saved segment index for this lesson (0 = start from the beginning). */
export function savedProgress(skillId: string, characterId: string): number {
  try {
    const v = JSON.parse(localStorage.getItem(progKey(skillId, characterId)) ?? "null") as { i: number; at: number } | null;
    return v && Date.now() - v.at < PROGRESS_TTL && v.i > 0 ? v.i : 0;
  } catch {
    return 0;
  }
}
export function forgetProgress(skillId: string, characterId: string) {
  clearProgress(skillId, characterId);
}

let startAt: StartAt = 0;
let began = false;

function begin(streamDone: boolean) {
  const s = get();
  if (began || !s.waiting || s.player.status !== "speaking") return;
  const i = resolveStart(s.main, startAt, streamDone);
  if (i === null) return;
  began = true;
  set({ waiting: false });
  if (i > 0) {
    // fast-forward: re-draw the earlier boards instantly, keep their lines in the transcript
    let board = emptyBoard();
    for (const seg of s.main.slice(0, i)) for (const c of seg.board) board = applyCommand(board, c, seg.layer === "note" ? "note" : "main");
    set({ board, transcript: s.main.slice(0, i).map((x) => ({ who: "tutor" as const, text: x.say })) });
  }
  void playSegment("main", i);
}

/** The page went to the background: pause exactly where we are (like a barge-in, without the mic). */
export function pauseForBackground() {
  const st = get().player.status;
  if (st === "speaking" || st === "awaiting") {
    bargeIn();
    pausedInBackground = true;
  }
}
/** Back in front: continue from the same spot. */
export function resumeFromBackground() {
  if (!pausedInBackground) return;
  pausedInBackground = false;
  if (get().player.status !== "paused") return;
  fire({ type: "CANCEL" });
  resumeAfterInterrupt(true);
}
let pausedInBackground = false;

// ── public API ───────────────────────────────────────────────────────────────
export function initLesson(opts: { skillId: string; characterId: string; grade: number; greeting?: string }) {
  gen++;
  speech?.stop();
  speech = null;
  tl = null;
  mainResume = null;
  mainAbort?.abort();
  noteAbort?.abort();
  cancelAnimationFrame(raf);
  set({
    ...initial(),
    skillId: opts.skillId,
    characterId: opts.characterId,
    voice: opts.characterId,
    grade: opts.grade,
    caption: opts.greeting ?? "",
  });
}

export function disposeLesson() {
  gen++;
  speech?.stop();
  mainAbort?.abort();
  noteAbort?.abort();
  cancelAnimationFrame(raf);
}

function context() {
  const s = get();
  const hist = s.transcript.slice(-6).map((x) => ({ role: x.who === "me" ? "user" : "assistant", text: x.text }));
  const cur = s.main[Math.min(s.mainIndex, s.main.length - 1)];
  // the lesson's board, even while an answer has it wiped; the step makes answers fit where the learner is
  const board = lessonBoard ? { ...s.board, els: lessonBoard } : s.board;
  return { skillId: s.skillId, characterId: s.characterId, grade: s.grade, segment: cur?.say ?? "", board: describeBoard(board), history: hist, step: Math.min(s.mainIndex, Math.max(0, s.main.length - 1)), steps: s.main.length };
}

/** Start the lesson: unlock audio (user gesture), stream segments. */
export async function startLesson(at: StartAt = 0) {
  unlockAudio();
  startAt = at;
  began = false;
  mainSource = "";
  fire({ type: "START" });
  set({ caption: T.common.loading, waiting: true, broken: null });
  await streamMain();
}

/** where the main lesson came from (meta event): decides how a retry resumes it */
let mainSource = "";

/**
 * Stream the main lesson. On a retry (`resume`) the server gets what we already have and sends
 * only the rest. The lesson counts as complete ONLY when the server's `done` arrives; a stream
 * that closes without it marks the lesson `broken` instead of silently ending it.
 */
async function streamMain(resume = false) {
  const s = get();
  mainAbort = new AbortController();
  let complete = false;
  try {
    const res = await fetch("/api/tutor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "lesson",
        skillId: s.skillId,
        characterId: s.characterId,
        grade: s.grade,
        ...(resume && s.main.length ? { resume: { source: mainSource || "llm", prior: s.main } } : {}),
      }),
      signal: mainAbort.signal,
    });
    const r = await readTutorStream(res, {
      onMeta: (m) => {
        if (!resume && typeof m.source === "string") mainSource = m.source;
      },
      onSegment: (seg) => {
        set((st) => ({ main: [...st.main, seg] }));
        if (!began) return begin(false);
        const st = get();
        if (st.waiting && st.player.status === "speaking") {
          set({ waiting: false });
          void playSegment("main", st.main.length - 1);
        }
      },
    });
    complete = r.done;
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
  }
  if (!complete) {
    // closed without `done` (or an error event): keep what arrived, offer to resume
    set({ broken: "main" });
    showStuckPrompt();
    return;
  }
  set({ mainDone: true, broken: null });
  if (!began) begin(true);
  const st = get();
  if (st.waiting && st.player.status === "speaking" && st.mainIndex >= st.main.length) {
    set({ waiting: false });
    nextMain();
  }
}

/** If playback has caught up with a broken stream, the bubble asks "Davom etamizmi?". */
function showStuckPrompt() {
  const s = get();
  if (!s.broken || !s.waiting) return;
  if ((s.broken === "main" && s.track === "main") || (s.broken === "note" && s.track === "note") || !began)
    set({ caption: T.lesson.streamBroken, emotion: "encouraging" });
}

/** [Davom etish] after a broken stream: fetch the rest and carry on from the last segment. */
export async function retryStream() {
  const s = get();
  if (s.broken === "main") {
    set({ broken: null, caption: T.common.loading });
    await streamMain(true);
  } else if (s.broken === "note") {
    set({ broken: null, caption: T.lesson.thinking });
    await streamNote(lastQuestion, lastSimpler, true);
  }
}

/** Learner pressed the mic / started typing: freeze everything. */
export function bargeIn() {
  const s = get();
  const st = s.player.status;
  if (!["speaking", "awaiting", "answering", "checking"].includes(st)) return;
  if (st === "speaking" && tl && tl.track === "main") {
    stopTimeline();
    mainResume = { index: tl.index, t: tl.offset, applied: tl.applied, audioMs: waitingVoice ? 0 : (speech?.position() ?? 0) }; // a filler was playing: restart the line
    speech?.pause();
  } else if (st === "answering" || st === "checking") {
    // interrupting the answer: drop it (nesting max 1)
    gen++;
    stopTimeline();
    speech?.stop();
    noteAbort?.abort();
    set((x) => ({ note: [], board: { ...x.board, els: x.board.els.filter((e) => e.layer !== "note") } }));
  } else if (st === "awaiting") {
    speech?.pause();
  }
  fire({ type: "BARGE_IN" });
  set({ emotion: "thinking", active: null });
}

export async function startListening(): Promise<boolean> {
  bargeIn();
  if (!micSupported()) {
    set({ error: T.lesson.micDenied });
    return false;
  }
  try {
    fire({ type: "LISTEN" });
    set({ caption: T.lesson.listening, error: null });
    await startRecording();
    return true;
  } catch {
    set({ error: T.lesson.micDenied });
    fire({ type: "CANCEL" });
    resumeAfterInterrupt();
    return false;
  }
}

export async function stopListening() {
  const rec = await stopRecording();
  if (get().player.status !== "listening") return;
  if (!rec) {
    fire({ type: "CANCEL" });
    resumeAfterInterrupt();
    return;
  }
  set({ caption: T.lesson.thinking });
  try {
    const fd = new FormData();
    fd.append("audio", rec.blob, "q.webm");
    const r = await fetch("/api/stt", { method: "POST", body: fd });
    const j = (await r.json()) as { text?: string };
    const text = (j.text ?? "").trim();
    if (!text) throw new Error("empty");
    await ask(text, true);
  } catch {
    set({ error: T.lesson.sttFailed });
    fire({ type: "CANCEL" });
    resumeAfterInterrupt();
  }
}

// ── where a live answer is written ──────────────────────────────────────────────
/** "main" = on the (wiped) main board; "note" = the side slate */
let noteDisplay: "main" | "note" = "note";
/** the lesson's main-board writing while an answer has the board wiped; put back on "Davom et" */
let lessonBoard: BoardEl[] | null = null;

/**
 * Before an answer's first segment: a main-board answer wipes the board (wipe animation; the lesson is
 * kept aside). A slate answer brings the lesson back first and hangs the slate where it covers no
 * writing — if there is no such spot, the slate goes on a wiped board too (the main-board path).
 */
function prepareAnswerBoard(display: "main" | "note") {
  const b = get().board;
  const lesson = lessonBoard ?? b.els.filter((e) => e.layer === "main");
  if (display === "main") {
    lessonBoard = lesson;
    set({ board: { els: [], noteDim: false } });
    return;
  }
  const spot = sideSpot({ els: lesson });
  if (spot) {
    lessonBoard = null;
    set({ board: { els: lesson, noteDim: false, side: spot } });
  } else {
    lessonBoard = lesson;
    set({ board: { els: [], noteDim: false, side: { x: SIDE_BOARD.x, y: SIDE_BOARD.y } } });
  }
}

/** Put the lesson's board back (the answer's writing wipes out). Returns whether it did. */
function restoreLessonBoard(): boolean {
  if (!lessonBoard) return false;
  const els = lessonBoard;
  lessonBoard = null;
  set((s) => ({ board: { ...s.board, els, noteDim: false, side: undefined } }));
  return true;
}

/**
 * "Boshidan…", "qaytadan", "doskani o'chir", "tushunmadim": the lesson restarts from step 1 with its
 * cached segments (instant voice); the board is wiped; the step counter follows.
 */
function restartLesson(q: string, voice: boolean) {
  gen++;
  speech?.stop();
  stopTimeline();
  noteAbort?.abort();
  mainResume = null;
  lessonBoard = null;
  waitingVoice = false;
  set((s) => ({
    note: [],
    noteDone: false,
    broken: s.broken === "note" ? null : s.broken,
    expect: null,
    feedback: null,
    misses: 0,
    error: null,
    transcript: [...s.transcript, { who: "me", text: q, voice }],
    board: emptyBoard(),
    mainIndex: 0,
    track: "main",
    player: { status: "speaking", resumeTo: null, depth: 0 },
    caption: T.lesson.restarting,
    emotion: "happy",
  }));
  console.info("[To2] answer", { question: q, source: "restart" });
  set({ answerSource: "restart" });
  if (get().main.length) void playSegment("main", 0);
  else set({ waiting: true });
}

/** Ask the tutor a question mid-lesson (voice or typed). */
export async function ask(question: string, voice = false, simpler = false) {
  const q = question.trim();
  if (!q) return;
  // "boshidan", "qaytadan", "doskani o'chir", "tushunmadim"… → the lesson restarts from step 1 (cached, with voice)
  if (!simpler && isRestartRequest(q)) return restartLesson(q, voice);
  askedAt = performance.now();
  if (["speaking", "awaiting", "answering", "checking"].includes(get().player.status) && !simpler) bargeIn();
  lastQuestion = q;
  if (get().player.status !== "thinking") fire({ type: "QUESTION_SENT" });
  set((s) => ({
    caption: T.lesson.thinking,
    emotion: "thinking",
    error: null,
    note: [],
    noteDone: false,
    broken: null,
    transcript: simpler ? s.transcript : [...s.transcript, { who: "me", text: q, voice }],
    board: { ...s.board, noteDim: false, els: s.board.els.filter((e) => e.layer !== "note") },
  }));
  lastSimpler = simpler;
  noteSource = "";
  let fillerDone: Promise<void> = Promise.resolve();
  // Fill the LLM wait with a short, pre-cached phrase so there is no dead air.
  if (!simpler) {
    const filler = FILLERS[Math.floor(Math.random() * FILLERS.length)];
    speech?.stop();
    const fs = speak(filler, get().voice, { rate: get().rate, muted: get().muted, emotion: "thinking" });
    speech = fs;
    fillerDone = Promise.race([fs.ended, new Promise<void>((r) => setTimeout(r, 4000))]);
    set({ caption: filler });
  }
  await streamNote(q, simpler, false, fillerDone);
}

let lastSimpler = false;
/** where the live answer came from (meta event): decides how a retry resumes it */
let noteSource = "";

/**
 * Stream a live answer onto the note track. Complete ONLY with the server's `done`; a stream that
 * closes without it after some segments marks the answer `broken` ("Davom etamizmi?" + retry that
 * resumes from the last segment). Nothing at all → the tutor says so and the lesson continues.
 */
async function streamNote(q: string, simpler: boolean, resume: boolean, fillerDone: Promise<void> = Promise.resolve()) {
  noteAbort?.abort(); // the previous answer only — never the lesson stream
  noteAbort = new AbortController();
  let first = get().note.length === 0;
  let complete = false;
  try {
    const s0 = get();
    const res = await fetch("/api/tutor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "interrupt",
        question: q,
        simpler,
        ...context(),
        ...(resume && s0.note.length ? { resume: { source: noteSource || "llm", prior: s0.note } } : {}),
      }),
      signal: noteAbort.signal,
    });
    const r = await readTutorStream(res, {
      onMeta: (m) => {
        if (!resume && typeof m.source === "string") noteSource = m.source;
        if (m.display === "main" || m.display === "note") noteDisplay = m.display;
        // which path answered (pinned / interrupt-cache / llm / rate-limited / llm-failed / mock) — also /dev/answers
        console.info("[To2] answer", { question: q, ...m });
        set({ answerSource: String(m.source ?? "") });
      },
      onSegment: (seg) => {
        const idx = get().note.length;
        // the first segment decides where the answer is written: main board (wiped, restored on
        // "Davom et") or the side slate (only where it covers nothing; else the main-board path)
        if (idx === 0) prepareAnswerBoard(noteDisplay);
        set((st) => ({ note: [...st.note, { ...seg, layer: noteDisplay === "main" ? "main" : "note" }] }));
        // start its audio right away (server caches it) — the player picks it up when the segment plays
        prefetchSpeech(seg.say, get().voice, { emotion: seg.emotion, lead: idx === 0 });
        if (first) {
          first = false;
          // the answer's text goes into the bubble immediately (no waiting for the filler or the audio)
          set({ caption: seg.say });
          answerShownAt = performance.now();
          fire({ type: "REPLY_READY" });
          const myGen = gen;
          void fillerDone.then(() => {
            if (gen === myGen && get().player.status === "answering") void playSegment("note", 0);
          });
        } else if (get().waiting && get().track === "note") {
          set({ waiting: false });
          void playSegment("note", get().note.length - 1);
        }
      },
    });
    complete = r.done;
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
  }
  if (get().note.length === 0) {
    // nothing arrived at all: say so and go back to the lesson (never a silent tutor)
    set({ error: T.lesson.tutorFailed, broken: null });
    fire({ type: "REPLY_FAILED" });
    resumeAfterInterrupt(true);
    return;
  }
  if (!complete) {
    set({ broken: "note" });
    showStuckPrompt();
    return;
  }
  set({ noteDone: true, broken: null });
  const s = get();
  if (s.waiting && s.track === "note") {
    set({ waiting: false });
    fire({ type: "REPLY_END" });
    set({ caption: T.lesson.understood });
  }
}

/** dev timeline of the last live question (ms): asked → caption → first audio */
let askedAt = 0;
let answerShownAt = 0;
export function lastAnswerTimeline() {
  return { askedAt, answerShownAt };
}

function resumeAfterInterrupt(alreadyTransitioned = false) {
  restoreLessonBoard(); // an answer that wiped the board (failed / cancelled): the lesson comes back
  const s = get();
  if (!alreadyTransitioned && !["speaking", "awaiting"].includes(s.player.status)) return;
  const st = get().player.status;
  set({ track: "main" });
  if (st === "awaiting") {
    const seg = s.main[s.mainIndex];
    set({ caption: seg?.say ?? "", emotion: "encouraging", expect: seg?.expect ?? null });
    return;
  }
  if (mainResume) {
    const r = mainResume;
    mainResume = null;
    void playSegment("main", r.index, r);
  } else if (s.mainIndex < s.main.length) {
    void playSegment("main", s.mainIndex);
  } else showStuckPrompt(); // back at the end of a broken lesson stream: ask again
}

/** [Davom et] — dim the orange notes and resume exactly where we paused. */
export function continueLesson() {
  speech?.stop();
  gen++;
  stopTimeline();
  fire({ type: "CONTINUE" });
  if (!restoreLessonBoard()) set((s) => ({ board: { ...s.board, noteDim: true }, track: "main" }));
  else set({ track: "main" });
  resumeAfterInterrupt();
}

/** [Yana tushuntir] — ask again, simpler. */
export function explainAgain() {
  gen++;
  speech?.stop();
  stopTimeline();
  fire({ type: "EXPLAIN_AGAIN" }); // checking → thinking (resume point kept)
  void ask(lastQuestion, false, true);
}

export const FILLERS = ["Hmm… yaxshi savol! Hozir ko'rsataman.", "Qiziq savol! Qani, o'ylab ko'raylik…"];

const ENCOURAGE = ["Deyarli! Yana bir bor o'ylab ko'r.", "Hechqisi yo'q, yana urinib ko'r!", "Yaqin qolding! Doskaga qara."];

export async function submitAnswer(given: string) {
  const s = get();
  if (s.player.status !== "awaiting" || !s.expect) return;
  const expect = s.expect;
  let correct = false;
  let xp = 0;
  try {
    const r = await fetch("/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skillId: s.skillId, expect, given, hintUsed: s.misses > 0, source: "lesson" }),
    });
    const j = (await r.json()) as { correct: boolean; xp: number; p?: number };
    correct = j.correct;
    xp = j.xp ?? 0;
    if (typeof j.p === "number") set({ masteryAfter: j.p });
  } catch {
    // offline: check locally
    const { checkAnswer } = await import("@/lib/learning/checker");
    correct = checkAnswer(expect, given).correct;
  }
  set((st) => ({ transcript: [...st.transcript, { who: "me", text: given }] }));
  if (correct) {
    set((st) => ({
      feedback: { kind: "correct", text: T.lesson.correct, xp },
      celebrate: st.celebrate + 1,
      xpGained: st.xpGained + xp,
      expect: null,
      emotion: "excited",
    }));
    fire({ type: "ANSWER_CORRECT" });
    nextMain();
  } else {
    const misses = s.misses + 1;
    const say = misses >= 2 ? "Hechqisi yo'q! Xohlasang, ko'rsatib beraman." : ENCOURAGE[misses % ENCOURAGE.length];
    set({ misses, feedback: { kind: "wrong", text: T.lesson.tryAgain }, caption: say, emotion: "encouraging" });
    speech?.stop();
    speech = speak(say, s.voice, { rate: s.rate, muted: s.muted, emotion: "encouraging" });
  }
}

/** "Ko'rsatib ber" — reveal the answer and move on. */
export function showMe() {
  const s = get();
  if (!s.expect) return;
  const say = `To'g'ri javob: ${s.expect.answer}. Keling, davom etamiz!`;
  speech?.stop();
  set({ caption: say, expect: null, feedback: null, emotion: "encouraging" });
  // the caption shows "5/6"; the voice says "oltidan besh"
  const sp = speak(speakMath(say), s.voice, { rate: s.rate, muted: s.muted, emotion: "encouraging" });
  speech = sp;
  void sp.ended.then(() => {
    fire({ type: "ANSWER_CORRECT" });
    nextMain();
  });
}

/** Replay the current main segment from the start (board keeps earlier steps). */
export function replayStep() {
  const s = get();
  if (s.player.status !== "speaking" && s.player.status !== "awaiting") return;
  if (s.player.status === "awaiting") fire({ type: "ANSWER_CORRECT" });
  flushTimeline();
  void playSegment("main", s.mainIndex);
}

export function setRate(r: number) {
  if (tl && tl.running) {
    tl.offset = tlTime(tl); // bank time at the old rate first
    tl.start = now();
  }
  set({ rate: r });
  speech?.setRate(r);
}

export function setMuted(m: boolean) {
  set({ muted: m });
}
