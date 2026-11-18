// FIZIKA (7-sinf) question bank for the games module (O'yinlar, branch feat/games).
// Two shapes:
//  - PHYSICS_QUESTIONS: plain { id, skillId, question, choices, answer, hint } (answer ∈ choices);
//  - PHYSICS_BANK: the games' `Bank` shape (skillId → generators returning { q, hint, expect }), so
//    `buildRound(..., { bank: PHYSICS_BANK })` can use it as is. expect.kind = "choice" (checked as text).
// Hand-written and checked: g = 10 N/kg (school convention), whole numbers, units on every answer.
import type { Expect } from "@/lib/ai/schema";
import type { Rng } from "./problems";
import { PHYSICS_SKILLS } from "./skills";

export interface BankQuestion {
  id: string;
  skillId: string;
  question: string;
  choices: string[];
  answer: string;
  hint: string;
}

const Q = (skillId: string, n: number, question: string, answer: string, wrong: string[], hint: string): BankQuestion => ({
  id: `${skillId}#${n}`,
  skillId,
  question,
  choices: [answer, ...wrong],
  answer,
  hint,
});

export const PHYSICS_QUESTIONS: BankQuestion[] = [
  // Harakat
  Q("fiz-masofa-vaqt", 1, "Velosipedchi soatiga 12 km yuradi. 3 soatda qancha yo'l bosadi?", "36 km", ["15 km", "4 km", "24 km"], "s = v · t"),
  Q("fiz-masofa-vaqt", 2, "Piyoda 10 km yo'lni soatiga 5 km tezlikda bosdi. Necha soat yurdi?", "2 soat", ["5 soat", "50 soat", "15 soat"], "t = s : v"),
  Q("fiz-masofa-vaqt", 3, "1 soatda necha minut bor?", "60 minut", ["100 minut", "30 minut", "24 minut"], "1 soat = 60 minut"),
  Q("fiz-tezlik", 1, "Mashina 2 soatda 120 km yurdi. Uning tezligi qancha?", "60 km/soat", ["240 km/soat", "122 km/soat", "30 km/soat"], "v = s : t"),
  Q("fiz-tezlik", 2, "Velosipedchi 3 soatda 45 km yurdi. Tezligi qancha?", "15 km/soat", ["135 km/soat", "48 km/soat", "5 km/soat"], "v = s : t"),
  Q("fiz-tezlik", 3, "Tezlik formulasi qaysi?", "v = s / t", ["v = s · t", "v = t / s", "v = s + t"], "tezlik = masofa : vaqt"),
  Q("fiz-ortacha-tezlik", 1, "Avtobus 1 soatda 50 km, keyingi 1 soatda 70 km yurdi. O'rtacha tezligi?", "60 km/soat", ["120 km/soat", "70 km/soat", "20 km/soat"], "butun yo'l : butun vaqt"),
  Q("fiz-ortacha-tezlik", 2, "Poyezd 4 soatda 320 km yurdi. O'rtacha tezligi?", "80 km/soat", ["1280 km/soat", "324 km/soat", "40 km/soat"], "v = s : t"),
  Q("fiz-ortacha-tezlik", 3, "Bola 2 soatda 6 km, keyin 1 soatda 3 km yurdi. O'rtacha tezligi?", "3 km/soat", ["9 km/soat", "4,5 km/soat", "6 km/soat"], "(6 + 3) : (2 + 1)"),
  // Modda va massa
  Q("fiz-massa", 1, "Massa qaysi birlikda o'lchanadi?", "kilogramm", ["nyuton", "metr", "sekund"], "massa — kg"),
  Q("fiz-massa", 2, "1 kg necha grammga teng?", "1000 g", ["100 g", "10 g", "10 000 g"], "kilo = 1000"),
  Q("fiz-massa", 3, "Massa nimani o'lchaydi?", "jismning inertligini", ["jismning tezligini", "jismning haroratini", "jismning uzunligini"], "massa katta — jismni qo'zg'atish qiyin"),
  Q("fiz-zichlik", 1, "Massasi 20 kg, hajmi 0,01 m³ bo'lgan jismning zichligi?", "2000 kg/m³", ["0,2 kg/m³", "200 kg/m³", "20 000 kg/m³"], "ρ = m : V"),
  Q("fiz-zichlik", 2, "Zichlik formulasi qaysi?", "ρ = m / V", ["ρ = m · V", "ρ = V / m", "ρ = m + V"], "zichlik = massa : hajm"),
  Q("fiz-zichlik", 3, "Suvning zichligi qancha?", "1000 kg/m³", ["100 kg/m³", "1 kg/m³", "10 000 kg/m³"], "1 litr suv = 1 kg"),
  // Kuch va bosim
  Q("fiz-kuch", 1, "Kuch qaysi birlikda o'lchanadi?", "nyuton (N)", ["kilogramm", "joul", "vatt"], "kuch — N"),
  Q("fiz-kuch", 2, "Massasi 5 kg jismning og'irlik kuchi qancha? (g = 10 N/kg)", "50 N", ["5 N", "0,5 N", "15 N"], "F = m · g"),
  Q("fiz-kuch", 3, "Og'irlik kuchi formulasi qaysi?", "F = m · g", ["F = m / g", "F = m + g", "F = g / m"], "massa karra g"),
  Q("fiz-bosim", 1, "100 N kuch 2 m² yuzaga ta'sir qiladi. Bosim qancha?", "50 Pa", ["200 Pa", "102 Pa", "98 Pa"], "p = F : S"),
  Q("fiz-bosim", 2, "Bosim formulasi qaysi?", "p = F / S", ["p = F · S", "p = S / F", "p = F + S"], "bosim = kuch : yuza"),
  Q("fiz-bosim", 3, "Nega o'tkir pichoq yaxshi kesadi?", "yuza kichik — bosim katta", ["yuza katta — bosim katta", "kuch kamayadi", "massa ortadi"], "p = F : S, S kichik bo'lsa p katta"),
  // Ish va quvvat
  Q("fiz-ish", 1, "20 N kuch jismni 5 m siljitdi. Bajarilgan ish?", "100 J", ["4 J", "25 J", "15 J"], "A = F · s"),
  Q("fiz-ish", 2, "Ish qaysi birlikda o'lchanadi?", "joul (J)", ["vatt", "nyuton", "paskal"], "ish — J"),
  Q("fiz-ish", 3, "Mexanik ish formulasi qaysi?", "A = F · s", ["A = F / s", "A = F + s", "A = s / F"], "kuch karra yo'l"),
  Q("fiz-quvvat", 1, "10 sekundda 500 J ish bajarildi. Quvvat qancha?", "50 Vt", ["5000 Vt", "510 Vt", "5 Vt"], "N = A : t"),
  Q("fiz-quvvat", 2, "Quvvat qaysi birlikda o'lchanadi?", "vatt (Vt)", ["joul", "nyuton", "kilogramm"], "quvvat — Vt"),
  Q("fiz-quvvat", 3, "Quvvat formulasi qaysi?", "N = A / t", ["N = A · t", "N = t / A", "N = A + t"], "quvvat = ish : vaqt"),
];

/** the games' Bank shape: skillId → generators (each returns one of that skill's questions, choices shuffled) */
export type PhysicsGen = (r: Rng) => { q: string; hint: string; expect: Expect };

function shuffled<T>(r: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const PHYSICS_BANK: Record<string, PhysicsGen[]> = Object.fromEntries(
  PHYSICS_SKILLS.map((s) => [
    s.id,
    PHYSICS_QUESTIONS.filter((q) => q.skillId === s.id).map(
      (q): PhysicsGen =>
        (r) => ({ q: q.question, hint: q.hint, expect: { kind: "choice", answer: q.answer, choices: shuffled(r, q.choices) } }),
    ),
  ]),
);
