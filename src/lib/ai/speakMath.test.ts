import { describe, expect, it } from "vitest";
import { numberWords, speakMath } from "./speakMath";

describe("numberWords", () => {
  it.each([
    [0, "nol"],
    [7, "yetti"],
    [10, "o'n"],
    [11, "o'n bir"],
    [56, "ellik olti"],
    [100, "bir yuz"],
    [448, "to'rt yuz qirq sakkiz"],
    [1090, "bir ming to'qson"],
    [8001, "sakkiz ming bir"],
    [250000, "ikki yuz ellik ming"],
    [-3, "minus uch"],
  ])("%i → %s", (n, s) => expect(numberWords(n)).toBe(s));
});

describe("speakMath (diagnostic questions as the generator writes them)", () => {
  it.each([
    ["1/2 + 1/4 = ?", "ikkidan bir qo'shuv to'rtdan bir nechaga teng?"],
    ["10/20 kasrini qisqartiring.", "yigirmadan o'n kasrini qisqartiring."],
    ["EKUB(6; 8) = ?", "olti va sakkizning EKUBi nechaga teng?"],
    ["8x = 56. x = ?", "sakkiz iks teng ellik olti. iks nechaga teng?"],
    ["448 + 642 = ?", "to'rt yuz qirq sakkiz qo'shuv olti yuz qirq ikki nechaga teng?"],
    ["80 ning 20% i nechaga teng?", "saksonning yigirma foizi nechaga teng?"],
    ["20% ni oddiy kasr ko'rinishida yozing (qisqartirib).", "yigirma foizni oddiy kasr ko'rinishida yozing, qisqartirib."],
    ["1/3 = ?/6", "uchdan bir teng oltidan necha"],
    ["2,5 + 1,25 = ?", "ikki butun o'ndan besh qo'shuv bir butun yuzdan yigirma besh nechaga teng?"],
    ["(3 + 4) · 2 = ?", "uch qo'shuv to'rt, karra ikki nechaga teng?"],
    ["5² = ?", "besh kvadrat nechaga teng?"],
    ["−7 + 3 = ?", "minus yetti qo'shuv uch nechaga teng?"],
    ["12 − 5 = ?", "o'n ikki ayiruv besh nechaga teng?"],
    ["24 : 6 = ?", "yigirma to'rt bo'linadi olti nechaga teng?"],
    ["Ertalab harorat -3° edi", "Ertalab harorat minus uch gradus edi"],
    ["kechqurun 3° ga pasaydi", "kechqurun uch gradusga pasaydi"],
    ["x = 2 bo'lsa, 3x + 1 ifodaning qiymati nechaga teng?", "iks teng ikki bo'lsa, uch iks qo'shuv bir ifodaning qiymati nechaga teng?"],
  ])("%s", (q, s) => expect(speakMath(q)).toBe(s));

  it("leaves no digits or maths symbols for the voice", () => {
    for (const q of ["3/4 · 2/5 = ?", "45 : 5 = 9 : x. x = ?", "Sonning 25% i 30 ga teng. Sonni toping.", "1 butun 2/3 ni noto'g'ri kasr ko'rinishida yozing."])
      expect(speakMath(q)).not.toMatch(/[0-9+=/%·×*÷²³°−]/);
  });
});
