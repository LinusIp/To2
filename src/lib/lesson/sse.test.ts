// Cause: a stream that closes without `done` was treated as a finished lesson/answer.
import { describe, expect, it } from "vitest";
import { readTutorStream, TutorStreamError } from "./sse";

function sseResponse(chunks: string[], status = 200) {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(body, { status, headers: { "content-type": "text/event-stream" } });
}
const ev = (e: string, d: unknown) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
const seg = (id: string) => ({ id, type: "explain", say: "x", emotion: "neutral", board: [] });

describe("readTutorStream", () => {
  it("reports done: true only when the server's done event arrives", async () => {
    const got: string[] = [];
    const r = await readTutorStream(sseResponse([ev("meta", { source: "demo" }), ev("segment", seg("a")), ev("segment", seg("b")), ev("done", { segments: 2 })]), {
      onSegment: (s) => got.push(s.id),
    });
    expect(r.done).toBe(true);
    expect(got).toEqual(["a", "b"]);
  });

  it("a stream that just closes (no done) is reported as broken, keeping what arrived", async () => {
    const got: string[] = [];
    const r = await readTutorStream(sseResponse([ev("segment", seg("a")), ev("segment", seg("b"))]), { onSegment: (s) => got.push(s.id) });
    expect(r.done).toBe(false);
    expect(got).toEqual(["a", "b"]);
  });

  it("a stream cut in the middle of an event drops the partial event and reports broken", async () => {
    const got: string[] = [];
    const whole = ev("segment", seg("a")) + ev("segment", seg("b"));
    const r = await readTutorStream(sseResponse([whole.slice(0, whole.length - 20)]), { onSegment: (s) => got.push(s.id) });
    expect(r.done).toBe(false);
    expect(got).toEqual(["a"]);
  });

  it("events split across chunks are reassembled", async () => {
    const whole = ev("segment", seg("a")) + ev("done", {});
    const got: string[] = [];
    const r = await readTutorStream(sseResponse([whole.slice(0, 7), whole.slice(7, 30), whole.slice(30)]), { onSegment: (s) => got.push(s.id) });
    expect(r).toEqual({ done: true });
    expect(got).toEqual(["a"]);
  });

  it("an error event and a non-200 response throw (the caller offers a retry)", async () => {
    await expect(readTutorStream(sseResponse([ev("segment", seg("a")), ev("error", { message: "tutor_failed" })]), { onSegment: () => {} })).rejects.toBeInstanceOf(TutorStreamError);
    await expect(readTutorStream(sseResponse([], 500), { onSegment: () => {} })).rejects.toBeInstanceOf(TutorStreamError);
  });

  it("a garbled event is skipped, not fatal", async () => {
    const got: string[] = [];
    const r = await readTutorStream(sseResponse(["event: segment\ndata: {not json\n\n", ev("segment", seg("b")), ev("done", {})]), { onSegment: (s) => got.push(s.id) });
    expect(r.done).toBe(true);
    expect(got).toEqual(["b"]);
  });
});
