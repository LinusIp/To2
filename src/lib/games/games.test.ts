import { describe, expect, it, vi } from "vitest";
import { seeded } from "@/data/problems";
import { SKILLS } from "@/data/skills";
import { checkAnswer } from "@/lib/learning/checker";
import { pickQuestions, toChoiceQuestion } from "./questions";
import { comboMultiplier, raceGoal, racePos, memoryScore, speedAnswer, speedStart, towerAnswer, towerStart, betterScore } from "./scoring";
import { deal, flip, memoryDone, memoryStart, PAIRS } from "./memory";
import { gameAnswer, GAME_MAX_P, type GameAnswerDeps } from "./answer";
import { MASTERED } from "@/lib/learning/mastery";

describe("combo + scoring", () => {
  it("combo multiplier ×1 / ×2 / ×3", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(comboMultiplier)).toEqual([1, 1, 1, 2, 2, 3, 3]);
  });
  it("tower: combo blocks add height, a miss resets the streak, ends after 10", () => {
    let s = towerStart();
    for (const right of [true, true, true, true, true, false, true, true, true, true]) s = towerAnswer(s, right);
    // 1+1+2+2+3 =9, miss, 1+1+2+2 = 6
    expect(s.height).toBe(15);
    expect(s.correct).toBe(9);
    expect(s.bestStreak).toBe(5);
    expect(s.blocks).toEqual([1, 1, 2, 2, 3, 1, 1, 2, 2]);
    expect(s.done).toBe(true);
    expect(towerAnswer(s, true)).toBe(s); // no answers after the end
  });
  it("speed: 10 points × combo, wrong resets", () => {
    let s = speedStart();
    for (const r of [true, true, true, false, true]) s = speedAnswer(s, r);
    expect(s.score).toBe(10 + 10 + 20 + 10);
    expect(s.streak).toBe(1);
    expect(s.answered).toBe(5);
    expect(betterScore(40, 30)).toBe(40);
    expect(betterScore(null, 30)).toBe(30);
  });
  it("race: the flag stands at the record (100 m at least), the runner stops at the flag", () => {
    expect(raceGoal(0)).toBe(100);
    expect(raceGoal(240)).toBe(240);
    expect(racePos(50, 100)).toBe(0.5);
    expect(racePos(300, 240)).toBe(1);
    expect(racePos(0, 0)).toBe(0);
  });
  it("memory score: perfect 1000, fewer for extra flips, never below 100", () => {
    expect(memoryScore(6, 6)).toBe(1000);
    expect(memoryScore(6, 10)).toBe(900);
    expect(memoryScore(6, 100)).toBe(100);
  });
});

describe("question picking", () => {
  it("no repeats, every question matches a requested skill, right answer is a choice", () => {
    const skillIds = ["frac-add-unlike", "eq-one-step"];
    const qs = pickQuestions({ skillIds, n: 10, rng: seeded(7) });
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.q)).size).toBe(10);
    for (const q of qs) {
      expect(skillIds).toContain(q.skillId);
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(checkAnswer(q.expect, q.choices[q.correct]).correct).toBe(true);
      q.choices.forEach((c, i) => i !== q.correct && expect(checkAnswer(q.expect, c).correct).toBe(false));
    }
    // round-robin: both skills appear
    expect(new Set(qs.map((q) => q.skillId)).size).toBe(2);
  });
  it("works for every skill in the graph (4 choices for nearly all)", () => {
    for (const s of SKILLS) {
      const qs = pickQuestions({ skillIds: [s.id], n: 3, rng: seeded(11) });
      expect(qs.length, s.id).toBeGreaterThan(0);
      for (const q of qs) expect(q.skillId).toBe(s.id);
    }
  });
  it("unknown skills give no questions (never someone else's skill)", () => {
    expect(pickQuestions({ skillIds: ["nope"], n: 5 })).toEqual([]);
  });
  it("fraction distractors are not equal to the answer", () => {
    const q = toChoiceQuestion({ skillId: "frac-equivalent", q: "?", hint: "", expect: { kind: "fraction", answer: "1/2" } }, seeded(3), "x");
    expect(q).not.toBeNull();
    for (const c of q!.choices.filter((_, i) => i !== q!.correct)) expect(checkAnswer(q!.expect, c).correct).toBe(false);
  });
});

describe("memory match", () => {
  it("deals 12 cards = 6 pairs, prefers the requested skill", () => {
    const cards = deal({ skillIds: ["frac-intro"], rng: seeded(5) });
    expect(cards).toHaveLength(12);
    const pairs = new Set(cards.map((c) => c.pairId));
    expect(pairs.size).toBe(6);
    for (const id of pairs) expect(PAIRS.find((p) => p.id === id)!.skillId).toBe("frac-intro");
  });
  it("flip: match, miss, and done", () => {
    const cards = deal({ rng: seeded(1) });
    let s = memoryStart();
    const [c1] = cards;
    const mate = cards.find((c) => c.pairId === c1.pairId && c.uid !== c1.uid)!;
    const other = cards.find((c) => c.pairId !== c1.pairId)!;
    let r = flip(s, cards, c1.uid);
    expect(r.event).toBe("open");
    r = flip(r.state, cards, other.uid);
    expect(r.event).toBe("miss");
    r = flip(r.state, cards, c1.uid); // third flip closes the two open ones
    expect(r.state.open).toEqual([c1.uid]);
    r = flip(r.state, cards, mate.uid);
    expect(r.event).toBe("match");
    expect(r.pairId).toBe(c1.pairId);
    s = r.state;
    for (const pid of new Set(cards.map((c) => c.pairId))) {
      if (s.matched.includes(pid)) continue;
      const [a, b] = cards.filter((c) => c.pairId === pid);
      s = flip(flip(s, cards, a.uid).state, cards, b.uid).state;
    }
    expect(memoryDone(s, cards)).toBe(true);
  });
});

describe("game answer → mastery (same recordAnswer as lessons)", () => {
  const deps = () => ({
    skillExists: (id: string) => SKILLS.some((s) => s.id === id),
    recordAnswer: vi.fn(async (_o: Parameters<GameAnswerDeps["recordAnswer"]>[0]) => ({ p: 0.4, before: 0.3, xp: 105, streak: 1 })),
  });
  it("a right answer calls recordAnswer with the skill, correct, small gain", async () => {
    const d = deps();
    const r = await gameAnswer("u1", { game: "tower", kind: "q", skillId: "frac-add-unlike", expect: { kind: "fraction", answer: "5/6" }, given: "5/6" }, d);
    expect(r).toMatchObject({ ok: true, correct: true, recorded: true, xp: 5 });
    expect(d.recordAnswer).toHaveBeenCalledOnce();
    expect(d.recordAnswer.mock.calls[0][0]).toMatchObject({ userId: "u1", skillId: "frac-add-unlike", correct: true, hintUsed: true, xp: 5, maxP: GAME_MAX_P });
    expect(GAME_MAX_P).toBeLessThan(MASTERED);
  });
  it("the server re-checks: a wrong answer is not recorded (games never lower mastery)", async () => {
    const d = deps();
    const r = await gameAnswer("u1", { game: "speed", kind: "q", skillId: "nat-mul", expect: { kind: "number", answer: "42" }, given: "41" }, d);
    expect(r).toMatchObject({ ok: true, correct: false, recorded: false });
    expect(d.recordAnswer).not.toHaveBeenCalled();
  });
  it("a memory pair updates its own skill", async () => {
    const d = deps();
    await gameAnswer("u1", { game: "memory", kind: "pair", pairId: "f-pyth" }, d);
    expect(d.recordAnswer.mock.calls[0][0]).toMatchObject({ skillId: "geo-pythagoras" });
  });
  it("unknown skill / pair → error, no guest → nothing recorded", async () => {
    const d = deps();
    expect((await gameAnswer("u1", { game: "memory", kind: "pair", pairId: "zzz" }, d)).ok).toBe(false);
    expect((await gameAnswer(null, { game: "memory", kind: "pair", pairId: "f-pyth" }, d)).ok).toBe(true);
    expect(d.recordAnswer).not.toHaveBeenCalled();
  });
});
