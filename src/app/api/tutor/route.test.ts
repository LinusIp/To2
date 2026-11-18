// "Same answer every time" regression: /api/tutor with a stub LLM that answers whatever it is asked.
// 3 different questions → 3 different answers (no pinned/cache/fallback answer served by mistake);
// the same question in another subject → its own cache entry.
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const llmCalls: string[] = [];

vi.mock("@/lib/env", () => ({ getEnv: () => ({}), isMock: () => false }));
vi.mock("@/lib/server/store", () => ({
  storeGetText: async (k: string) => store.get(k) ?? null,
  storeGetJson: async (k: string) => (store.has(k) ? JSON.parse(store.get(k)!) : null),
  storePut: async (k: string, v: string) => (store.set(k, v), true),
}));
vi.mock("@/lib/server/answerLog", () => ({ logAnswer: async () => {} }));
vi.mock("@/lib/server/repo", () => ({ getMastery: async () => ({}), recentMistakes: async () => [], startLessonRow: async () => {} }));
vi.mock("@/lib/server/session", () => ({
  bad: (m: string, status = 400) => new Response(JSON.stringify({ error: m }), { status }),
  clientKey: () => "test",
  rateLimit: async () => true,
  userIdFor: async () => null,
}));
vi.mock("@/lib/ai", () => ({
  getAI: () => ({
    mock: false,
    llm: {
      // answers the question it was given (last user message), as a note
      async *stream(messages: { role: string; content: string }[]) {
        const q = /O'quvchining savoli: "([^"]+)"/.exec(messages.at(-1)!.content)?.[1] ?? "?";
        llmCalls.push(q);
        yield JSON.stringify([{ id: "a1", type: "explain", layer: "note", emotion: "neutral", say: `Javob: ${q}`, board: [] }]);
      },
      complete: async () => "[]",
    },
  }),
}));

const { POST } = await import("./route");

async function askTutor(skillId: string, question: string) {
  const res = await POST(
    new Request("http://x/api/tutor", {
      method: "POST",
      body: JSON.stringify({ mode: "interrupt", skillId, characterId: "blokbek", grade: 6, question, step: 2, board: [], history: [] }),
    }),
  );
  const text = await res.text();
  const meta = [...text.matchAll(/event: meta\ndata: (.*)/g)].map((m) => JSON.parse(m[1]));
  const says = [...text.matchAll(/event: segment\ndata: (.*)/g)].map((m) => JSON.parse(m[1]).say as string);
  return { source: meta[0]?.source as string, first: says[0] };
}

describe("/api/tutor live answers", () => {
  beforeEach(() => {
    store.clear();
    llmCalls.length = 0;
  });

  it("3 different questions → 3 different answers (fractions demo lesson, look-alikes of the pinned ones)", async () => {
    const qs = ["Nega maxrajlarni qo'shmadik?", "Nega olti emas, o'n ikki?", "Kasr nima?"];
    const answers = [];
    for (const q of qs) answers.push(await askTutor("frac-add-unlike", q));
    expect(answers.map((a) => a.source)).toEqual(["llm", "llm", "llm"]);
    expect(new Set(answers.map((a) => a.first)).size).toBe(3);
    expect(answers.map((a) => a.first)).toEqual(qs.map((q) => `Javob: ${q}`));
  });

  it("3 different questions in fizika → 3 different answers; a repeat comes from the cache", async () => {
    const qs = ["Tezlik nima?", "Nega bo'lamiz?", "Soat nima uchun kerak?"];
    const answers = [];
    for (const q of qs) answers.push(await askTutor("fiz-tezlik", q));
    expect(new Set(answers.map((a) => a.first)).size).toBe(3);
    const again = await askTutor("fiz-tezlik", "tezlik nima");
    expect(again.source).toBe("interrupt-cache");
    expect(again.first).toBe("Javob: Tezlik nima?");
  });

  it("the same question in another subject is not served from the first subject's cache", async () => {
    await askTutor("fiz-tezlik", "Bu nima?");
    const other = await askTutor("t:Fotosintez", "Bu nima?");
    expect(other.source).toBe("llm");
    expect(llmCalls).toHaveLength(2);
  });

  it("the exact demo question still gets the pinned, reviewed answer", async () => {
    const r = await askTutor("frac-add-unlike", "Nega maxrajlarni ko'paytirdik?");
    expect(r.source).toBe("pinned");
    expect(llmCalls).toHaveLength(0);
  });
});
