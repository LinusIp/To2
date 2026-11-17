// POST /api/diagnostic {action:"start"} | {action:"answer", answer} | {action:"skip"}
// The diagnostic session (history + current problem) lives in KV; the answer is never sent to the client.
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { generateProblem, seeded, type Problem } from "@/data/problems";
import { getSkill } from "@/data/skills";
import { checkAnswer } from "@/lib/learning/checker";
import { DIAG_LENGTH, diagnosticMastery, nextSkill, type DiagAnswer } from "@/lib/learning/diagnostic";
import { buildRoadmap } from "@/lib/learning/roadmap";
import { bad, json, userIdFor } from "@/lib/server/session";
import { addXp, getUser, saveRoadmap, setMasteryBulk } from "@/lib/server/repo";

interface DiagSession {
  grade: number;
  history: DiagAnswer[];
  current: Problem | null;
  seed: number;
}

const Body = z.object({ action: z.enum(["start", "answer", "skip"]), answer: z.string().max(100).optional() });

const publicProblem = (p: Problem, i: number) => ({
  index: i,
  total: DIAG_LENGTH,
  skillId: p.skillId,
  skillTitle: getSkill(p.skillId)?.title_uz ?? "",
  q: p.q,
  kind: p.expect.kind,
  choices: p.expect.choices,
  prompt: p.expect.prompt,
});

export async function POST(req: Request) {
  const user = await getUser(await userIdFor(req));
  if (!user) return bad("Avval ro'yxatdan o'ting", 401);
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return bad("So'rov noto'g'ri");
  const kv = getEnv().KV;
  const key = `diag:${user.id}`;

  const finish = async (s: DiagSession) => {
    const mastery = diagnosticMastery(s.history);
    await setMasteryBulk(user.id, mastery);
    const rm = buildRoadmap(mastery, s.grade, { touched: s.history.map((h) => h.skillId) });
    await saveRoadmap(user.id, rm);
    await addXp(user.id, 20);
    await kv.delete(key);
    return json({ done: true, weakCount: rm.weakCount, currentId: rm.currentId, correct: s.history.filter((h) => h.correct).length, total: s.history.length });
  };

  if (b.data.action === "start") {
    // Seeded per grade so the demo is reproducible (grade 6 → starts with adding unlike fractions).
    const s: DiagSession = { grade: user.grade, history: [], current: null, seed: 1000 + user.grade };
    const skillId = nextSkill(s.grade, s.history)!;
    s.current = generateProblem(skillId, seeded(s.seed));
    await kv.put(key, JSON.stringify(s), { expirationTtl: 3600 });
    return json({ problem: publicProblem(s.current, 0) });
  }

  const s = await kv.get<DiagSession>(key, "json");
  if (!s || !s.current) return bad("Diagnostika topilmadi", 404);

  if (b.data.action === "skip") {
    // "Testsiz boshlash": treat remaining as unknown
    return finish(s);
  }

  const res = checkAnswer(s.current.expect, b.data.answer ?? "");
  const correct = res.correct;
  s.history.push({ skillId: s.current.skillId, correct });
  const nxt = nextSkill(s.grade, s.history);
  const lastAnswer = s.current.expect.answer;
  if (!nxt) {
    const r = await finish(s);
    const body = (await r.json()) as Record<string, unknown>;
    return json({ ...body, correct, answer: lastAnswer });
  }
  s.current = generateProblem(nxt, seeded(s.seed + s.history.length * 31));
  await kv.put(key, JSON.stringify(s), { expirationTtl: 3600 });
  return json({ correct, answer: lastAnswer, problem: publicProblem(s.current, s.history.length) });
}
