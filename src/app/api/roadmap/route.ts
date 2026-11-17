// GET /api/roadmap → skill graph + mastery → nodes (status per skill) + ordered path.
import { bad, json, userIdFor } from "@/lib/server/session";
import { getUser, publicUser, roadmapFor } from "@/lib/server/repo";

export async function GET(req: Request) {
  const user = await getUser(await userIdFor(req));
  if (!user) return bad("Avval ro'yxatdan o'ting", 401);
  const rm = await roadmapFor(user);
  return json({ user: publicUser(user), roadmap: rm });
}
