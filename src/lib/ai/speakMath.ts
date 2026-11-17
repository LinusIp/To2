// Turn written maths into spoken Uzbek for TTS: "1/2 + 1/4 = ?" → "ikkidan bir qo'shuv to'rtdan bir
// nechaga teng?". The screen keeps the written form; only the voice gets this. Pure + tested.

const ONES = ["nol", "bir", "ikki", "uch", "to'rt", "besh", "olti", "yetti", "sakkiz", "to'qqiz"];
const TENS = ["", "o'n", "yigirma", "o'ttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "to'qson"];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} yuz`);
  if (t) parts.push(TENS[t]);
  if (o) parts.push(ONES[o]);
  return parts.join(" ");
}

/** 0 … 999 999 999 999 as Uzbek words ("1090" → "bir ming to'qson"). */
export function numberWords(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `minus ${numberWords(-n)}`;
  n = Math.floor(n);
  if (n === 0) return ONES[0];
  const parts: string[] = [];
  for (const [size, name] of [
    [1e9, "milliard"],
    [1e6, "million"],
    [1e3, "ming"],
  ] as const) {
    if (n >= size) {
      parts.push(`${below1000(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}

const w = (s: string) => numberWords(Number(s));

export function speakMath(input: string): string {
  let s = ` ${input} `;
  // "… = ?" at the end → "… nechaga teng?"
  s = s.replace(/\s*=\s*\?\s*$/, " nechaga teng? ");
  s = s.replace(/\bx\s*=\s*\?/g, "iks nechaga teng?");
  // EKUB(6; 8) → "olti va sakkizning EKUBi"
  s = s.replace(/(EKU[BK])\s*\(\s*(\d+)\s*;\s*(\d+)\s*\)/g, (_, f, a, b) => `${w(a)} va ${w(b)}ning ${f}i`);
  // fractions (maxraj first in Uzbek): 3/4 → "to'rtdan uch", ?/6 → "oltidan necha"
  s = s.replace(/(\d+|\?)\s*\/\s*(\d+)/g, (_, a, b) => `${w(b)}dan ${a === "?" ? "necha" : w(a)}`);
  // decimal comma: 2,5 → "ikki butun o'ndan besh"; 0,25 → "nol butun yuzdan yigirma besh"
  s = s.replace(/(\d+),(\d+)/g, (_, a, b) => `${w(a)} butun ${numberWords(10 ** b.length)}dan ${w(b)}`.replace("bir yuzdan", "yuzdan").replace("bir mingdan", "mingdan"));
  // percent: "20% i" → "yigirma foizi", "20%" → "yigirma foiz"
  s = s.replace(/(\d+)\s*%\s*i\b/g, (_, n) => `${w(n)} foizi`);
  s = s.replace(/(\d+)\s*%\s+(ni|ga|ning|dan)\b/g, (_, n, suf) => `${w(n)} foiz${suf}`);
  s = s.replace(/(\d+)\s*%/g, (_, n) => `${w(n)} foiz`);
  // powers, degrees
  s = s.replace(/(\d+)²/g, (_, n) => `${w(n)} kvadrat`).replace(/(\d+)³/g, (_, n) => `${w(n)} kub`);
  s = s.replace(/°\s*(ga|dan|da)\b/g, " gradus$1").replace(/°/g, " gradus");
  // negatives: "−5", "(-3)"
  s = s.replace(/(^|[\s(])[−-](\d)/g, "$1minus $2"); // a binary minus has spaces around it
  // variable x: "8x" → "sakkiz iks", lone "x" → "iks"
  s = s.replace(/(\d+)\s*x\b/g, (_, n) => `${w(n)} iks`);
  s = s.replace(/(^|[\s(])x(?=[\s.,?)]|$)/g, "$1iks");
  // operators
  s = s.replace(/\s*\+\s*/g, " qo'shuv ");
  s = s.replace(/\s+[−-]\s+/g, " ayiruv ");
  s = s.replace(/\s*[·×*]\s*/g, " karra ");
  s = s.replace(/\s+[:÷]\s+/g, " bo'linadi ");
  s = s.replace(/\s*=\s*/g, " teng ");
  // brackets → spoken as a short pause
  s = s.replace(/\(/g, ", ").replace(/\)/g, ",");
  // numbers with a suffix written apart: "56 ga" → "ellik oltiga", "80 ning" → "saksonning"
  s = s.replace(/(\d+) (ning|ni|ga|da|dan)\b/g, (_, n, suf) => `${w(n)}${suf}`);
  s = s.replace(/\d+/g, (n) => w(n));
  return s
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*([.?!])/g, "$1")
    .replace(/^[\s,]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
