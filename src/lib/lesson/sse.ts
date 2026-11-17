// Minimal SSE reader for POST responses (EventSource can't POST).
import type { LessonSegment } from "@/lib/ai/schema";

export interface TutorStreamHandlers {
  onSegment: (s: LessonSegment) => void;
  onMeta?: (m: Record<string, unknown>) => void;
}

export async function readTutorStream(res: Response, h: TutorStreamHandlers): Promise<void> {
  if (!res.ok || !res.body) throw new Error(`tutor ${res.status}`);
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
      const parsed = JSON.parse(data);
      if (event === "segment") h.onSegment(parsed as LessonSegment);
      else if (event === "meta") h.onMeta?.(parsed);
      else if (event === "error") throw new Error(parsed.message ?? "tutor error");
      else if (event === "done") return;
    }
    if (done) return;
  }
}
