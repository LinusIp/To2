import { describe, expect, it } from "vitest";
import raw from "../../../public/ui/town-math.json";
import { ARENA_GAMES, arenaGame, assignQuests, parseTown, questFallback, questHref, townProgress, townVoiceCommand, type TownData } from "./town";
import { buildPath, type Curriculum } from "./path";
import { CURRICULA } from "@/data/curricula";
import { TOWNS } from "@/config/towns";

const town = parseTown(raw);
const math = CURRICULA.matematika;

describe("town JSON", () => {
  it("placeholder math town parses: 7 quests, temple last, markers in 0..1", () => {
    expect(town.quests).toHaveLength(7);
    expect(town.quests.at(-1)!.kind).toBe("temple");
    expect(town.route.length).toBeGreaterThan(2);
  });
  it("rejects unknown kinds and markers outside the image", () => {
    expect(() => parseTown({ ...raw, quests: [{ i: 0, kind: "castle", marker: [0.1, 0.1] }] })).toThrow();
    expect(() => parseTown({ ...raw, quests: [{ i: 0, kind: "school", marker: [1.4, 0.1] }] })).toThrow();
  });
  it("every town with a curriculum on this branch has one", () => {
    expect(TOWNS.filter((t) => CURRICULA[t.curriculum]).map((t) => t.id)).toEqual(["math"]);
  });
});

describe("assignQuests", () => {
  const demo = { "frac-add-unlike": 0.4, lcm: 0.35, primes: 0.6, "frac-equivalent": 0.86, "frac-intro": 0.9 };
  const path = buildPath(math, demo, 6);

  it("topics follow the personal path; weak topic gets school + arena; temple = path goal", () => {
    const q = assignQuests(town, path, []);
    const order = path.order;
    expect(q[0].skillId).toBe(order[0]);
    expect(q.at(-1)!.skillId).toBe(order.at(-1));
    for (let k = 0; k < q.length - 1; k++) {
      if (q[k].kind === "school" && q[k].weak && q[k + 1].kind === "arena") expect(q[k + 1].skillId).toBe(q[k].skillId);
    }
    // non-temple topics never go backwards along the path
    const idx = q.slice(0, -1).map((x) => order.indexOf(x.skillId!));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it("weak first step → school and arena share it", () => {
    const fiz: Curriculum = { id: "fizika", title: "Fizika", skills: [
      { id: "a", title_uz: "A", grade: 7, prereqs: [], section: "S" },
      { id: "b", title_uz: "B", grade: 7, prereqs: ["a"], section: "S" },
    ] };
    const p = buildPath(fiz, { a: 0.2, b: 0.3 }, 7);
    const q = assignQuests(town, p, []);
    expect(q.slice(0, 3).map((x) => x.skillId)).toEqual(["a", "a", "b"]);
  });

  it("status: done ones gold, first open one current, the rest locked (no href)", () => {
    const q = assignQuests(town, path, [1, 2]);
    expect(q.map((x) => x.status)).toEqual(["done", "done", "current", "locked", "locked", "locked", "locked"]);
    expect(q[3].href).toBeNull();
    expect(q[2].href).toContain("town=math&q=3");
    expect(townProgress(q)).toEqual({ done: 2, total: 7 });
  });

  it("each kind opens the right quest type", () => {
    expect(questHref("school", "lcm", "math", 1)).toMatch(/^\/lesson\/lcm\?/);
    expect(questHref("library", "lcm", "math", 1)).toMatch(/^\/practice\/lcm\?town/);
    expect(questHref("arena", "lcm", "math", 2)).toMatch(/^\/games\/(tower|speed|memory)\?skill=lcm&town=math&q=2$/);
    expect(questHref("workshop", "lcm", "math", 5)).toBe("/games/mission?skill=lcm&town=math&q=5");
    expect(questFallback("arena", "lcm", "math", 2)).toContain("/practice/lcm?mode=arena");
    expect(questFallback("school", "lcm", "math", 1)).toBeNull();
    expect(questHref("temple", "lcm", "math", 7)).toContain("final=1");
  });

  it("empty path → no topic, nothing opens", () => {
    const empty = { subject: "x", steps: [], order: [], currentId: null, weakCount: 0 };
    const q = assignQuests(town as TownData, empty, []);
    expect(q.every((x) => x.href === null)).toBe(true);
  });
});

describe("games + voice", () => {
  it("arena game is stable per pin and always a known game", () => {
    expect(arenaGame("lcm", 2)).toBe(arenaGame("lcm", 2));
    const seen = new Set(["lcm", "gcd", "primes", "frac-intro", "nat-mul"].flatMap((s) => [1, 2, 5].map((n) => arenaGame(s, n))));
    for (const g of seen) expect(ARENA_GAMES).toContain(g);
    expect(seen.size).toBeGreaterThan(1);
  });
  it("voice commands: next/open/back + feat/inclusive names", () => {
    expect(townVoiceCommand({ command: "next" })).toBe("next");
    expect(townVoiceCommand("open")).toBe("open");
    expect(townVoiceCommand({ type: "continue" })).toBe("open");
    expect(townVoiceCommand({ type: "home" })).toBe("back");
    expect(townVoiceCommand({ command: "slower" })).toBeNull();
    expect(townVoiceCommand(null)).toBeNull();
  });
});
