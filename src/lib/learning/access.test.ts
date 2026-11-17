import { describe, expect, it } from "vitest";
import { buildRoadmap, type Roadmap } from "./roadmap";
import { PASS_SCORE, isOpen, lockReason, nextLesson, quizPassed, quizScore } from "./access";

// grade-6 learner: weak at adding unlike fractions and at EKUK, basics mastered
const BASE = { "frac-add-unlike": 0.2, lcm: 0.2, "frac-equivalent": 0.9, "frac-add-like": 0.9, gcd: 0.9, primes: 0.9, "frac-intro": 0.9, "nat-div": 0.9, "div-rules": 0.9, "nat-mul": 0.9, "nat-add-sub": 0.9, "nat-place-value": 0.9 };
const node = (rm: Roadmap, id: string) => rm.nodes.find((n) => n.id === id)!;

describe("lesson access rules (one function for every screen)", () => {
  it("the path starts at the prerequisite, and the dependent lesson is locked with a reason", () => {
    const rm = buildRoadmap(BASE, 6);
    expect(rm.path.slice(0, 2)).toEqual(["lcm", "frac-add-unlike"]);
    expect(node(rm, "lcm").status).toBe("current");
    const fau = node(rm, "frac-add-unlike");
    expect(fau.status).toBe("locked");
    expect(isOpen(fau)).toBe(false);
    expect(fau.lockedBy).toBe("lcm");
    expect(lockReason(rm, fau)).toBe("Avval 1-darsni tugating");
    expect(lockReason(rm, node(rm, "lcm"))).toBeNull();
  });

  it("a lesson that was started but not mastered stays open", () => {
    const rm = buildRoadmap(BASE, 6, { started: ["frac-add-unlike"] });
    const fau = node(rm, "frac-add-unlike");
    expect(fau.started).toBe(true);
    expect(isOpen(fau)).toBe(true);
    expect(fau.lockedBy).toBeNull();
  });

  it("a mastered lesson stays open (practice / re-watch)", () => {
    const rm = buildRoadmap({ ...BASE, lcm: 0.95 }, 6);
    expect(node(rm, "lcm").status).toBe("mastered");
    expect(isOpen(node(rm, "lcm"))).toBe(true);
    // its dependant is now unlocked and current
    expect(node(rm, "frac-add-unlike").status).toBe("current");
  });

  it("locked nodes off the path name the lesson to finish first", () => {
    const rm = buildRoadmap(BASE, 6);
    for (const n of rm.nodes.filter((x) => x.status === "locked")) {
      expect(n.lockedBy, n.id).not.toBeNull();
      expect(lockReason(rm, n), n.id).toMatch(/^Avval /);
    }
  });

  it("next lesson = next open unmastered lesson on the path; none left → null (back to the roadmap)", () => {
    const rm = buildRoadmap({ ...BASE, lcm: 0.95 }, 6);
    expect(nextLesson(rm, "lcm")).toBe("frac-add-unlike");
    // after the last path lesson, fall back to an earlier unmastered one or any open lesson
    const done = buildRoadmap({ ...BASE, lcm: 0.95, "frac-add-unlike": 0.95 }, 6);
    const nx = nextLesson(done, "frac-add-unlike");
    if (nx) expect(isOpen(node(done, nx)) && node(done, nx).status !== "mastered").toBe(true);
    // never suggests the lesson just finished, and never a locked one
    const rm2 = buildRoadmap(BASE, 6);
    const n2 = nextLesson(rm2, "lcm");
    expect(n2).not.toBe("lcm");
    if (n2) expect(isOpen(node(rm2, n2))).toBe(true);
  });

  it("returns null when every lesson is mastered", () => {
    const all = Object.fromEntries(buildRoadmap(BASE, 6).nodes.map((n) => [n.id, 0.99]));
    expect(nextLesson(buildRoadmap(all, 6), "lcm")).toBeNull();
  });
});

describe("quiz scoring", () => {
  it("first try = 1, after retries = ½, skipped = 0; pass at 60 %", () => {
    expect(quizScore(["first", "first", "first", "skipped", "skipped"])).toBe(0.6);
    expect(quizPassed(["first", "first", "first", "skipped", "skipped"])).toBe(true);
    expect(quizScore(["first", "first", "retry", "skipped", "skipped"])).toBe(0.5);
    expect(quizPassed(["first", "first", "retry", "skipped", "skipped"])).toBe(false);
    expect(quizScore([])).toBe(0);
    expect(PASS_SCORE).toBe(0.6);
  });
});
