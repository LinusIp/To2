import { describe, expect, it } from "vitest";
import { narrateBoard, narrateFormula, narrateQuestion } from "./narrator";
import type { BoardEl } from "@/lib/board/model";

describe("narrateFormula — the board read aloud", () => {
  const cases: [string, string][] = [
    ["x² − 5x + 6 = 0", "iks kvadrat minus besh iks qo'shuv olti teng nol"],
    ["1/2 + 1/3 = 5/6", "ikkidan bir qo'shuv uchdan bir teng oltidan besh"],
    ["2x + 3 = 11", "ikki iks qo'shuv uch teng o'n bir"],
    ["x = 4", "iks teng to'rt"],
    ["√16 = 4", "o'n oltining ildizi teng to'rt"],
    ["(a + b)² = a² + 2ab + b²", "a qo'shuv be, kvadrat teng a kvadrat qo'shuv ikki a be qo'shuv be kvadrat"],
    ["S = a · b", "S teng a karra be"],
    ["3y − 7 = 2", "uch igrek minus yetti teng ikki"],
    ["2,5 · 4 = 10", "ikki butun o'ndan besh karra to'rt teng o'n"],
    ["−3 + 8 = 5", "minus uch qo'shuv sakkiz teng besh"],
    ["π ≈ 3,14", "pi taxminan uch butun yuzdan o'n to'rt"],
    ["EKUK(4; 6) = 12", "to'rt va oltining EKUKi teng o'n ikki"],
    ["y = 2x + 1", "igrek teng ikki iks qo'shuv bir"],
  ];
  for (const [f, said] of cases) it(f, () => expect(narrateFormula(f)).toBe(said));
});

describe("narrateBoard / narrateQuestion", () => {
  const el = (id: string, layer: "main" | "note", cmd: Record<string, unknown>) => ({ id, layer, cmd: { id, ...cmd } }) as unknown as BoardEl;
  it("reads main work top → bottom, then the note answer", () => {
    const b = [
      el("c", "note", { op: "write", x: 600, y: 460, text: "6 = 2 · 3" }),
      el("b", "main", { op: "fractionbar", x: 40, y: 160, w: 300, parts: 6, filled: 3 }),
      el("a", "main", { op: "write", x: 40, y: 60, text: "1/2 + 1/3" }),
      el("d", "main", { op: "divider", x: 700 }),
    ];
    expect(narrateBoard(b)).toBe(
      "Doskada: ikkidan bir qo'shuv uchdan bir. kasr chizig'i: olti bo'lakdan uch tasi bo'yalgan, ya'ni oltidan uch. Savolingizga javob: olti teng ikki karra uch.",
    );
  });
  it("empty board says nothing", () => expect(narrateBoard([])).toBe(""));
  it("quiz options are read with their letters", () => {
    expect(narrateQuestion("1/2 + 1/4 = ?", ["3/4", "2/6"])).toBe(
      "ikkidan bir qo'shuv to'rtdan bir nechaga teng? A javob: to'rtdan uch. B javob: oltidan ikki. Harfni ayting, masalan: «javob A».",
    );
  });
});
