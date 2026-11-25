import { describe, expect, it, vi } from "vitest";
import { seeded } from "@/data/problems";
import { checkAnswer } from "@/lib/learning/checker";
import mathSkills from "@/data/skills.uz.json";
import fizSkills from "@/data/skills.fizika.uz.json";
import enSkills from "@/config/courses/english/skills.json";
import { JOBS, courseOf, jobBank, pickJob, pickMission, MISSION_STEPS, type Course } from "./mission";
import { sceneValue, uzNum, uzText } from "./scenes";
import { openQuest, questHref, ARENA_GAMES } from "./quest";
import { gameAnswer, GAME_MAX_P } from "./answer";

const idsOf = (x: unknown): string[] => {
  const arr = Array.isArray(x) ? x : ((x as { skills?: unknown[] }).skills ?? Object.values(x as object));
  return (arr as { id: string }[]).map((s) => s.id);
};
const SKILL_IDS: Record<Course, Set<string>> = { math: new Set(idsOf(mathSkills)), physics: new Set(idsOf(fizSkills)), english: new Set(idsOf(enSkills)) };
const allItems = () => (Object.keys(JOBS) as Course[]).flatMap((c) => JOBS[c].flatMap((j) => j.items.map((it) => ({ c, j, it }))));

describe("Kasb sinovi bank", () => {
  it("every careers skillId is a real skill of its course", () => {
    for (const { c, j, it } of allItems()) expect(SKILL_IDS[c].has(it.skillId), `${c}/${j.id}/${it.id}: ${it.skillId}`).toBe(true);
    for (const { c, it } of allItems()) expect(courseOf(it.skillId), it.id).toBe(c);
  });
  it("at least 3 jobs per course, each with 5+ items, unique ids", () => {
    for (const c of Object.keys(JOBS) as Course[]) {
      expect(JOBS[c].length, c).toBeGreaterThanOrEqual(3);
      for (const j of JOBS[c]) expect(j.items.length, j.id).toBeGreaterThanOrEqual(MISSION_STEPS);
    }
    const ids = allItems().map(({ it }) => it.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("answer among 3–4 unique choices, no distractor accepted by the checker", () => {
    for (const { it } of allItems()) {
      expect(it.choices.length).toBeGreaterThanOrEqual(3);
      expect(it.choices.length).toBeLessThanOrEqual(4);
      expect(new Set(it.choices).size).toBe(it.choices.length);
      expect(it.choices).toContain(it.answer);
      for (const w of it.choices.filter((x) => x !== it.answer)) expect(checkAnswer({ kind: "choice", answer: it.answer }, w).correct, it.id).toBe(false);
    }
  });
  it("every item has a scene, and the solved scene shows exactly the answer", () => {
    for (const { it } of allItems()) {
      expect(it.scene, it.id).toBeTruthy();
      const v = sceneValue(it.scene);
      if (v === null) {
        expect(it.scene.kind).toBe("sign");
        expect(it.scene.kind === "sign" && it.scene.text.includes("___"), it.id).toBe(true);
      } else {
        expect(checkAnswer({ kind: "number", answer: v }, it.answer).correct, `${it.id}: scene ${v} vs answer ${it.answer}`).toBe(true);
      }
    }
  });
  it("Uzbek decimal comma in every question, hint and choice", () => {
    for (const { it } of allItems()) for (const s of [it.q, it.hint, ...it.choices]) expect(/\d\.\d/.test(s), `${it.id}: ${s}`).toBe(false);
    expect(uzNum(4.5)).toBe("4,5");
    expect(uzNum(0.25)).toBe("0,25");
    expect(uzNum(36000)).toBe("36 000");
    expect(uzText("1.5 kg")).toBe("1,5 kg");
  });
  it("course from skill id", () => {
    expect(courseOf("frac-add-unlike")).toBe("math");
    expect(courseOf("fiz-tezlik")).toBe("physics");
    expect(courseOf("en-plurals")).toBe("english");
    expect(courseOf(null)).toBe("math");
  });
});

describe("pickMission", () => {
  it("5 steps, no repeats, the chosen skill first, right answer present, scene attached", () => {
    const m = pickMission({ skillId: "fiz-tezlik", jobId: "muhandis", rng: seeded(3) });
    expect(m.course).toBe("physics");
    expect(m.steps).toHaveLength(MISSION_STEPS);
    expect(new Set(m.steps.map((s) => s.q)).size).toBe(MISSION_STEPS);
    expect(m.steps[0].skillId).toBe("fiz-tezlik");
    for (const s of m.steps) {
      expect(s.story).not.toBe("");
      expect(s.scene).toBeTruthy();
      expect(checkAnswer(s.expect, s.choices[s.correct]).correct).toBe(true);
    }
  });
  it("every job can fill a 5-step mission", () => {
    for (const c of Object.keys(JOBS) as Course[])
      for (const j of JOBS[c]) {
        const m = pickMission({ course: c, jobId: j.id, rng: seeded(9) });
        expect(m.steps, j.id).toHaveLength(5);
        expect(Object.keys(jobBank(j)).length).toBeGreaterThan(0);
      }
  });
  it("a replay picks a different job than last time", () => {
    for (const c of Object.keys(JOBS) as Course[])
      for (const last of JOBS[c])
        for (let s = 0; s < 20; s++) expect(pickJob(JOBS[c], { lastJobId: last.id, rng: seeded(s) }).id).not.toBe(last.id);
    // and the chosen skill still steers which job (among the fresh ones)
    expect(pickJob(JOBS.math, { skillId: "nat-order-ops", lastJobId: "quruvchi", rng: seeded(2) }).id).toBe("sotuvchi");
    expect(pickMission({ skillId: "geo-perimeter", lastJobId: "oshpaz", rng: seeded(4) }).job.id).toBe("quruvchi");
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
    const it0 = JOBS.math[0].items[1];
    const r = await gameAnswer("u", { game: "mission", kind: "q", skillId: it0.skillId, expect: { kind: "choice", answer: it0.answer, choices: it0.choices }, given: it0.answer }, { skillExists: () => true, recordAnswer: rec });
    expect(r).toMatchObject({ ok: true, correct: true, recorded: true });
    expect(rec.mock.calls[0][0]).toMatchObject({ skillId: "geo-area-rect", maxP: GAME_MAX_P });
  });
});
