// Course towns progress: which buildings (quest numbers, 1-based) the learner finished, per town.
// GET  /api/town            → { progress: { [townId]: number[] } }
// POST /api/town {town, n}  → marks building n done → { done: number[] }
// Stored in the D1 kv_store (src/lib/server/store.ts) — never KV (1,000 writes/day cap).
import { z } from "zod";
import { bad, json, userIdFor } from "@/lib/server/session";
import { storeGetJson, storePut } from "@/lib/server/store";
import { TOWNS, TOWN_BY_ID } from "@/config/towns";

const key = (uid: string, town: string) => `town:${uid}:${town}`;
const Body = z.object({ town: z.string().max(32), n: z.number().int().min(1).max(50) });

export async function GET(req: Request) {
  const uid = await userIdFor(req);
  if (!uid) return bad("Avval ro'yxatdan o'ting", 401);
  const entries = await Promise.all(TOWNS.map(async (t) => [t.id, (await storeGetJson<number[]>(key(uid, t.id))) ?? []] as const));
  return json({ progress: Object.fromEntries(entries) });
}

export async function POST(req: Request) {
  const uid = await userIdFor(req);
  if (!uid) return bad("Avval ro'yxatdan o'ting", 401);
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success || !TOWN_BY_ID[b.data.town]) return bad("So'rov noto'g'ri");
  const prev = (await storeGetJson<number[]>(key(uid, b.data.town))) ?? [];
  const done = [...new Set([...prev, b.data.n])].sort((a, c) => a - c);
  if (done.length !== prev.length) await storePut(key(uid, b.data.town), JSON.stringify(done));
  return json({ done });
}
