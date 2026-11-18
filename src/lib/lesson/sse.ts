// Minimal SSE reader for POST responses (EventSource can't POST).
// The server ALWAYS ends a complete stream with a `done` event. A stream that closes without it
// (Worker killed, network drop, proxy timeout) is reported as `done: false` so the player can offer
// "Davom etamizmi?" and resume — it must never be mistaken for the end of the lesson.
import type { LessonSegment } from "@/lib/ai/schema";

export interface TutorStreamHandlers {
  onSegment: (s: LessonSegment) => void;
  onMeta?: (m: Record<string, unknown>) => void;
}

export interface TutorStreamResult {
  /** true only when the server's `done` event arrived */
  done: boolean;
}

export class TutorStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TutorStreamError";
  }
}

export async function readTutorStream(res: Response, h: TutorStreamHandlers): Promise<TutorStreamResult> {
  if (!res.ok || !res.body) throw new TutorStreamError(`tutor ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed: { message?: string };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue; // a garbled event is skipped, not fatal
      }
      if (event === "segment") h.onSegment(parsed as LessonSegment);
      else if (event === "meta") h.onMeta?.(parsed as Record<string, unknown>);
      else if (event === "error") throw new TutorStreamError(parsed.message ?? "tutor error");
      else if (event === "done") {
        void reader.cancel().catch(() => {});
        return { done: true };
      }
    }
    if (done) return { done: false };
  }
}
