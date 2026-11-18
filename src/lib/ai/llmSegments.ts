// Turning one JSON object from the LLM stream into a lesson segment (pure, tested in llmSegments.test.ts).
// An object that fails validation is DROPPED and reported; the stream carries on with the next one,
// so one bad segment never stalls the lesson.
import { LessonSegment, type LessonSegment as Seg } from "./schema";
import type { Msg } from "./types";

export interface SegState {
  /** segments accepted so far (including any the client already has) */
  count: number;
  /** segment ids already used (prior segments included), to keep ids unique */
  seen: Set<string>;
  /** interrupt answers always go on the note layer */
  note: boolean;
}

export type SegResult = { ok: true; seg: Seg } | { ok: false; error: string };

export function segmentFromLLM(obj: string, st: SegState, fit: (c: Seg["board"][number]) => Seg["board"][number] = (c) => c): SegResult {
  let data: unknown;
  try {
    data = JSON.parse(obj);
  } catch {
    return { ok: false, error: "not JSON" };
  }
  if (data && typeof data === "object" && !("id" in data)) (data as Record<string, unknown>).id = `s${st.count + 1}`;
  const r = LessonSegment.safeParse(data);
  if (!r.success) return { ok: false, error: `${r.error.issues[0]?.path.join(".")}: ${r.error.issues[0]?.message}` };
  let s = r.data;
  if (s.type === "ask" && !s.expect) s = { ...s, type: "explain" };
  if (st.seen.has(s.id)) s = { ...s, id: `${s.id}_${st.count}` };
  st.seen.add(s.id);
  s = { ...s, board: s.board.map(fit) };
  if (st.note) s = { ...s, layer: "note" };
  st.count++;
  return { ok: true, seg: s };
}

/**
 * Messages for continuing a lesson/answer whose stream broke: the original conversation, then the
 * segments the learner already got (as the assistant's own reply), then "continue from here".
 */
export function continuationMessages(base: Msg[], prior: Seg[]): Msg[] {
  const slim = prior.map(({ id, type, say, emotion, board, expect, layer }) => ({ id, type, say, emotion, board, expect, layer }));
  return [
    ...base,
    { role: "assistant", content: JSON.stringify(slim) },
    {
      role: "user",
      content:
        "Javob shu yerda uzilib qoldi. Yuqoridagi segmentlardan KEYIN davom ettir: faqat QOLGAN segmentlarni xuddi shu formatda JSON massiv qilib yoz. Oldingilarini takrorlama, yangi id ishlat.",
    },
  ];
}
