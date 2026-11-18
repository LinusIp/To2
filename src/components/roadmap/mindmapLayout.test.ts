import { describe, expect, it } from "vitest";
import { layoutMindMap, MIN_LEAF_GAP } from "./mindmapLayout";
import { buildMindMap, buildPath } from "@/lib/learning/path";
import { CURRICULA } from "@/data/curricula";

describe("mind map layout", () => {
  for (const grade of [5, 6, 7, 8]) {
    it(`no two skill dots touch (maths, grade ${grade})`, () => {
      const math = CURRICULA.matematika;
      const p = buildPath(math, {}, grade);
      const mm = buildMindMap(math, {}, p, { grade, maxGrade: Math.max(grade, 6) + 1 });
      const { leaves } = layoutMindMap(mm);
      let min = Infinity;
      for (let i = 0; i < leaves.length; i++)
        for (let j = i + 1; j < leaves.length; j++) min = Math.min(min, Math.hypot(leaves[i].x - leaves[j].x, leaves[i].y - leaves[j].y));
      expect(min).toBeGreaterThanOrEqual(MIN_LEAF_GAP - 4);
      for (const l of leaves) {
        const r = Math.hypot(l.x - 500, l.y - 500);
        expect(r).toBeLessThanOrEqual(470);
        expect(r).toBeGreaterThanOrEqual(305);
      }
    });
  }
});
