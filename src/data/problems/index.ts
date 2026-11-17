// Parameterised problem generators — one per skill, several templates each,
// so practice never runs out and every answer is checkable with mathjs.
import type { Expect } from "@/lib/ai/schema";
import { SKILLS } from "../skills";

export interface Problem {
  skillId: string;
  /** Uzbek question text (shown + spoken) */
  q: string;
  expect: Expect;
  hint: string;
  /** stable id for logging */
  key: string;
}

export type Rng = () => number;

/** mulberry32 — small seeded RNG so diagnostics/demos are reproducible. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r: Rng, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
export const gcdN = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcdN(b, a % b));
export const lcmN = (a: number, b: number) => Math.abs(a * b) / gcdN(a, b);
const frac = (n: number, d: number) => {
  const g = gcdN(n, d);
  const [a, b] = [n / g, d / g];
  return b === 1 ? `${a}` : `${a}/${b}`;
};
const sign = (n: number) => (n < 0 ? `(${n})` : `${n}`);
const shuffle = <T,>(r: Rng, xs: T[]) => xs.map((x) => [r(), x] as const).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
const num = (answer: number | string, prompt?: string): Expect => ({ kind: "number", answer: String(answer), prompt });
const fr = (answer: string, prompt?: string): Expect => ({ kind: "fraction", answer, prompt });
const choice = (r: Rng, answer: string, wrong: string[]): Expect => ({
  kind: "choice",
  answer,
  choices: shuffle(r, [answer, ...wrong.filter((w) => w !== answer).slice(0, 3)]),
});

type Gen = (r: Rng) => Omit<Problem, "skillId" | "key">;

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

export const GENERATORS: Record<string, Gen[]> = {
  "nat-place-value": [
    (r) => {
      const n = int(r, 1000, 99999);
      const d = String(n);
      const pos = int(r, 0, d.length - 1);
      const names = ["birlar", "o'nlar", "yuzlar", "minglar", "o'n minglar"];
      const place = d.length - 1 - pos;
      return { q: `${n} sonida ${names[place]} xonasida qaysi raqam turibdi?`, expect: num(d[pos]), hint: "O'ngdan sanang: birlar, o'nlar, yuzlar, minglar…" };
    },
    (r) => {
      const t = int(r, 1, 9), h = int(r, 0, 9), o = int(r, 0, 9);
      return { q: `${t} ta ming, ${h} ta yuz va ${o} ta birlikdan iborat sonni yozing.`, expect: num(t * 1000 + h * 100 + o), hint: "Minglar xonasiga, keyin yuzlar, o'nlar (0) va birlar." };
    },
  ],
  "nat-add-sub": [
    (r) => { const a = int(r, 120, 899), b = int(r, 100, 899); return { q: `${a} + ${b} = ?`, expect: num(a + b), hint: "Birlarni birlarga, o'nlarni o'nlarga qo'shing." }; },
    (r) => { const a = int(r, 500, 999), b = int(r, 100, a - 1); return { q: `${a} − ${b} = ?`, expect: num(a - b), hint: "Kerak bo'lsa, katta xonadan bitta qarz oling." }; },
    (r) => { const a = int(r, 30, 90), b = int(r, 10, 40); return { q: `Do'konda ${a} ta olma bor edi. ${b} tasi sotildi. Nechta qoldi?`, expect: num(a - b), hint: "Qolganini topish uchun ayiramiz." }; },
  ],
  "nat-mul": [
    (r) => { const a = int(r, 12, 99), b = int(r, 3, 9); return { q: `${a} · ${b} = ?`, expect: num(a * b), hint: `${a} ni o'nlar va birlarga ajratib, har birini ${b} ga ko'paytiring.` }; },
    (r) => { const a = int(r, 11, 30), b = int(r, 11, 25); return { q: `${a} · ${b} = ?`, expect: num(a * b), hint: "Ustun usulida ko'paytiring." }; },
    (r) => { const a = int(r, 4, 9), b = int(r, 12, 30); return { q: `Bir qatorda ${b} ta stul bor. ${a} qatorda nechta stul bor?`, expect: num(a * b), hint: "Teng guruhlar — ko'paytirish." }; },
  ],
  "nat-div": [
    (r) => { const b = int(r, 3, 9), q = int(r, 12, 99); return { q: `${b * q} : ${b} = ?`, expect: num(q), hint: `Qaysi sonni ${b} ga ko'paytirsak ${b * q} chiqadi?` }; },
    (r) => { const b = int(r, 3, 8), q = int(r, 5, 20); return { q: `${b * q} ta konfetni ${b} bolaga teng bo'lishdi. Har biriga nechta?`, expect: num(q), hint: "Teng bo'lish — bo'lish amali." }; },
  ],
  "nat-order-ops": [
    (r) => { const a = int(r, 2, 20), b = int(r, 2, 9), c = int(r, 2, 9); return { q: `${a} + ${b} · ${c} = ?`, expect: num(a + b * c), hint: "Avval ko'paytirish, keyin qo'shish." }; },
    (r) => { const a = int(r, 2, 9), b = int(r, 2, 9), c = int(r, 2, 5); return { q: `(${a} + ${b}) · ${c} = ?`, expect: num((a + b) * c), hint: "Qavs ichidagi amal birinchi bajariladi." }; },
    (r) => { const b = int(r, 2, 6), q = int(r, 2, 9), a = int(r, 20, 60); return { q: `${a} − ${b * q} : ${b} = ?`, expect: num(a - q), hint: "Bo'lish ayirishdan oldin bajariladi." }; },
  ],
  "nat-powers": [
    (r) => { const a = int(r, 2, 15); return { q: `${a}² = ?`, expect: num(a * a), hint: `${a}² = ${a} · ${a}` }; },
    (r) => { const a = int(r, 2, 6); return { q: `${a}³ = ?`, expect: num(a ** 3), hint: `${a}³ = ${a} · ${a} · ${a}` }; },
  ],
  "div-rules": [
    (r) => { const n = int(r, 10, 99) * 3 + pick(r, [0, 1, 2]); return { q: `${n} soni 3 ga qoldiqsiz bo'linadimi?`, expect: choice(r, n % 3 === 0 ? "Ha" : "Yo'q", ["Ha", "Yo'q"]), hint: "Raqamlari yig'indisi 3 ga bo'linsa, son ham bo'linadi." }; },
    (r) => { const n = int(r, 100, 999); const opts = ["2", "5", "10"]; const ok = opts.filter((d) => n % Number(d) === 0); const ans = ok.length ? ok[ok.length - 1] : "Hech biriga"; return { q: `${n} soni quyidagilardan qaysi biriga bo'linadi (eng kattasi)?`, expect: choice(r, ans, ["2", "5", "10", "Hech biriga"]), hint: "Oxirgi raqamga qarang: 0 → 10 ga, 0 yoki 5 → 5 ga, juft → 2 ga." }; },
  ],
  primes: [
    (r) => { const p = pick(r, PRIMES.slice(3)); const comps = shuffle(r, [21, 27, 33, 35, 39, 49, 51, 57]); return { q: `Qaysi son tub son?`, expect: choice(r, String(p), [String(comps[0]), String(comps[1]), "1"]), hint: "Tub son faqat 1 ga va o'ziga bo'linadi." }; },
    (r) => { const a = pick(r, [2, 3, 5]), b = pick(r, [3, 5, 7]), n = a * b * pick(r, [2, 3]); const big = Math.max(...[2, 3, 5, 7].filter((p) => n % p === 0)); return { q: `${n} sonining eng katta tub bo'luvchisi nechiga teng?`, expect: num(big), hint: "Sonni tub ko'paytuvchilarga ajrating." }; },
  ],
  gcd: [
    (r) => { const g = pick(r, [2, 3, 4, 5, 6]); const a = g * pick(r, [2, 3, 5]), b = g * pick(r, [7, 4, 9]); return { q: `EKUB(${a}; ${b}) = ?`, expect: num(gcdN(a, b)), hint: "Ikkala sonni bo'ladigan eng katta sonni toping." }; },
    (r) => { const g = pick(r, [3, 4, 6, 8]); const a = g * 2, b = g * 3; return { q: `${a} ta qalam va ${b} ta daftarni eng ko'pi bilan nechta bolaga teng bo'lish mumkin?`, expect: num(gcdN(a, b)), hint: "Bu EKUB masalasi." }; },
  ],
  lcm: [
    (r) => { const [a, b] = pick(r, [[2, 3], [3, 4], [4, 6], [2, 5], [6, 8], [3, 5], [4, 5]] as const); return { q: `EKUK(${a}; ${b}) = ?`, expect: num(lcmN(a, b)), hint: `${Math.max(a, b)} ning karralilarini yozib, ${Math.min(a, b)} ga bo'linadiganini toping.` }; },
    (r) => { const [a, b] = pick(r, [[2, 3], [3, 4], [4, 6], [6, 9]] as const); return { q: `Bir avtobus har ${a} daqiqada, ikkinchisi har ${b} daqiqada keladi. Necha daqiqadan keyin ular yana birga keladi?`, expect: num(lcmN(a, b)), hint: "Bu EKUK masalasi." }; },
  ],
  "frac-intro": [
    (r) => { const d = int(r, 3, 8), n = int(r, 1, d - 1); return { q: `Pitsa ${d} ta teng bo'lakka bo'lindi, ${n} tasi yeyildi. Qancha qismi yeyildi? (kasr ko'rinishida)`, expect: fr(`${n}/${d}`), hint: "Surat — olingan bo'laklar, maxraj — jami bo'laklar." }; },
    (r) => { const d = int(r, 3, 9), n = int(r, 1, d - 1); return { q: `${n}/${d} kasrining maxraji nechaga teng?`, expect: num(d), hint: "Maxraj — kasr chizig'ining ostidagi son." }; },
  ],
  "frac-add-like": [
    (r) => { const d = int(r, 5, 12), a = int(r, 1, d - 2), b = int(r, 1, d - 1 - a); return { q: `${a}/${d} + ${b}/${d} = ?`, expect: fr(frac(a + b, d)), hint: "Maxraj bir xil — faqat suratlarni qo'shamiz." }; },
    (r) => { const d = int(r, 5, 12), a = int(r, 3, d - 1), b = int(r, 1, a - 1); return { q: `${a}/${d} − ${b}/${d} = ?`, expect: fr(frac(a - b, d)), hint: "Maxraj o'zgarmaydi, suratlarni ayiramiz." }; },
  ],
  "frac-equivalent": [
    (r) => { const d = int(r, 2, 6), n = int(r, 1, d - 1), k = int(r, 2, 4); return { q: `${n}/${d} = ?/${d * k}`, expect: num(n * k, `${n}/${d} = ?/${d * k}`), hint: `Maxraj ${k} marta oshdi — suratni ham ${k} ga ko'paytiring.` }; },
    (r) => { const d = int(r, 2, 7), n = int(r, 1, d - 1), k = int(r, 2, 5); const g = gcdN(n, d); return { q: `${n * k}/${d * k} kasrini qisqartiring.`, expect: fr(`${n / g}/${d / g}`), hint: "Surat va maxrajni EKUBga bo'ling." }; },
  ],
  "frac-compare": [
    (r) => { const [a, b, c, d] = pick(r, [[1, 2, 2, 3], [3, 4, 2, 3], [2, 5, 1, 3], [3, 8, 1, 2], [5, 6, 7, 9]] as const); const ans = a * d > c * b ? `${a}/${b}` : `${c}/${d}`; return { q: `Qaysi kasr katta: ${a}/${b} yoki ${c}/${d}?`, expect: choice(r, ans, [`${a}/${b}`, `${c}/${d}`]), hint: "Umumiy maxrajga keltirib, suratlarni solishtiring." }; },
  ],
  "frac-add-unlike": [
    (r) => { const [b, d] = pick(r, [[2, 3], [2, 5], [3, 4], [4, 6], [3, 5], [2, 7], [6, 4]] as const); const a = int(r, 1, b - 1), c = int(r, 1, d - 1); return { q: `${a}/${b} + ${c}/${d} = ?`, expect: fr(frac(a * d + c * b, b * d)), hint: `Avval umumiy maxraj: EKUK(${b}; ${d}) = ${lcmN(b, d)}.` }; },
    (r) => { const k = pick(r, [2, 3, 4]); return { q: `1/2 + 1/${2 * k} = ?`, expect: fr(frac(k + 1, 2 * k)), hint: `1/2 ni ${k}/${2 * k} ko'rinishida yozing.` }; },
    () => ({ q: `1/3 = ?/6`, expect: num(2, "1/3 = ?/6"), hint: "Maxraj 2 marta oshdi — surat ham 2 marta oshadi." }),
  ],
  "frac-sub-unlike": [
    (r) => { const [b, d] = pick(r, [[2, 3], [2, 5], [3, 4], [2, 6], [4, 3]] as const); const a = int(r, 1, b - 1), c = int(r, 1, d - 1); const [x, y, u, v] = a / b >= c / d ? [a, b, c, d] : [c, d, a, b]; return { q: `${x}/${y} − ${u}/${v} = ?`, expect: fr(frac(x * v - u * y, y * v)), hint: "Umumiy maxrajga keltiring, so'ng suratlarni ayiring." }; },
  ],
  "frac-mixed": [
    (r) => { const w = int(r, 1, 4), d = int(r, 2, 6), n = int(r, 1, d - 1); return { q: `${w} butun ${n}/${d} ni noto'g'ri kasr ko'rinishida yozing.`, expect: fr(`${w * d + n}/${d}`), hint: `Butun qismni maxrajga ko'paytirib, suratga qo'shing: ${w}·${d} + ${n}.` }; },
    (r) => { const d = int(r, 2, 5), w = int(r, 1, 3), n = int(r, 1, d - 1); return { q: `${w * d + n}/${d} kasrida butun qism nechaga teng?`, expect: num(w), hint: `${w * d + n} ni ${d} ga bo'ling.` }; },
  ],
  "frac-mul": [
    (r) => { const a = int(r, 1, 5), b = int(r, 2, 7), c = int(r, 1, 5), d = int(r, 2, 7); return { q: `${a}/${b} · ${c}/${d} = ?`, expect: fr(frac(a * c, b * d)), hint: "Suratni suratga, maxrajni maxrajga ko'paytiring." }; },
    (r) => { const d = int(r, 2, 6), n = int(r, 1, d - 1), k = d * int(r, 2, 6); return { q: `${k} ning ${n}/${d} qismi nechaga teng?`, expect: num((k / d) * n), hint: `${k} ni ${d} ga bo'lib, ${n} ga ko'paytiring.` }; },
  ],
  "frac-div": [
    (r) => { const a = int(r, 1, 5), b = int(r, 2, 7), c = int(r, 1, 5), d = int(r, 2, 7); return { q: `${a}/${b} : ${c}/${d} = ?`, expect: fr(frac(a * d, b * c)), hint: "Ikkinchi kasrni teskarisiga almashtirib, ko'paytiring." }; },
  ],
  "dec-intro": [
    (r) => { const n = int(r, 1, 99); return { q: `${n}/100 ni o'nli kasr ko'rinishida yozing.`, expect: num(n / 100), hint: "Yuzdan birlar — verguldan keyin ikkita raqam." }; },
    (r) => { const a = int(r, 1, 9), b = int(r, 1, 9); return { q: `${a},${b} sonida o'ndan birlar xonasida qaysi raqam?`, expect: num(b), hint: "Verguldan keyingi birinchi raqam — o'ndan birlar." }; },
  ],
  "dec-add-sub": [
    (r) => { const a = int(r, 11, 99) / 10, b = int(r, 11, 99) / 10; return { q: `${String(a).replace(".", ",")} + ${String(b).replace(".", ",")} = ?`, expect: num(Math.round((a + b) * 10) / 10), hint: "Vergulni vergul ostiga yozib qo'shing." }; },
    (r) => { const a = int(r, 50, 99) / 10, b = int(r, 11, 49) / 10; return { q: `${String(a).replace(".", ",")} − ${String(b).replace(".", ",")} = ?`, expect: num(Math.round((a - b) * 10) / 10), hint: "Vergulni vergul ostiga yozib ayiring." }; },
  ],
  "dec-mul-div": [
    (r) => { const a = int(r, 11, 49) / 10, b = int(r, 2, 9); return { q: `${String(a).replace(".", ",")} · ${b} = ?`, expect: num(Math.round(a * b * 10) / 10), hint: "Natural sonlardek ko'paytirib, vergulni bitta xona chapga qo'ying." }; },
    (r) => { const a = int(r, 2, 9) * 10 + int(r, 1, 9), k = pick(r, [10, 100]); return { q: `${a} : ${k} = ?`, expect: num(a / k), hint: `${k} ga bo'lganda vergul ${k === 10 ? "bitta" : "ikkita"} xona chapga suriladi.` }; },
  ],
  "frac-to-dec": [
    (r) => { const [n, d] = pick(r, [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [1, 10], [7, 20]] as const); return { q: `${n}/${d} ni o'nli kasrga aylantiring.`, expect: num(n / d), hint: "Maxrajni 10 yoki 100 ga keltiring yoki suratni maxrajga bo'ling." }; },
  ],
  "pct-intro": [
    (r) => { const p = pick(r, [10, 20, 25, 50, 75]); return { q: `${p}% ni oddiy kasr ko'rinishida yozing (qisqartirib).`, expect: fr(frac(p, 100)), hint: "Foiz — yuzdan bir qism: p% = p/100." }; },
    (r) => { const p = int(r, 1, 99); return { q: `${p}% ni o'nli kasr ko'rinishida yozing.`, expect: num(p / 100), hint: "100 ga bo'ling." }; },
  ],
  "pct-of-number": [
    (r) => { const p = pick(r, [10, 20, 25, 50]), n = pick(r, [40, 80, 120, 200, 360]); return { q: `${n} ning ${p}% i nechaga teng?`, expect: num((n * p) / 100), hint: `${n} · ${p} : 100` }; },
    (r) => { const p = pick(r, [10, 20, 30]), n = pick(r, [50000, 80000, 120000]); return { q: `${n} so'mlik ko'ylakka ${p}% chegirma. Chegirma necha so'm?`, expect: num((n * p) / 100), hint: "Sonning foizini toping." }; },
  ],
  "pct-find-whole": [
    (r) => { const p = pick(r, [10, 20, 25, 50]), whole = pick(r, [40, 80, 120, 200]); return { q: `Sonning ${p}% i ${(whole * p) / 100} ga teng. Sonni toping.`, expect: num(whole), hint: `${(whole * p) / 100} : ${p} · 100` }; },
  ],
  ratio: [
    (r) => { const a = int(r, 2, 5), b = int(r, 2, 5), k = int(r, 2, 6); return { q: `${a} : ${b} = ${a * k} : x. x = ?`, expect: num(b * k), hint: "Proporsiyaning chetki hadlari ko'paytmasi o'rta hadlar ko'paytmasiga teng." }; },
    (r) => { const a = int(r, 2, 5), k = int(r, 3, 8); return { q: `${a} ta daftar ${a * k * 1000} so'm. ${a + 2} ta daftar necha so'm?`, expect: num((a + 2) * k * 1000), hint: "Avval bitta daftar narxini toping." }; },
  ],
  "int-intro": [
    (r) => { const a = -int(r, 1, 9), b = int(r, -9, 9); const ans = Math.max(a, b); return { q: `Qaysi son katta: ${a} yoki ${b}?`, expect: choice(r, String(ans), [String(a), String(b)]), hint: "Son o'qida o'ngdagi son katta." }; },
    (r) => { const t = int(r, 2, 9), d = int(r, 3, 12); return { q: `Ertalab harorat ${t}° edi, kechqurun ${d}° ga pasaydi. Kechqurun necha gradus?`, expect: num(t - d), hint: "Son o'qida chapga yuring." }; },
  ],
  "int-add-sub": [
    (r) => { const a = int(r, -15, 15), b = int(r, -15, -1); return { q: `${a} + ${sign(b)} = ?`, expect: num(a + b), hint: "Manfiy sonni qo'shish — ayirish bilan bir xil." }; },
    (r) => { const a = int(r, -10, 10), b = int(r, -10, 10); return { q: `${a} − ${sign(b)} = ?`, expect: num(a - b), hint: "Ayirishni qarama-qarshi sonni qo'shish bilan almashtiring." }; },
  ],
  "int-mul-div": [
    (r) => { const a = int(r, -9, -2), b = int(r, -9, 9); return { q: `${a} · ${sign(b)} = ?`, expect: num(a * b), hint: "Ishoralar bir xil — musbat, har xil — manfiy." }; },
    (r) => { const b = int(r, -9, -2), q = int(r, -9, 9); return { q: `${b * q} : ${sign(b)} = ?`, expect: num(q), hint: "Ishora qoidasi bo'lishda ham xuddi shunday." }; },
  ],
  "expr-eval": [
    (r) => { const a = int(r, 2, 9), b = int(r, 1, 9), x = int(r, -5, 6); return { q: `x = ${x} bo'lsa, ${a}x + ${b} ifodaning qiymati nechaga teng?`, expect: num(a * x + b), hint: `x o'rniga ${sign(x)} qo'ying.` }; },
    (r) => { const a = int(r, 1, 6), b = int(r, 1, 6); return { q: `a = ${a}, b = ${b} bo'lsa, a² + 2b = ?`, expect: num(a * a + 2 * b), hint: "Avval daraja, keyin ko'paytirish, oxirida qo'shish." }; },
  ],
  "expr-like-terms": [
    (r) => { const a = int(r, 2, 9), b = int(r, 2, 9), c = int(r, 1, 9); return { q: `Ixchamlang: ${a}x + ${b}x + ${c}`, expect: { kind: "expression", answer: `${a + b}x + ${c}` }, hint: "x li hadlarni alohida qo'shing." }; },
    (r) => { const a = int(r, 5, 12), b = int(r, 1, 4); return { q: `Ixchamlang: ${a}y − ${b}y`, expect: { kind: "expression", answer: `${a - b}y` }, hint: "Koeffitsientlarni ayiring." }; },
  ],
  "expr-distribute": [
    (r) => { const a = int(r, 2, 6), b = int(r, 1, 9); return { q: `Qavsni oching: ${a}(x + ${b})`, expect: { kind: "expression", answer: `${a}x + ${a * b}` }, hint: "Qavs oldidagi sonni har bir hadga ko'paytiring." }; },
    (r) => { const a = int(r, 2, 5), b = int(r, 1, 6); return { q: `Qavsni oching: −${a}(x − ${b})`, expect: { kind: "expression", answer: `-${a}x + ${a * b}` }, hint: "Manfiy songa ko'paytirganda ishoralar o'zgaradi." }; },
  ],
  "eq-one-step": [
    (r) => { const x = int(r, 2, 20), b = int(r, 2, 30); return { q: `x + ${b} = ${x + b}. x = ?`, expect: num(x), hint: `Ikkala tomondan ${b} ni ayiring.` }; },
    (r) => { const x = int(r, 2, 12), a = int(r, 2, 9); return { q: `${a}x = ${a * x}. x = ?`, expect: num(x), hint: `Ikkala tomonni ${a} ga bo'ling.` }; },
  ],
  "eq-two-step": [
    (r) => { const x = int(r, 1, 9), a = int(r, 2, 6), b = int(r, 1, 12); return { q: `${a}x + ${b} = ${a * x + b}. x = ?`, expect: num(x), hint: `Avval ${b} ni ayiring, keyin ${a} ga bo'ling.` }; },
    (r) => { const x = int(r, 2, 9), a = int(r, 2, 5), b = int(r, 1, 9); return { q: `${a}x − ${b} = ${a * x - b}. x = ?`, expect: num(x), hint: `Avval ikkala tomonga ${b} ni qo'shing.` }; },
  ],
  "eq-both-sides": [
    (r) => { const x = int(r, 1, 8), a = int(r, 4, 8), c = int(r, 1, a - 1), b = int(r, 1, 9); const d = a * x + b - c * x; return { q: `${a}x + ${b} = ${c}x + ${d}. x = ?`, expect: num(x), hint: "x li hadlarni bir tomonga, sonlarni ikkinchi tomonga o'tkazing." }; },
  ],
  "eq-word": [
    (r) => { const x = int(r, 3, 15), k = int(r, 2, 4); return { q: `Akamning yoshi mening yoshimdan ${k} marta katta. Ikkalamizniki ${x * (k + 1)} yosh. Men necha yoshdaman?`, expect: num(x), hint: `Mening yoshim x bo'lsin: x + ${k}x = ${x * (k + 1)}.` }; },
    (r) => { const p = int(r, 2, 6) * 1000, n = int(r, 2, 5), extra = int(r, 1, 5) * 1000; return { q: `${n} ta daftar va ${extra} so'mlik ruchka jami ${n * p + extra} so'm. Bitta daftar necha so'm?`, expect: num(p), hint: `${n}x + ${extra} = ${n * p + extra}` }; },
  ],
  "eq-system": [
    (r) => { const x = int(r, 1, 9), y = int(r, 1, 9); return { q: `x + y = ${x + y}, x − y = ${x - y}. x = ?`, expect: num(x), hint: "Ikkala tenglamani qo'shing: 2x = ?" }; },
  ],
  "geo-perimeter": [
    (r) => { const a = int(r, 3, 20), b = int(r, 3, 20); return { q: `Tomonlari ${a} sm va ${b} sm bo'lgan to'g'ri to'rtburchakning perimetri necha sm?`, expect: num(2 * (a + b)), hint: "P = 2 · (a + b)" }; },
    (r) => { const a = int(r, 3, 25); return { q: `Tomoni ${a} sm bo'lgan kvadratning perimetri necha sm?`, expect: num(4 * a), hint: "P = 4 · a" }; },
  ],
  "geo-area-rect": [
    (r) => { const a = int(r, 2, 15), b = int(r, 2, 12); return { q: `Bo'yi ${a} m, eni ${b} m bo'lgan xonaning yuzi necha m²?`, expect: num(a * b), hint: "S = a · b" }; },
    (r) => { const a = int(r, 3, 9), s = a * int(r, 2, 9); return { q: `To'g'ri to'rtburchak yuzi ${s} sm², bo'yi ${a} sm. Eni necha sm?`, expect: num(s / a), hint: "b = S : a" }; },
  ],
  "geo-area-triangle": [
    (r) => { const a = int(r, 2, 12) * 2, h = int(r, 2, 10); return { q: `Asosi ${a} sm, balandligi ${h} sm bo'lgan uchburchak yuzi necha sm²?`, expect: num((a * h) / 2), hint: "S = a · h : 2" }; },
  ],
  "geo-circle": [
    (r) => { const rad = int(r, 2, 10); return { q: `Radiusi ${rad} sm bo'lgan aylana uzunligini toping (π ≈ 3,14).`, expect: num(Math.round(2 * 3.14 * rad * 100) / 100), hint: "C = 2πr" }; },
    (r) => { const rad = int(r, 2, 6); return { q: `Radiusi ${rad} sm bo'lgan doira yuzini toping (π ≈ 3,14).`, expect: num(Math.round(3.14 * rad * rad * 100) / 100), hint: "S = πr²" }; },
  ],
  "geo-pythagoras": [
    (r) => { const [a, b, c] = pick(r, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17]] as const); return { q: `To'g'ri burchakli uchburchakning katetlari ${a} va ${b}. Gipotenuzani toping.`, expect: num(c), hint: "c² = a² + b²" }; },
  ],
  "coord-plane": [
    (r) => { const x = int(r, -6, 6), y = int(r, -6, 6); return { q: `A(${x}; ${y}) nuqtaning abssissasi nechaga teng?`, expect: num(x), hint: "Abssissa — birinchi koordinata (x)." }; },
    (r) => { const x = int(r, 1, 6) * pick(r, [1, -1]), y = int(r, 1, 6) * pick(r, [1, -1]); const q = x > 0 ? (y > 0 ? "I" : "IV") : y > 0 ? "II" : "III"; return { q: `A(${x}; ${y}) nuqta qaysi chorakda yotadi?`, expect: choice(r, q, ["I", "II", "III", "IV"]), hint: "I chorak: x>0, y>0; soat strelkasiga teskari sanaladi." }; },
  ],
  "lin-func": [
    (r) => { const k = int(r, -4, 5) || 2, b = int(r, -6, 6), x = int(r, -3, 4); return { q: `y = ${k}x ${b < 0 ? "−" : "+"} ${Math.abs(b)} funksiyada x = ${x} bo'lsa, y = ?`, expect: num(k * x + b), hint: "x o'rniga sonni qo'yib hisoblang." }; },
  ],
  "lin-graph": [
    (r) => { const k = int(r, 1, 4), b = int(r, -5, 5); return { q: `y = ${k}x ${b < 0 ? "−" : "+"} ${Math.abs(b)} grafigi y o'qini qaysi nuqtada kesadi? (y ni yozing)`, expect: num(b), hint: "y o'qida x = 0." }; },
    (r) => { const k = int(r, -4, 4) || 3, b = int(r, -5, 5); return { q: `y = ${k}x ${b < 0 ? "−" : "+"} ${Math.abs(b)} to'g'ri chiziqning burchak koeffitsienti nechaga teng?`, expect: num(k), hint: "y = kx + b da k — burchak koeffitsienti." }; },
  ],
  "quad-func": [
    (r) => { const x = int(r, -6, 6); return { q: `y = x² funksiyada x = ${x} bo'lsa, y = ?`, expect: num(x * x), hint: "Manfiy sonning kvadrati musbat." }; },
  ],
};

let counter = 0;

/** Generate one problem for a skill. Falls back to a simple arithmetic problem. */
export function generateProblem(skillId: string, rng: Rng = Math.random): Problem {
  const gens = GENERATORS[skillId] ?? GENERATORS["nat-add-sub"];
  const g = gens[Math.floor(rng() * gens.length)];
  const p = g(rng);
  return { ...p, skillId, key: `${skillId}#${++counter}` };
}

/** Every skill must have a generator (checked in tests). */
export function missingGenerators(): string[] {
  return SKILLS.filter((s) => !GENERATORS[s.id]?.length).map((s) => s.id);
}
