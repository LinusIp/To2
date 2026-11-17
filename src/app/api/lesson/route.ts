// POST /api/lesson {skillId, finished:true} → close the lesson row and give a completion bonus.
import { z } from "zod";
import { bad, json, userIdFor } from "@/lib/server/session";
import { addXp, bumpMastery, finishLessonRow } from "@/lib/server/repo";

const Body = z.object({ skillId: z.string().max(64), finished: z.boolean() });

export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return bad("So'rov noto'g'ri");
  const userId = await userIdFor(req);
  if (!userId) return json({ ok: true, xp: 0 });
  const first = b.data.finished ? await finishLessonRow(userId, b.data.skillId) : false;
  if (first) {
    await addXp(userId, 20);
    await bumpMastery(userId, b.data.skillId);
  }
  return json({ ok: true, xp: first ? 20 : 0 });
}
