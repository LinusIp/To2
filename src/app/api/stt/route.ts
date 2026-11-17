// POST /api/stt (multipart `audio`) → { text }. Audio is transcribed and dropped — never stored.
import { getAI } from "@/lib/ai";
import { bad, clientKey, json, rateLimit, userIdFor } from "@/lib/server/session";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  if (!(await rateLimit(`stt:${clientKey(req, await userIdFor(req))}`, 20))) return bad("Juda ko'p so'rov, biroz kuting", 429);
  let file: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("audio");
    file = f instanceof File ? f : null;
  } catch {
    return bad("Audio topilmadi");
  }
  if (!file || file.size === 0) return bad("Audio topilmadi");
  if (file.size > MAX_BYTES) return bad("Audio juda katta", 413);
  try {
    const { text } = await getAI().stt.transcribe(await file.arrayBuffer(), file.type || "audio/webm");
    return json({ text });
  } catch (e) {
    console.error("[stt]", (e as Error).message);
    return json({ text: "", error: "stt_failed" }, { status: 502 });
  }
}
