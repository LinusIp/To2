"use client";
// Lesson engine: owns audio, the chalk timeline and the barge-in flow.
// UI reads everything from the zustand store; side effects live in module scope.
import { create } from "zustand";
import type { Emotion, Expect, LessonSegment } from "@/lib/ai/schema";
import { applyCommand, describeBoard, emptyBoard, isDraw, scheduleSegment, scheduleLength, type BoardState, type Layer, type Slot } from "@/lib/board/model";
import { prefetchSpeech, speak, unlockAudio, type Speech } from "@/lib/audio/player";
import { startRecording, stopRecording, micSupported } from "@/lib/audio/recorder";
import { initialPlayer, transition, type PlayerEvent, type PlayerState } from "./player";
import { readTutorStream } from "./sse";
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
let abort: AbortController | null = null;

const now = () => performance.now();
const tlTime = (x: Timeline) => x.offset + (x.running ? (now() - x.start) * get().rate : 0);

function tick() {
  const x = tl;
  if (!x || !x.running || !x.slots) return;
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

  set({
    track,
    [track === "main" ? "mainIndex" : "noteIndex"]: index,
    caption: seg.say,
    emotion: seg.emotion,
    expect: null,
    feedback: track === "main" ? null : s.feedback,
  } as Partial<LessonStore>);
  if (!resume) set((st) => ({ transcript: [...st.transcript, { who: "tutor", text: seg.say, highlight: seg.type === "ask" }] }));

  // prefetch the next one while this plays
  const next = list[index + 1];
  if (next) prefetchSpeech(next.say, s.voice);

  const layer: Layer = seg.layer ?? (track === "note" ? "note" : "main");
  tl = { gen: my, track, index, layer, cmds: seg.board, slots: null, applied: resume?.applied ?? 0, offset: resume?.t ?? 0, start: now(), running: false, speechEnded: false };
  const sp = speak(seg.say, s.voice, { rate: s.rate, fromMs: resume?.audioMs, muted: s.muted });
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

function onSegmentDone(g: number, track: "main" | "note", index: number) {
  if (g !== gen) return;
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
    else if (!s.noteDone) set({ waiting: true });
    else {
      fire({ type: "REPLY_END" });
      set({ caption: s.note[index]?.type === "check" ? s.note[index].say : T.lesson.understood });
    }
  }
}

function nextMain() {
  const s = get();
  const i = s.mainIndex + 1;
  if (i < s.main.length) void playSegment("main", i);
  else if (!s.mainDone) set({ waiting: true, mainIndex: i });
  else {
    fire({ type: "FINISH" });
    set({ caption: T.lesson.finished, emotion: "excited", celebrate: get().celebrate + 1 });
    void fetch("/api/lesson", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ skillId: s.skillId, finished: true }) }).catch(() => {});
  }
}

// ── public API ───────────────────────────────────────────────────────────────
export function initLesson(opts: { skillId: string; characterId: string; grade: number }) {
  gen++;
  speech?.stop();
  speech = null;
  tl = null;
  mainResume = null;
  abort?.abort();
  cancelAnimationFrame(raf);
  set({ ...initial(), skillId: opts.skillId, characterId: opts.characterId, voice: opts.characterId, grade: opts.grade });
}

export function disposeLesson() {
  gen++;
  speech?.stop();
  abort?.abort();
  cancelAnimationFrame(raf);
}

function context() {
  const s = get();
  const hist = s.transcript.slice(-6).map((x) => ({ role: x.who === "me" ? "user" : "assistant", text: x.text }));
  const cur = s.main[Math.min(s.mainIndex, s.main.length - 1)];
  return { skillId: s.skillId, characterId: s.characterId, grade: s.grade, segment: cur?.say ?? "", board: describeBoard(s.board), history: hist };
}

/** Start the lesson: unlock audio (user gesture), stream segments. */
export async function startLesson() {
  unlockAudio();
  const s = get();
  fire({ type: "START" });
  set({ caption: T.common.loading, waiting: true });
  abort = new AbortController();
  try {
    const res = await fetch("/api/tutor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "lesson", skillId: s.skillId, characterId: s.characterId, grade: s.grade }),
      signal: abort.signal,
    });
    await readTutorStream(res, {
      onSegment: (seg) => {
        set((st) => ({ main: [...st.main, seg] }));
        const st = get();
        if (st.waiting && st.player.status === "speaking") {
          set({ waiting: false });
          void playSegment("main", st.main.length - 1);
        }
      },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    set({ error: T.lesson.tutorFailed });
  }
  set({ mainDone: true });
  const st = get();
  if (st.waiting && st.player.status === "speaking" && st.mainIndex >= st.main.length) {
    set({ waiting: false });
    nextMain();
  }
}

/** Learner pressed the mic / started typing: freeze everything. */
export function bargeIn() {
  const s = get();
  const st = s.player.status;
  if (!["speaking", "awaiting", "answering", "checking"].includes(st)) return;
  if (st === "speaking" && tl && tl.track === "main") {
    stopTimeline();
    mainResume = { index: tl.index, t: tl.offset, applied: tl.applied, audioMs: speech?.position() ?? 0 };
    speech?.pause();
  } else if (st === "answering" || st === "checking") {
    // interrupting the answer: drop it (nesting max 1)
    gen++;
    stopTimeline();
    speech?.stop();
    abort?.abort();
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

/** Ask the tutor a question mid-lesson (voice or typed). */
export async function ask(question: string, voice = false, simpler = false) {
  const q = question.trim();
  if (!q) return;
  if (["speaking", "awaiting", "answering", "checking"].includes(get().player.status) && !simpler) bargeIn();
  lastQuestion = q;
  if (get().player.status !== "thinking") fire({ type: "QUESTION_SENT" });
  set((s) => ({
    caption: T.lesson.thinking,
    emotion: "thinking",
    error: null,
    note: [],
    noteDone: false,
    transcript: simpler ? s.transcript : [...s.transcript, { who: "me", text: q, voice }],
    board: { ...s.board, noteDim: false, els: s.board.els.filter((e) => e.layer !== "note") },
  }));
  abort?.abort();
  abort = new AbortController();
  let first = true;
  try {
    const res = await fetch("/api/tutor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "interrupt", question: q, simpler, ...context() }),
      signal: abort.signal,
    });
    await readTutorStream(res, {
      onSegment: (seg) => {
        set((st) => ({ note: [...st.note, { ...seg, layer: "note" }] }));
        if (first) {
          first = false;
          fire({ type: "REPLY_READY" });
          void playSegment("note", 0);
        } else if (get().waiting && get().track === "note") {
          set({ waiting: false });
          void playSegment("note", get().note.length - 1);
        }
      },
    });
    set({ noteDone: true });
    const s = get();
    if (first) throw new Error("no segments");
    if (s.waiting && s.track === "note") {
      set({ waiting: false });
      fire({ type: "REPLY_END" });
      set({ caption: T.lesson.understood });
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    set({ error: T.lesson.tutorFailed });
    fire({ type: "REPLY_FAILED" });
    resumeAfterInterrupt(true);
  }
}

function resumeAfterInterrupt(alreadyTransitioned = false) {
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
  }
}

/** [Davom et] — dim the orange notes and resume exactly where we paused. */
export function continueLesson() {
  speech?.stop();
  gen++;
  stopTimeline();
  fire({ type: "CONTINUE" });
  set((s) => ({ board: { ...s.board, noteDim: true }, track: "main" }));
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
    speech = speak(say, s.voice, { rate: s.rate, muted: s.muted });
  }
}

/** "Ko'rsatib ber" — reveal the answer and move on. */
export function showMe() {
  const s = get();
  if (!s.expect) return;
  const say = `To'g'ri javob: ${s.expect.answer}. Keling, davom etamiz!`;
  speech?.stop();
  set({ caption: say, expect: null, feedback: null, emotion: "encouraging" });
  const sp = speak(say, s.voice, { rate: s.rate, muted: s.muted });
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
