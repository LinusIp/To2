// Hands-free voice commands (motor mode, and voice answers in voice-first mode). Pure + tested
// (commands.test.ts). Works on what STT / the browser recogniser writes: any case, with or without
// apostrophes ("to'xta" / "toxta"), with extra polite words ("iltimos davom eting").
import { normalizeQuestion } from "@/lib/ai/pinned";

export type Letter = "A" | "B" | "C" | "D";
export type VoiceCommand =
  | { type: "continue" }
  | { type: "repeat" }
  | { type: "slower" }
  | { type: "faster" }
  | { type: "confused" }
  | { type: "answer"; letter: Letter; /** 0-based: "javob bir" / "A" → 0 */ index: number }
  | { type: "home" }
  | { type: "read" }
  | { type: "stop" }
  // the town (roadmap world) and the games — sent as "to2:voice" window events (bus.ts)
  | { type: "nextBuilding" }
  | { type: "prevBuilding" }
  | { type: "open" }
  | { type: "back" }
  /** Juftini top: "karta besh" / "karta 12" → card n */
  | { type: "card"; n: number };

/** How the letters are said / misheard in Uzbek: A "a", B "be", C "se/si/ce", D "de/di" */
const LETTER_WORDS: Record<string, Letter> = {
  a: "A", aa: "A", ey: "A",
  b: "B", be: "B", bi: "B", bee: "B",
  c: "C", s: "C", se: "C", si: "C", ce: "C", sse: "C",
  d: "D", de: "D", di: "D", dee: "D",
};
const ORDINALS: Record<string, Letter> = {
  birinchi: "A", birinchisi: "A",
  ikkinchi: "B", ikkinchisi: "B",
  uchinchi: "C", uchinchisi: "C",
  tortinchi: "D", tortinchisi: "D",
};
/** "javob bir/ikki/uch/to'rt" (and digits) — numbers count as answers only next to an answer word */
const CARDINALS: Record<string, Letter> = { bir: "A", "1": "A", ikki: "B", "2": "B", uch: "C", "3": "C", tort: "D", "4": "D" };
/** words that make a bare letter an answer ("javob B", "B variant", "B ni tanlayman") */
const ANSWER_WORDS = ["javob", "variant", "tanlayman", "tanladim", "tanla", "belgila"];
/** filler words allowed around a lone letter */
const FILLER = new Set(["iltimos", "menimcha", "bu", "shu", "ni", "deb", "o", "ha", "ustoz", "mening", "men", "javobim"]);

/** Uzbek number words 1–20 ("o'n ikki" → 12; apostrophes already dropped by words()) */
const UNITS: Record<string, number> = { bir: 1, ikki: 2, uch: 3, tort: 4, besh: 5, olti: 6, yetti: 7, sakkiz: 8, toqqiz: 9 };
export function parseSmallNumber(ws: string[]): number | null {
  if (ws.length === 1 && /^\d{1,2}$/.test(ws[0])) return Number(ws[0]);
  if (ws.length === 1 && ws[0] in UNITS) return UNITS[ws[0]];
  if (ws[0] === "on") {
    if (ws.length === 1) return 10;
    if (ws.length === 2 && ws[1] in UNITS) return 10 + UNITS[ws[1]];
  }
  if (ws.length === 1 && ws[0] === "yigirma") return 20;
  return null;
}

/** "ochish" (open) and friends: whole words only ("o'chir" = erase must not match) */
const OPEN_WORDS = new Set(["ochish", "och", "oching", "ochib", "ochamiz", "kirish", "kir", "kiring", "kiramiz"]);

const words = (text: string) => normalizeQuestion(text).replace(/'/g, "").split(" ").filter(Boolean);

function answerLetter(ws: string[]): Letter | null {
  const hasAnswerWord = ws.some((w) => ANSWER_WORDS.some((a) => w.startsWith(a)));
  if (hasAnswerWord) {
    const n = ws.map((w) => CARDINALS[w]).filter(Boolean) as Letter[];
    if (n.length === 1) return n[0];
  }
  for (const w of ws) {
    const o = ORDINALS[w.replace(/(ni|si)$/, "") as string] ?? ORDINALS[w];
    if (o && (hasAnswerWord || ws.length <= 3)) return o;
  }
  // "bni" → "b"+"ni"
  const letters = ws.map((w) => LETTER_WORDS[w] ?? LETTER_WORDS[w.replace(/ni$/, "")] ?? null);
  const found = letters.filter(Boolean) as Letter[];
  if (found.length !== 1) return null;
  if (hasAnswerWord) return found[0];
  // a lone letter, maybe with filler words around it ("B", "iltimos B", "menimcha be")
  const rest = ws.filter((w, i) => !letters[i] && !FILLER.has(w));
  return rest.length === 0 ? found[0] : null;
}

/** null = not a command (it's a question for the tutor) */
export function parseVoiceCommand(text: string): VoiceCommand | null {
  const ws = words(text);
  if (!ws.length || ws.length > 8) return null;
  const has = (p: string) => ws.some((w) => w.startsWith(p));
  const phrase = ws.join(" ");

  // Juftini top: "karta besh", "kartochka 12", "karta o'n ikki"
  if (/^kart/.test(ws[0] ?? "") && ws.length >= 2) {
    const n = parseSmallNumber(ws.slice(1));
    if (n && n >= 1 && n <= 20) return { type: "card", n };
  }
  // town / games (before "uyga" = home and "keyingi" = continue)
  if (/(^| )(keyingi|keyingisi|navbatdagi) (bino|uy)/.test(phrase)) return { type: "nextBuilding" };
  if (/(^| )(oldingi|oldingisi) (bino|uy)/.test(phrase)) return { type: "prevBuilding" };
  if (ws.length <= 3 && ws.some((w) => OPEN_WORDS.has(w))) return { type: "open" };
  if (ws.length <= 3 && (has("orqaga") || has("ortga"))) return { type: "back" };
  if (/\bbosh sahifa/.test(phrase) || /\bbosh menyu/.test(phrase) || has("uyga")) return { type: "home" };
  if (has("tushunmadim") || has("tushunmayapman") || /\byana tushuntir/.test(phrase)) return { type: "confused" };
  const letter = answerLetter(ws);
  if (letter) return { type: "answer", letter, index: letterIndex(letter) };
  if (has("sekin")) return { type: "slower" };
  if (has("tezroq") || has("tezlat")) return { type: "faster" };
  if (has("qaytar") || has("takrorla") || /\byana bir (marta|bor) ayt/.test(phrase)) return { type: "repeat" };
  if (/\bdoska\w* oqi/.test(phrase) || /\boqib ber/.test(phrase) || has("oqing")) return { type: "read" };
  if (has("toxta") || has("pauza") || has("kutib tur")) return { type: "stop" };
  if (has("davom") || (has("keyingi") && ws.length <= 3) || phrase === "tushunarli" || phrase === "ha tushunarli") return { type: "continue" };
  return null;
}

/** "A" → index 0 */
export const letterIndex = (l: Letter) => "ABCD".indexOf(l);
