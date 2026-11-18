// GET/POST /api/games/best — best score per learner + game, in the D1 kv_store (never KV: 1,000 writes/day).
// The client also keeps a localStorage copy, so a guest without a session still sees a record.
import { z } from "zod";
import { GAME_IDS } from "@/lib/games/answer";
import { betterScore } from "@/lib/games/scoring";
import { bad, json, userIdFor } from "@/lib/server/session";
import { storeGetJson, storePut } from "@/lib/server/store";

type Best = Partial<Record<(typeof GAME_IDS)[number], number>>;
const key = (uid: string) => `games:best:${uid}`;

export async function GET(req: Request) {
  const uid = await userIdFor(req);
  if (!uid) return json({ best: {} });
  return json({ best: (await storeGetJson<Best>(key(uid))) ?? {} });
}

const Body = z.object({ game: z.enum(GAME_IDS), score: z.number().int().min(0).max(100_000) });

export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return bad("So'rov noto'g'ri");
  const uid = await userIdFor(req);
  if (!uid) return json({ best: { [b.data.game]: b.data.score }, saved: false });
  const cur = (await storeGetJson<Best>(key(uid))) ?? {};
  const prev = cur[b.data.game];
  const next = { ...cur, [b.data.game]: betterScore(prev, b.data.score) };
  const saved = next[b.data.game] !== prev ? await storePut(key(uid), JSON.stringify(next)) : true;
  return json({ best: next, saved, record: (prev ?? 0) < b.data.score });
}
