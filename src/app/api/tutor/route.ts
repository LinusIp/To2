// POST /api/tutor → Server-Sent Events, one `segment` event per validated LessonSegment.
//   mode "lesson":    demo lesson (instant, pre-cached audio) or LLM-generated lesson (cached in KV)
//   mode "interrupt": answer a learner question on the orange "note" layer, ending with a check
// Every LLM segment is zod-validated; invalid output → retry once with the error → canned fallback.
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getAI } from "@/lib/ai";
import { LessonSegment, parseSegments, type LessonSegment as Seg } from "@/lib/ai/schema";
import { createObjectSplitter } from "@/lib/ai/streamJson";
import { interruptMessages, lessonMessages } from "@/lib/ai/prompts/tutor.uz";
import { demoLessonFor, mockInterrupt } from "@/lib/ai/mock/lessons";
import { cannedLesson } from "@/lib/ai/canned";
import { getSkill } from "@/data/skills";
import { getCharacter } from "@/config/characters";
import { emptyBoard, fitToBoard, freeArea, noteLayouter } from "@/lib/board/model";
import { bad, clientKey, rateLimit, userIdFor } from "@/lib/server/session";
import { getMastery, recentMistakes, startLessonRow } from "@/lib/server/repo";
import type { Msg } from "@/lib/ai/types";

const Body = z.object({
  mode: z.enum(["lesson", "interrupt"]),
  skillId: z.string().max(64),
  characterId: z.string().max(32).default("blokbek"),
  grade: z.coerce.number().int().min(5).max(9).default(6),
  question: z.string().max(500).optional(),
  simpler: z.boolean().optional(),
  fresh: z.boolean().optional(),
  segment: z.string().max(600).optional(),
  board: z.array(z.object({ id: z.string(), op: z.string(), text: z.string().optional(), x: z.number(), y: z.number() })).max(80).optional(),
  history: z.array(z.object({ role: z.string(), text: z.string().max(600) })).max(12).optional(),
});

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

/** Stream an LLM reply, emitting each segment as soon as its JSON object is complete. */
async function streamLLM(messages: Msg[], emit: (s: Seg) => Promise<void>, opts: { note: boolean; maxTokens: number }): Promise<{ count: number; raw: string; error?: string }> {
  const { llm } = getAI();
  const split = createObjectSplitter();
  let raw = "";
  let count = 0;
  let lastErr: string | undefined;
  const seen = new Set<string>();
  const handle = async (obj: string) => {
    let data: unknown;
    try {
      data = JSON.parse(obj);
    } catch {
      return;
    }
    if (data && typeof data === "object" && !("id" in data)) (data as Record<string, unknown>).id = `s${count + 1}`;
    const r = LessonSegment.safeParse(data);
    if (!r.success) {
      lastErr = `${r.error.issues[0]?.path.join(".")}: ${r.error.issues[0]?.message}`;
      return;
    }
    let s = r.data;
    if (s.type === "ask" && !s.expect) s = { ...s, type: "explain" };
    if (seen.has(s.id)) s = { ...s, id: `${s.id}_${count}` };
    seen.add(s.id);
    s = { ...s, board: s.board.map(fitToBoard) };
    if (opts.note) s = { ...s, layer: "note" };
    count++;
    await emit(s);
  };
  for await (const delta of llm.stream(messages, { maxTokens: opts.maxTokens })) {
    raw += delta;
    for (const obj of split(delta)) await handle(obj);
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
  const { res, send, close } = sse();

  const run = async () => {
    try {
      if (b.mode === "lesson") {
        if (userId) await startLessonRow(userId, skill.id).catch(() => {});
        const demo = demoLessonFor(skill.id);
        const cacheKey = `lesson:v1:${skill.id}:${ch.id}`;
        if (demo && !b.fresh && demo.skillId === skill.id) {
          await send("meta", { source: "demo" });
          for (const s of demo.segments) await send("segment", s);
          return;
        }
        const cached = !b.fresh ? await env.KV.get<Seg[]>(cacheKey, "json") : null;
        if (cached?.length) {
          await send("meta", { source: "cache" });
          for (const s of cached) await send("segment", s);
          return;
        }
        if (ai.mock || !(await rateLimit(`llm:${clientKey(req, userId)}`, 20))) {
          const segs = demo?.segments ?? cannedLesson(skill);
          await send("meta", { source: demo ? "demo" : "canned" });
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
        if (got.filter((s) => s.type === "ask").length >= 1) await env.KV.put(cacheKey, JSON.stringify(got), { expirationTtl: 60 * 60 * 24 * 7 });
        return;
      }

      // ── interrupt ──
      const lay = noteLayouter();
      const question = (b.question ?? "").trim();
      if (!question) {
        await send("segment", CHECK);
        return;
      }
      if (ai.mock || !(await rateLimit(`llm:${clientKey(req, userId)}`, 30))) {
        for (const s of mockInterrupt(question, skill.id)) await send("segment", lay(s));
        return;
      }
      // Same question on the same skill → instant cached answer (LLM response cache in KV).
      const qNorm = question.toLowerCase().replace(/[^a-z0-9ʻ's]/g, "").replace(/s+/g, " ").trim();
      const qHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(qNorm)))].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
      const intKey = `int:v1:${skill.id}:${ch.id}:${b.simpler ? 1 : 0}:${qHash}`;
      const cachedInt = await env.KV.get<Seg[]>(intKey, "json");
      if (cachedInt?.length) {
        for (const s of cachedInt) await send("segment", s);
        return;
      }
      const sent: Seg[] = [];
      const boardDesc = b.board ?? [];
      const free = freeArea({ ...emptyBoard(), els: [] });
      const msgs = interruptMessages({
        ch,
        skill,
        grade: b.grade,
        question,
        segment: b.segment ?? "",
        board: boardDesc,
        history: b.history ?? [],
        simpler: !!b.simpler,
        free: boardDesc.some((e) => e.x > 560) ? { x: 600, y: 520 } : free,
      });
      let sawCheck = false;
      let n = 0;
      const emit = async (s: Seg) => {
        if (sawCheck) return;
        n++;
        if (s.type === "check") sawCheck = true;
        const out = lay(s);
        sent.push(out);
        await send("segment", out);
      };
      const r = await streamLLM(msgs, emit, { note: true, maxTokens: 900 }).catch((e) => ({ count: 0, raw: "", error: (e as Error).message }));
      if (n === 0) {
        console.warn("[tutor] interrupt LLM failed", r.error);
        for (const s of mockInterrupt(question, skill.id)) await send("segment", lay(s));
        return;
      }
      if (!sawCheck && n > 0) {
        await send("segment", CHECK);
        sent.push(CHECK);
      }
      if (sent.length >= 2) await env.KV.put(intKey, JSON.stringify(sent), { expirationTtl: 60 * 60 * 24 * 7 });
    } catch (e) {
      console.error("[tutor]", (e as Error).message);
      await send("error", { message: "tutor_failed" }).catch(() => {});
    } finally {
      await send("done", {}).catch(() => {});
      await close();
    }
  };

  // Keep the worker alive while streaming.
  void run();
  return res;
}
