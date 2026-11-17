// The LLM contract (CLAUDE.md §4/§5). Every LLM output is validated here.
// Parsing is lenient where it is safe (unknown ops dropped, bad colours → default),
// strict where it matters (say text, segment type, answers).
import { z } from "zod";

export const COLORS = ["ink", "blue", "red", "green", "orange", "purple", "yellow"] as const;
export type Color = (typeof COLORS)[number];

const color = z
  .string()
  .transform((s) => s.toLowerCase())
  .pipe(z.enum(COLORS))
  .optional()
  .catch(undefined);

const num = z.coerce.number().refine(Number.isFinite, "not a number");
const point = z.tuple([num, num]);
const size = z.enum(["s", "m", "l"]).optional().catch(undefined);
const id = z.coerce.string().min(1).max(64);

export const WriteCmd = z.object({ op: z.literal("write"), id, x: num, y: num, text: z.coerce.string().max(200), size, color });
export const LatexCmd = z.object({ op: z.literal("latex"), id, x: num, y: num, tex: z.coerce.string().max(300), size, color });
export const LineCmd = z.object({ op: z.literal("line"), id, from: point, to: point, color, arrow: z.boolean().optional().catch(undefined) });
export const ShapeCmd = z.object({
  op: z.enum(["rect", "circle", "ellipse"]),
  id,
  x: num,
  y: num,
  w: num,
  h: num,
  color,
  fill: color,
});
export const NumberLineCmd = z.object({
  op: z.literal("numberline"),
  id,
  x: num,
  y: num,
  w: num,
  min: num,
  max: num,
  marks: z.array(num).max(20).optional().catch(undefined),
});
export const FractionBarCmd = z.object({
  op: z.literal("fractionbar"),
  id,
  x: num,
  y: num,
  w: num,
  h: num.optional().catch(undefined),
  parts: z.coerce.number().int().min(1).max(24),
  filled: z.coerce.number().int().min(0).max(24),
  color,
  label: z.coerce.string().max(20).optional().catch(undefined),
});
export const PlotCmd = z.object({
  op: z.literal("plot"),
  id,
  x: num,
  y: num,
  w: num,
  h: num,
  fn: z.coerce.string().max(80),
  xRange: point,
  yRange: point,
  color,
});
export const HighlightCmd = z.object({ op: z.literal("highlight"), target: id, color });
export const EraseCmd = z.object({ op: z.literal("erase"), target: id });
export const PauseCmd = z.object({ op: z.literal("pause"), ms: z.coerce.number().min(0).max(5000) });

export const BoardCommand = z.discriminatedUnion("op", [
  WriteCmd,
  LatexCmd,
  LineCmd,
  ShapeCmd,
  NumberLineCmd,
  FractionBarCmd,
  PlotCmd,
  HighlightCmd,
  EraseCmd,
  PauseCmd,
]);
export type BoardCommand = z.infer<typeof BoardCommand>;
export type DrawCommand = Exclude<BoardCommand, { op: "highlight" | "erase" | "pause" }>;

const KNOWN_OPS = new Set([
  "write", "latex", "line", "rect", "circle", "ellipse", "numberline", "fractionbar", "plot", "highlight", "erase", "pause",
]);

/** Parse a list of raw commands, dropping (and logging) unknown or invalid ones. Never throws. */
export function parseBoard(raw: unknown): BoardCommand[] {
  if (!Array.isArray(raw)) return [];
  const out: BoardCommand[] = [];
  for (const c of raw) {
    const op = (c as { op?: unknown })?.op;
    if (typeof op !== "string" || !KNOWN_OPS.has(op)) {
      console.warn("[board] unknown op ignored:", op);
      continue;
    }
    const r = BoardCommand.safeParse(c);
    if (r.success) out.push(r.data);
    else console.warn("[board] invalid command ignored:", op, r.error.issues[0]?.message);
  }
  return out;
}

export const SEGMENT_TYPES = ["explain", "ask", "hint", "praise", "check"] as const;
export const EMOTIONS = ["neutral", "happy", "thinking", "excited", "encouraging"] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const Expect = z.object({
  kind: z.enum(["number", "fraction", "expression", "choice"]),
  answer: z.coerce.string().min(1).max(60),
  choices: z.array(z.coerce.string().max(60)).max(6).optional(),
  /** Optional UI hint, e.g. "1/3 = ?/6" shown next to the input. */
  prompt: z.coerce.string().max(60).optional(),
});
export type Expect = z.infer<typeof Expect>;

export const LessonSegment = z.object({
  id: z.coerce.string().min(1).max(64),
  type: z.enum(SEGMENT_TYPES),
  layer: z.enum(["main", "note"]).optional().catch(undefined),
  say: z.string().min(1).max(400),
  emotion: z.enum(EMOTIONS).catch("neutral"),
  board: z.unknown().transform(parseBoard),
  expect: Expect.optional(),
});
export type LessonSegment = z.infer<typeof LessonSegment>;

export const LessonSegments = z.array(LessonSegment).min(1).max(12);

/** Find a JSON array/object inside an LLM reply (handles ```json fences and chatter). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.search(/[[{]/);
    const endA = body.lastIndexOf("]");
    const endO = body.lastIndexOf("}");
    const end = Math.max(endA, endO);
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
    throw new Error("no JSON found");
  }
}

/** Validate an LLM reply into segments. Accepts an array or {segments:[...]}. */
export function parseSegments(text: string): { ok: true; segments: LessonSegment[] } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = extractJson(text);
  } catch (e) {
    return { ok: false, error: "Javob JSON emas: " + (e as Error).message };
  }
  if (data && !Array.isArray(data) && typeof data === "object") {
    const o = data as Record<string, unknown>;
    data = Array.isArray(o.segments) ? o.segments : [o];
  }
  // Fill missing ids so a sloppy-but-usable reply is not thrown away.
  if (Array.isArray(data)) {
    data = data.map((s, i) => (s && typeof s === "object" && !("id" in s) ? { ...s, id: `s${i + 1}` } : s));
  }
  const r = LessonSegments.safeParse(data);
  if (!r.success) {
    const iss = r.error.issues[0];
    return { ok: false, error: `${iss?.path.join(".")}: ${iss?.message}` };
  }
  // `ask` must carry an answer; otherwise downgrade to explain.
  const segments = r.data.map((s) => (s.type === "ask" && !s.expect ? { ...s, type: "explain" as const } : s));
  return { ok: true, segments };
}
