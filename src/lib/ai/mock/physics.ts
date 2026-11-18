// FIZIKA demo lesson (grade 7): "Tezlik: v = s / t" — pinned, hand-written, audio pre-cached for
// Blokbek, Lola and Ziyo (scripts/warm-physics.mjs). Same board + tutor engine as the maths lessons.
// Board: the car diagram (body + wheels + motion arrow), the distance line, the formula, units, and
// two worked examples. `say` spells numbers in words and has no symbols (TTS).
import type { LessonSegment } from "../schema";

export const PHYSICS_SPEED: LessonSegment[] = [
  {
    id: "p1",
    type: "explain",
    emotion: "happy",
    say: "Salom! Bugun fizikadan tezlikni o'rganamiz. Mana, mashina yo'lga chiqdi!",
    board: [
      { op: "rect", id: "car", x: 70, y: 80, w: 150, h: 60, color: "blue" },
      { op: "circle", id: "w1", x: 88, y: 132, w: 34, h: 34, color: "ink" },
      { op: "circle", id: "w2", x: 168, y: 132, w: 34, h: 34, color: "ink" },
      { op: "line", id: "dir", from: [250, 110], to: [430, 110], color: "yellow", arrow: true },
      { op: "write", id: "vlab", x: 320, y: 58, text: "v", size: "m", color: "yellow" },
    ],
  },
  {
    id: "p2",
    type: "explain",
    emotion: "neutral",
    say: "Mashina bosib o'tgan yo'l — masofa. Uni s harfi bilan belgilaymiz, kilometrda o'lchaymiz.",
    board: [
      { op: "line", id: "road", from: [70, 205], to: [520, 205], color: "ink" },
      { op: "line", id: "tk1", from: [70, 190], to: [70, 220], color: "ink" },
      { op: "line", id: "tk2", from: [520, 190], to: [520, 220], color: "ink" },
      { op: "write", id: "sdef", x: 80, y: 232, text: "s — masofa (km)", size: "s", color: "blue" },
    ],
  },
  {
    id: "p3",
    type: "explain",
    emotion: "thinking",
    say: "Yo'lga ketgan vaqtni esa t bilan belgilaymiz. Hmm… endi tezlikni qanday topamiz?",
    board: [{ op: "write", id: "tdef", x: 80, y: 282, text: "t — vaqt (soat)", size: "s", color: "red" }],
  },
  {
    id: "p4",
    type: "explain",
    emotion: "excited",
    say: "Mana formula! Tezlik teng masofa bo'lingan vaqtga.",
    board: [
      { op: "latex", id: "formula", x: 80, y: 340, tex: "v = \\frac{s}{t}", size: "l", color: "yellow" },
      { op: "highlight", target: "formula", color: "yellow" },
    ],
  },
  {
    id: "p5",
    type: "explain",
    emotion: "neutral",
    say: "Birliklarni unutmaymiz! Kilometr bo'lingan soat, yoki metr bo'lingan sekund.",
    board: [
      { op: "write", id: "uhead", x: 630, y: 190, text: "Birliklar:", size: "s", color: "ink" },
      { op: "write", id: "u1", x: 630, y: 240, text: "km/soat", size: "m", color: "green" },
      { op: "write", id: "u2", x: 630, y: 310, text: "m/s", size: "m", color: "green" },
    ],
  },
  {
    id: "p6",
    type: "ask",
    emotion: "encouraging",
    say: "Misol! Mashina ikki soatda bir yuz yigirma kilometr yurdi. Uning tezligi necha?",
    board: [
      { op: "write", id: "ex1", x: 80, y: 450, text: "s = 120 km,  t = 2 soat", size: "s", color: "ink" },
      { op: "write", id: "ex1v", x: 80, y: 500, text: "v = 120 : 2 = ?", size: "s", color: "yellow" },
    ],
    expect: { kind: "number", answer: "60", prompt: "v = ? km/soat" },
  },
  {
    id: "p7",
    type: "praise",
    emotion: "excited",
    say: "Zo'r, soatiga oltmish kilometr! Masofani vaqtga bo'ldik.",
    board: [
      { op: "write", id: "ex1a", x: 0, y: 0, place: { rightOf: "ex1v" }, text: "60 km/soat", size: "s", color: "green" },
    ],
  },
  {
    id: "p8",
    type: "ask",
    emotion: "encouraging",
    say: "Endi sen! Velosipedchi uch soatda qirq besh kilometr yurdi. Tezligi necha?",
    board: [
      // the second example goes in the right column under the units; example 1 stays as a model
      { op: "write", id: "ex2", x: 630, y: 390, text: "s = 45 km, t = 3 soat", size: "s", color: "ink" },
      { op: "write", id: "ex2v", x: 630, y: 440, text: "v = 45 : 3 = ?", size: "s", color: "yellow" },
    ],
    expect: { kind: "number", answer: "15", prompt: "v = ? km/soat" },
  },
  {
    id: "p9",
    type: "praise",
    emotion: "happy",
    say: "Barakalla, soatiga o'n besh kilometr! Endi sen tezlikni topa olasan.",
    board: [
      { op: "write", id: "ex2a", x: 0, y: 0, place: { below: "ex2v" }, text: "15 km/soat", size: "s", color: "green" },
    ],
  },
];
