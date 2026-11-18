// POST /api/tutor → Server-Sent Events, one `segment` event per validated LessonSegment.
//   mode "lesson":    demo lesson (instant, pre-cached audio) or LLM-generated lesson (cached in KV)
//   mode "interrupt": answer a learner question on the orange "note" layer, ending with a check
// Every LLM segment is zod-validated; invalid output → retry once with the error → canned fallback.
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getAI } from "@/lib/ai";
import { LessonSegment, parseSegments, type LessonSegment as Seg } from "@/lib/ai/schema";
import { continuationMessages, segmentFromLLM } from "@/lib/ai/llmSegments";
import { INTERRUPT_LIMIT_PER_HOUR, LLM_FAILED_LINE, RATE_LIMIT_LINE, answerDisplay, type AnswerDisplay } from "@/lib/ai/answers";
import { interruptKey } from "@/lib/ai/interruptKey";
import { logAnswer } from "@/lib/server/answerLog";
import { createObjectSplitter } from "@/lib/ai/streamJson";
import { interruptMessages, lessonMessages } from "@/lib/ai/prompts/tutor.uz";
import { demoLessonFor, mockInterrupt } from "@/lib/ai/mock/lessons";
import { cannedLesson } from "@/lib/ai/canned";
import { TOPIC_EXAMPLE_SEGMENTS } from "@/lib/ai/prompts/examples";
import { getSkill } from "@/data/skills";
import { getCharacter } from "@/config/characters";
import { CANONICAL, matchPinned, normalizeQuestion, pinnedAnswer } from "@/lib/ai/pinned";
import { storeGetJson, storeGetText, storePut } from "@/lib/server/store";
import { emptyBoard, fitToBoard, freeArea, noteLayouter } from "@/lib/board/model";
import { mainLayouter } from "@/lib/board/layout";
import { bad, clientKey, rateLimit, userIdFor } from "@/lib/server/session";
import { getMastery, recentMistakes, startLessonRow } from "@/lib/server/repo";
import type { Msg } from "@/lib/ai/types";

const Body = z.object({
  mode: z.enum(["lesson", "interrupt"]),
  skillId: z.string().max(128),
  characterId: z.string().max(32).default("blokbek"),
  grade: z.coerce.number().int().min(5).max(9).default(6),
  question: z.string().max(500).optional(),
  simpler: z.boolean().optional(),
  fresh: z.boolean().optional(),
  segment: z.string().max(600).optional(),
  board: z.array(z.object({ id: z.string(), op: z.string(), text: z.string().optional(), x: z.number(), y: z.number() })).max(80).optional(),
  history: z.array(z.object({ role: z.string(), text: z.string().max(600) })).max(12).optional(),
  /** interrupt: the lesson step the learner is on (0-based) and how many steps there are */
  step: z.coerce.number().int().min(0).max(99).optional(),
  steps: z.coerce.number().int().min(0).max(99).optional(),
  /**
   * Retry after a stream that closed without `done`: the client already has `prior` (in order).
   * Deterministic sources (demo, cache, pinned, mock, canned) are re-sent minus what the client has;
   * an LLM lesson/answer is continued from `prior` (it can't be regenerated identically).
   */
  resume: z
    .object({
      source: z.string().max(16),
      prior: z.array(z.unknown()).max(30),
    })
    .optional(),
});

/** On phones the lesson toolbar (replay / speed / sound) sits over the board's top-right corner. */
const PHONE_TOOLBAR = { x: 470, y: 0, w: 530, h: 112 };
/** a main-board answer's first row (below that band) */
const ANSWER_TOP = 122;

const CHECK: Seg = { id: "chk", type: "check", layer: "note", emotion: "encouraging", say: "Tushunarli bo'ldimi? Davom etamizmi?", board: [] };

function sse() {
  const ts = new TransformStream<Uint8Array, Uint8Array>();
  const w = ts.writable.getWriter();
  const enc = new TextEncoder();
  const send = (event: string, data: unknown) => w.write(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  const res = new Response(ts.readable, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
  return { res, send, close: () => w.close().catch(() => {}) };
}

/**
 * Stream an LLM reply, emitting each segment as soon as its JSON object is complete. An object that
 * fails validation is dropped (logged) and the stream continues — it never stalls the lesson.
 * `prior` = segments the learner already has (continuation after a broken stream): ids stay unique.
 */
async function streamLLM(
  messages: Msg[],
  emit: (s: Seg) => Promise<void>,
  opts: { note: boolean; maxTokens: number; prior?: Seg[] },
): Promise<{ count: number; raw: string; error?: string }> {
  const { llm } = getAI();
  const split = createObjectSplitter();
  let raw = "";
  let count = 0;
  let lastErr: string | undefined;
  const st = { count: opts.prior?.length ?? 0, seen: new Set((opts.prior ?? []).map((s) => s.id)), note: opts.note };
  for await (const delta of llm.stream(messages, { maxTokens: opts.maxTokens })) {
    raw += delta;
    for (const obj of split(delta)) {
      const r = segmentFromLLM(obj, st, fitToBoard);
      if (!r.ok) {
        lastErr = r.error;
        console.warn("[tutor] dropped an invalid segment:", r.error);
        continue;
      }
      count++;
      await emit(r.seg);
    }
  }
  return { count, raw, error: lastErr };
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("So'rov noto'g'ri");
  const b = parsed.data;
  const skill = getSkill(b.skillId);
  if (!skill) return bad("Mavzu topilmadi", 404);
  const ch = getCharacter(b.characterId);
  const userId = await userIdFor(req);
  const env = getEnv();
  const ai = getAI(env);
  const { res, send: sendRaw, close } = sse();
  // Every main-layer lesson segment goes through the auto-layout, so nothing is written on top of
  // what's already on the board (LLM coordinates are only a hint). Covers LLM, KV cache and demo
  // lessons; note-layer (interrupt) segments pass through and keep using noteLayouter.
  const layMain = mainLayouter();
  // Retry after a broken stream: the client already has the first `skip` segments. They still go
  // through the layouter (so the board state matches what the client shows) but aren't re-sent.
  const prior = (b.resume?.prior ?? []).map((p) => LessonSegment.safeParse(p)).flatMap((r) => (r.success ? [r.data] : []));
  const skip = prior.length;
  const llmResume = b.resume?.source === "llm" && skip > 0;
  let segIndex = 0;
  // the lesson opens by writing its topic in chalk, top-left ("Mavzu: …"); it goes through the
  // layouter with the first segment, so nothing else is written on top of it
  // short, so it stays clear of the phone's toolbar over the board's top-right: "EKUK — eng kichik…"
  // → "EKUK"; a short title as is; else the section ("Maxrajlari har xil…" → "Kasrlar")
  const topic = skill.title_uz.includes(" — ") ? skill.title_uz.split(" — ")[0] : skill.title_uz.length <= 22 ? skill.title_uz : skill.section;
  const withTitle = (s: Seg): Seg =>
    s.board.some((c) => "id" in c && c.id === "_title")
      ? s
      : { ...s, board: [{ op: "write", id: "_title", x: 22, y: 10, size: "s", color: "ink", text: `Mavzu: ${topic}` }, ...s.board] };
  const send = (ev: string, data: unknown) => {
    if (ev !== "segment") return sendRaw(ev, data);
    const first = segIndex === 0;
    const out = b.mode === "lesson" ? layMain(first ? withTitle(data as Seg) : (data as Seg)) : data;
    if (segIndex++ < skip) return Promise.resolve();
    return sendRaw(ev, out);
  };

  const t0 = Date.now();
  /** what answered this question (logged to D1 answer_log, shown in /dev/answers and the console) */
  const ans = { source: "", reason: "", question: "", key: "", display: "note" as AnswerDisplay, segments: 0 };
  const run = async () => {
    try {
      if (b.mode === "lesson") {
        if (userId) await startLessonRow(userId, skill.id).catch(() => {});
        const demo = demoLessonFor(skill.id);
        const cacheKey = `lesson:v1:${skill.id}:${ch.id}`;
        if (llmResume) {
          // continue the SAME generated lesson from where the learner's stream broke
          await send("meta", { source: "llm", resumedAt: skip });
          for (const s of prior) await send("segment", s); // layout state only (skipped)
          const mastery = userId ? ((await getMastery(userId))[skill.id] ?? 0.3) : 0.3;
          const msgs = continuationMessages(lessonMessages({ ch, skill, grade: b.grade, mastery, mistakes: [] }), prior);
          const got: Seg[] = [...prior];
          await streamLLM(msgs, async (s) => {
            got.push(s);
            await send("segment", s);
          }, { note: false, maxTokens: 3500, prior }).catch((e) => console.warn("[tutor] continuation failed", (e as Error).message));
          if (got.length > skip && got.some((s) => s.type === "ask")) await storePut(cacheKey, JSON.stringify(got), { ttlSec: 60 * 60 * 24 * 7 });
          return;
        }
        if (demo && !b.fresh && demo.skillId === skill.id) {
          await send("meta", { source: "demo" });
          for (const s of demo.segments) await send("segment", s);
          return;
        }
        const cached = !b.fresh ? await storeGetJson<Seg[]>(cacheKey) : null;
        if (cached?.length) {
          await send("meta", { source: "cache" });
          for (const s of cached) await send("segment", s);
          return;
        }
        if (ai.mock || !(await rateLimit(`llm:${clientKey(req, userId)}`, 20))) {
          // offline "Istalgan mavzu": only the Fotosintez example exists; any other topic → honest notice
          const mockTopic = ai.mock && skill.subject === "any" && /fotosintez/i.test(skill.title_uz) ? TOPIC_EXAMPLE_SEGMENTS : null;
          const segs = demo?.segments ?? mockTopic ?? cannedLesson(skill);
          await send("meta", { source: demo ? "demo" : mockTopic ? "mock" : "canned" });
          for (const s of segs) await send("segment", s);
          return;
        }
        const mastery = userId ? ((await getMastery(userId))[skill.id] ?? 0.3) : 0.3;
        const mistakes = userId ? await recentMistakes(userId, skill.id).catch(() => []) : [];
        const msgs = lessonMessages({ ch, skill, grade: b.grade, mastery, mistakes });
        const got: Seg[] = [];
        await send("meta", { source: "llm" });
        const emit = async (s: Seg) => {
          got.push(s);
          await send("segment", s);
        };
        let r = await streamLLM(msgs, emit, { note: false, maxTokens: 3500 }).catch((e) => ({ count: 0, raw: "", error: (e as Error).message }));
        if (got.length === 0) {
          // retry once with the validation error appended
          const retry = [...msgs, { role: "assistant" as const, content: r.raw.slice(0, 2000) }, { role: "user" as const, content: `Xato: ${r.error ?? "JSON emas"}. Faqat to'g'ri JSON massiv qaytar.` }];
          const text = await ai.llm.complete(retry, { maxTokens: 3500 }).catch(() => "");
          const p = parseSegments(text);
          if (p.ok) for (const s of p.segments) await emit(s);
          r = { count: got.length, raw: text };
        }
        if (got.length === 0) {
          console.warn("[tutor] LLM lesson failed, canned fallback", r.error);
          await send("meta", { source: "canned" });
          for (const s of demo?.segments ?? cannedLesson(skill)) await send("segment", s);
          return;
        }
        if (got.filter((s) => s.type === "ask").length >= 1) await storePut(cacheKey, JSON.stringify(got), { ttlSec: 60 * 60 * 24 * 7 });
        return;
      }

      // ── interrupt ── (every answer reports its source; nothing canned is ever served silently)
      ans.question = normalizeQuestion(b.question ?? "");
      const question = (b.question ?? "").trim();
      const step = b.step ?? 0;
      if (!question) {
        await send("segment", CHECK);
        return;
      }
      ans.key = await interruptKey({ skillId: skill.id, characterId: ch.id, simpler: !!b.simpler, step, question });
      /** send the answer's meta (once) + its segments, laid out for the chosen display */
      let metaSent = false;
      let lay: ((s: Seg) => Seg) | null = null;
      const emitAnswer = async (s: Seg, display?: AnswerDisplay) => {
        if (!metaSent) {
          ans.display = display ?? answerDisplay(s, ans.source === "pinned");
          // a main-board answer is written on a wiped (empty) board, below the phone toolbar band
          const main = mainLayouter({ top: ANSWER_TOP, reserve: [PHONE_TOOLBAR] });
          const note = noteLayouter();
          lay = ans.display === "main" ? (x: Seg) => main({ ...x, layer: "main" }) : (x: Seg) => note({ ...x, layer: "note" });
          await send("meta", { source: ans.source, display: ans.display, norm: ans.question, key: ans.key, step, ...(skip ? { resumedAt: skip } : {}) });
          metaSent = true;
        }
        const out = lay!(s);
        ans.segments++;
        await send("segment", out);
        return out;
      };
      const say = async (source: string, line: string, reason: string) => {
        ans.source = source;
        ans.reason = reason;
        await emitAnswer({ id: "sys1", type: "explain", layer: "note", emotion: "encouraging", say: line, board: [] }, "note");
        await emitAnswer(CHECK, "note");
      };
      // Demo questions (and close variants, full phrase) → the pinned, reviewed answer for this tutor.
      // It stays on the side slate: it circles the lesson's own fraction bars, which a wipe would remove.
      const pin = b.simpler ? null : matchPinned(skill.id, question);
      if (pin) {
        ans.source = "pinned";
        ans.reason = pin;
        const sent: Seg[] = [];
        for (const s of pinnedAnswer(pin, ch.id)) sent.push(await emitAnswer(s, "note"));
        const key = await interruptKey({ skillId: skill.id, characterId: ch.id, simpler: false, step: 0, question: CANONICAL[pin] });
        const json = JSON.stringify({ display: "note", segs: sent });
        if ((await storeGetText(key)) !== json) await storePut(key, json); // no TTL: pinned
        return;
      }
      if (ai.mock) {
        ans.source = "mock";
        ans.reason = "MOCK_AI (offline dev)";
        for (const s of mockInterrupt(question, skill.id)) await emitAnswer(s);
        return;
      }
      // Same question at the same step → the cached answer (LLM response cache)
      const cachedInt = await storeGetJson<{ display: AnswerDisplay; segs: Seg[] }>(ans.key);
      if (cachedInt?.segs?.length) {
        ans.source = "interrupt-cache";
        for (const s of cachedInt.segs) await emitAnswer(s, cachedInt.display);
        return;
      }
      if (!(await rateLimit(`llm-int:${clientKey(req, userId)}`, INTERRUPT_LIMIT_PER_HOUR, 3600)))
        return say("rate-limited", RATE_LIMIT_LINE, `over ${INTERRUPT_LIMIT_PER_HOUR}/h`);
      ans.source = "llm";
      const sent: Seg[] = [];
      const boardDesc = b.board ?? [];
      const free = freeArea({ ...emptyBoard(), els: [] });
      const msgs = interruptMessages({
        ch,
        skill,
        grade: b.grade,
        question,
        segment: b.segment ?? "",
        step: step + 1,
        steps: b.steps ?? 0,
        board: boardDesc,
        history: b.history ?? [],
        simpler: !!b.simpler,
        free: boardDesc.some((e) => e.x > 560) ? { x: 600, y: 520 } : free,
      });
      let sawCheck = false;
      const emit = async (s: Seg) => {
        if (sawCheck) return;
        if (s.type === "check") sawCheck = true;
        sent.push(await emitAnswer(s));
      };
      if (llmResume) {
        // continue the same answer from what the learner already has (same display as before)
        const display: AnswerDisplay = prior[0]?.layer === "main" ? "main" : "note";
        for (const s of prior) await emitAnswer(s, display); // skipped by send(), keeps layout state
        sawCheck = prior.some((s) => s.type === "check");
        if (!sawCheck) await streamLLM(continuationMessages(msgs, prior), emit, { note: false, maxTokens: 900, prior }).catch((e) => console.warn("[tutor] continuation failed", (e as Error).message));
        if (!sawCheck) await emitAnswer(CHECK);
        return;
      }
      let r = await streamLLM(msgs, emit, { note: false, maxTokens: 900 }).catch((e) => ({ count: 0, raw: "", error: (e as Error).message }));
      if (!sent.length) {
        // one retry with the error appended (like lessons), then say so — never a canned explanation
        const retry = [...msgs, { role: "assistant" as const, content: r.raw.slice(0, 1500) }, { role: "user" as const, content: `Xato: ${r.error ?? "JSON emas"}. Faqat to'g'ri JSON massiv qaytar.` }];
        const text = await ai.llm.complete(retry, { maxTokens: 900 }).catch((e) => {
          r = { ...r, error: (e as Error).message };
          return "";
        });
        const p = parseSegments(text);
        if (p.ok) for (const s of p.segments) await emit(s);
      }
      if (!sent.length) return say("llm-failed", LLM_FAILED_LINE, r.error ?? "no valid segment");
      if (!sawCheck) sent.push(await emitAnswer(CHECK));
      if (sent.length >= 2) await storePut(ans.key, JSON.stringify({ display: ans.display, segs: sent }), { ttlSec: 60 * 60 * 24 * 7 });
    } catch (e) {
      console.error("[tutor]", (e as Error).message);
      await send("error", { message: "tutor_failed" }).catch(() => {});
    } finally {
      if (b.mode === "interrupt") await logAnswer({ ...ans, userId, skillId: skill.id, tutor: ch.id, step: b.step ?? 0, ms: Date.now() - t0 });
      // ALWAYS end with done (the client treats a stream that closes without it as broken → retry)
      await sendRaw("done", { segments: segIndex }).catch(() => {});
      await close();
    }
  };

  // Keep the worker alive while streaming.
  void run();
  return res;
}
