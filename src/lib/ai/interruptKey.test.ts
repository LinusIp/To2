// Bug 4: "whatever I ask, the same answer". The cache key must tell different questions apart and
// treat the same question with different punctuation/case as one.
import { describe, expect, it } from "vitest";
import { interruptKey } from "./interruptKey";

const key = (question: string, step = 3) => interruptKey({ skillId: "lcm", characterId: "ziyo", simpler: false, step, question });

describe("interrupt cache key", () => {
  it("10 different questions → 10 different keys", async () => {
    const qs = [
      "Nega 12?",
      "Nega 6?",
      "EKUK nima uchun kerak?",
      "4 va 6 ning EKUKi nechchi?",
      "Karrali nima degani?",
      "Nega eng kichigini olamiz?",
      "o'n ikki qayerdan chiqdi?",
      "on ikki qayerdan chiqdi?",
      "EKUB nima?",
      "Nega uchga ko'paytirdik?",
    ];
    const keys = await Promise.all(qs.map((q) => key(q)));
    expect(new Set(keys).size).toBe(10);
  });

  it("same question, different punctuation / case / apostrophe → the same key", async () => {
    const variants = ["Nega o'n ikki?", "nega O‘N IKKI", "  Nega   oʻn ikki?! ", "Nega o’n ikki…"];
    const keys = await Promise.all(variants.map((q) => key(q)));
    expect(new Set(keys).size).toBe(1);
  });

  it("the same question at another lesson step → another key (answers are per step)", async () => {
    expect(await key("Nega 12?", 2)).not.toBe(await key("Nega 12?", 5));
  });
});
