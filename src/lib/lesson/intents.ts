// "Start over" requests ("boshidan", "qaytadan", "doskani o'chir", "tushunmadim", a bare "tushuntirib
// ber") restart the lesson from step 1 with its cached segments — they never go to the LLM note path.
// Pure + tested (intents.test.ts).
import { normalizeQuestion } from "@/lib/ai/pinned";

/** words that only ask for a repeat — "tushuntirib ber" restarts only if the request has nothing else */
const REPEAT_WORDS = new Set([
  "yana", "iltimos", "menga", "bir", "marta", "qayta", "ber", "bering", "beringchi", "berchi", "ustoz", "ozgina",
  "sekinroq", "sekin", "hammasini", "boshqatdan", "darsni", "mavzuni", "shuni", "buni", "endi", "qani", "keling",
]);

export function isRestartRequest(text: string): boolean {
  const words = normalizeQuestion(text).replace(/'/g, "").split(" ").filter(Boolean);
  if (!words.length) return false;
  const has = (p: string) => words.some((w) => w.startsWith(p));
  // strong signals: always a restart
  if (has("boshidan") || has("qaytadan") || has("boshqatdan") || has("tushunmadim")) return true;
  if (words.some((w, i) => w.startsWith("doska") && words[i + 1]?.startsWith("ochir"))) return true;
  // "darsni qayta boshla", "yangidan boshlaymiz", "birinchi qadamdan", "darsni takrorla", "restart"
  if (has("restart") || has("yangidan") || words.some((w, i) => w.startsWith("birinchi") && words[i + 1]?.startsWith("qadam"))) return true;
  if (has("boshla") && (has("qayta") || has("dars") || has("yana"))) return true;
  if (has("takrorla") && (has("dars") || words.length <= 3)) return true;
  // "(yana) tushuntirib ber(ing)" with nothing else in it
  if (has("tushuntir")) return words.every((w) => w.startsWith("tushuntir") || REPEAT_WORDS.has(w));
  return false;
}
