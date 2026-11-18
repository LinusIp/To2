import { describe, expect, it, vi } from "vitest";
import { seeded } from "@/data/problems";
import { checkAnswer } from "@/lib/learning/checker";
import { CAREERS, courseOf, pickMission, MISSION_STEPS } from "./mission";
import { openQuest, questHref, ARENA_GAMES } from "./quest";
import { gameAnswer, GAME_MAX_P } from "./answer";

describe("Kasb sinovi bank", () => {
  it("10 hand-written items per course, answer among 3–4 unique choices", () => {
    for (const c of Object.values(CAREERS)) {
      expect(c.items).toHaveLength(10);
      for (const it of c.items) {
        expect(it.choices.length).toBeGreaterThanOrEqual(3);
        expect(it.choices.length).toBeLessThanOrEqual(4);
        expect(new Set(it.choices).size).toBe(it.choices.length);
        expect(it.choices).toContain(it.answer);
        for (const w of it.choices.filter((x) => x !== it.answer)) expect(checkAnswer({ kind: "choice", answer: it.answer }, w).correct, it.id).toBe(false);
      }
    }
  });
  it("course from skill id", () => {
    expect(courseOf("frac-add-unlike")).toBe("math");
    expect(courseOf("phys-speed")).toBe("physics");
    expect(courseOf("en-numbers")).toBe("english");
    expect(courseOf(null)).toBe("math");
  });
});

describe("pickMission", () => {
  it("5 steps, no repeats, the chosen skill first, right answer present", () => {
    const m = pickMission({ skillId: "phys-speed", rng: seeded(3) });
    expect(m.course).toBe("physics");
    expect(m.steps).toHaveLength(MISSION_STEPS);
    expect(new Set(m.steps.map((s) => s.q)).size).toBe(MISSION_STEPS);
    // phys-speed has 3 items → the first three steps are on that skill
    expect(m.steps.slice(0, 3).every((s) => s.skillId === "phys-speed")).toBe(true);
    for (const s of m.steps) {
      expect(s.story).not.toBe("");
      expect(checkAnswer(s.expect, s.choices[s.correct]).correct).toBe(true);
    }
  });
  it("a math skill without career items still gets a builder mission", () => {
    const m = pickMission({ skillId: "lcm", rng: seeded(1) });
    expect(m.course).toBe("math");
    expect(m.career.job).toBe("quruvchi");
    expect(m.steps).toHaveLength(5);
  });
});

describe("openQuest launcher", () => {
  it("workshop → Kasb sinovi, arena → one of the 3 games, skill passed through", () => {
    expect(questHref("workshop", "geo-area-rect")).toBe("/games/mission?skill=geo-area-rect");
    expect(questHref("arena", "lcm", { game: "speed" })).toBe("/games/speed?skill=lcm");
    const seen = new Set(Array.from({ length: 40 }, (_, i) => questHref("arena", null, { rng: seeded(i) }).split("?")[0]));
    expect([...seen].sort()).toEqual(ARENA_GAMES.map((g) => `/games/${g}`).sort());
    const nav = vi.fn();
    expect(openQuest("workshop", "lcm", { navigate: nav })).toBe("/games/mission?skill=lcm");
    expect(nav).toHaveBeenCalledWith("/games/mission?skill=lcm");
  });
});

describe("mission answers use the same mastery path + cap", () => {
  it("right answer → recordAnswer with maxP", async () => {
    const rec = vi.fn(async (_o: unknown) => ({ p: 0.4, before: 0.3, xp: 5, streak: 1 }));
    const it0 = CAREERS.math.items[1];
    const r = await gameAnswer("u", { game: "mission", kind: "q", skillId: it0.skillId, expect: { kind: "choice", answer: it0.answer, choices: it0.choices }, given: it0.answer }, { skillExists: () => true, recordAnswer: rec });
    expect(r).toMatchObject({ ok: true, correct: true, recorded: true });
    expect(rec.mock.calls[0][0]).toMatchObject({ skillId: "geo-area-rect", maxP: GAME_MAX_P });
  });
});
