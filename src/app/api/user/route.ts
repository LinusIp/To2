import { z } from "zod";
import { createSession, destroySession, json, bad, userIdFor } from "@/lib/server/session";
import { createUser, deleteUser, getMastery, getUser, lessonsFinished, publicUser, updateUser } from "@/lib/server/repo";
import { CHARACTER_BY_ID, CHARACTER_IDS, isUnlocked, type CharacterId } from "@/config/characters";

const CreateBody = z.object({
  nickname: z.string().trim().min(1).max(24),
  grade: z.coerce.number().int().min(5).max(9),
  characterId: z.enum(CHARACTER_IDS),
});

export async function GET(req: Request) {
  const user = await getUser(await userIdFor(req));
  if (!user) return json({ user: null });
  const mastery = await getMastery(user.id);
  return json({ user: publicUser(user), mastery, lessonsFinished: await lessonsFinished(user.id) });
}

/** Onboarding: create the anonymous user (nickname + grade only — no personal data). */
export async function POST(req: Request) {
  const body = CreateBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad("Ma'lumotlar noto'g'ri");
  const ch = body.data.characterId as CharacterId;
  const characterId = isUnlocked(ch, 0) ? ch : "blokbek";
  const existing = await getUser(await userIdFor(req));
  if (existing) {
    await updateUser(existing.id, { nickname: body.data.nickname, grade: body.data.grade, characterId });
    return json({ user: publicUser({ ...existing, ...body.data, characterId }) });
  }
  const user = await createUser({ ...body.data, characterId });
  const cookie = await createSession(user.id, req);
  return json({ user: publicUser(user) }, { cookie });
}

const PatchBody = z.object({ characterId: z.string().optional(), grade: z.coerce.number().int().min(5).max(9).optional() });

export async function PATCH(req: Request) {
  const user = await getUser(await userIdFor(req));
  if (!user) return bad("Foydalanuvchi topilmadi", 401);
  const body = PatchBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad("Ma'lumotlar noto'g'ri");
  const patch: { characterId?: string; grade?: number } = {};
  if (body.data.characterId) {
    const c = body.data.characterId as CharacterId;
    if (!CHARACTER_BY_ID[c]) return bad("Qahramon topilmadi");
    if (!isUnlocked(c, user.xp, user.streakDays)) return bad("Bu qahramon hali yopiq", 403);
    patch.characterId = c;
  }
  if (body.data.grade) patch.grade = body.data.grade;
  await updateUser(user.id, patch);
  return json({ user: publicUser({ ...user, ...patch }) });
}

/** "Start over": delete everything we stored about this guest. */
export async function DELETE(req: Request) {
  const id = await userIdFor(req);
  if (id) await deleteUser(id);
  return json({ ok: true }, { cookie: await destroySession(req) });
}
