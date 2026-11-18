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
  | { type: "answer"; letter: Letter }
  | { type: "home" }
  | { type: "read" }
  | { type: "stop" };

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
/** words that make a bare letter an answer ("javob B", "B variant", "B ni tanlayman") */
const ANSWER_WORDS = ["javob", "variant", "tanlayman", "tanladim", "tanla", "belgila"];
/** filler words allowed around a lone letter */
const FILLER = new Set(["iltimos", "menimcha", "bu", "shu", "ni", "deb", "o", "ha", "ustoz", "mening", "men", "javobim"]);

const words = (text: string) => normalizeQuestion(text).replace(/'/g, "").split(" ").filter(Boolean);

function answerLetter(ws: string[]): Letter | null {
  const hasAnswerWord = ws.some((w) => ANSWER_WORDS.some((a) => w.startsWith(a)));
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

  if (/\bbosh sahifa/.test(phrase) || /\bbosh menyu/.test(phrase) || has("uyga")) return { type: "home" };
  if (has("tushunmadim") || has("tushunmayapman") || /\byana tushuntir/.test(phrase)) return { type: "confused" };
  const letter = answerLetter(ws);
  if (letter) return { type: "answer", letter };
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
