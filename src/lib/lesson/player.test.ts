import { describe, expect, it } from "vitest";
import { initialPlayer, transition, type PlayerEvent, type PlayerState } from "./player";

const run = (events: PlayerEvent[], s: PlayerState = initialPlayer) => events.reduce(transition, s);

describe("lesson player state machine", () => {
  it("starts speaking", () => {
    expect(run([{ type: "START" }]).status).toBe("speaking");
  });

  it("full barge-in loop returns to speaking", () => {
    const steps: PlayerEvent[] = [
      { type: "START" },
      { type: "BARGE_IN" },
      { type: "LISTEN" },
      { type: "QUESTION_SENT" },
      { type: "REPLY_READY" },
      { type: "REPLY_END" },
      { type: "CONTINUE" },
    ];
    const seen: string[] = [];
    steps.reduce((s, e) => {
      const n = transition(s, e);
      seen.push(n.status);
      return n;
    }, initialPlayer);
    expect(seen).toEqual(["speaking", "paused", "listening", "thinking", "answering", "checking", "speaking"]);
  });

  it("resumes to awaiting when interrupted during an ask", () => {
    const s = run([{ type: "START" }, { type: "ASK_REACHED" }, { type: "BARGE_IN" }, { type: "LISTEN" }, { type: "CANCEL" }]);
    expect(s.status).toBe("awaiting");
  });

  it("interrupting the answer keeps the original resume point (nesting max 1)", () => {
    const s = run([
      { type: "START" },
      { type: "ASK_REACHED" },
      { type: "BARGE_IN" },
      { type: "LISTEN" },
      { type: "QUESTION_SENT" },
      { type: "REPLY_READY" },
      { type: "BARGE_IN" },
    ]);
    expect(s.status).toBe("paused");
    expect(s.depth).toBe(1);
    expect(s.resumeTo).toBe("awaiting");
    const back = run([{ type: "LISTEN" }, { type: "QUESTION_SENT" }, { type: "REPLY_READY" }, { type: "REPLY_END" }, { type: "CONTINUE" }], s);
    expect(back).toEqual({ status: "awaiting", resumeTo: null, depth: 0 });
  });

  it("explain again goes back to thinking", () => {
    const s = run([
      { type: "START" },
      { type: "BARGE_IN" },
      { type: "QUESTION_SENT" },
      { type: "REPLY_READY" },
      { type: "REPLY_END" },
      { type: "EXPLAIN_AGAIN" },
    ]);
    expect(s.status).toBe("thinking");
  });

  it("a failed reply resumes the lesson", () => {
    const s = run([{ type: "START" }, { type: "BARGE_IN" }, { type: "QUESTION_SENT" }, { type: "REPLY_FAILED" }]);
    expect(s.status).toBe("speaking");
  });

  it("ignores barge-in when idle or done", () => {
    expect(run([{ type: "BARGE_IN" }]).status).toBe("idle");
    expect(run([{ type: "START" }, { type: "FINISH" }, { type: "BARGE_IN" }]).status).toBe("done");
  });

  it("correct answer continues the lesson", () => {
    expect(run([{ type: "START" }, { type: "ASK_REACHED" }, { type: "ANSWER_CORRECT" }]).status).toBe("speaking");
  });
});
