// Guest-first auth: anonymous session id in an HttpOnly cookie → KV → user id.
import { getEnv } from "@/lib/env";
import { storeDelete, storeGetText, storePut } from "./store";

const COOKIE = "to2_sid";
const TTL = 60 * 60 * 24 * 180; // 180 days

export function readSid(req: Request): string | null {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9-]{20,})`));
  return m ? m[1] : null;
}

export async function userIdFor(req: Request): Promise<string | null> {
  const sid = readSid(req);
  if (!sid) return null;
  return storeGetText(`sess:${sid}`); // D1, then KV (sessions created before the switch)
}

/** Create a session for a user; returns the Set-Cookie header value. */
export async function createSession(userId: string, req: Request): Promise<string> {
  const sid = crypto.randomUUID();
  await storePut(`sess:${sid}`, userId, { ttlSec: TTL });
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL}${secure}`;
}

export async function destroySession(req: Request): Promise<string> {
  const sid = readSid(req);
  if (sid) {
    await storeDelete(`sess:${sid}`);
    await getEnv().KV.delete(`sess:${sid}`).catch(() => {});
  }
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export const json = (data: unknown, init: ResponseInit & { cookie?: string } = {}) => {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  if (init.cookie) headers.append("set-cookie", init.cookie);
  return new Response(JSON.stringify(data), { ...init, headers });
};

export const bad = (message: string, status = 400) => json({ error: message }, { status });

/**
 * Very small fixed-window rate limit (per user/ip + bucket), in memory per Worker isolate.
 * It used to write a KV counter on EVERY request, which used up KV's 1,000 writes/day. Per-isolate
 * counting is looser (each isolate counts on its own) but enough to stop a runaway client.
 */
const buckets = new Map<string, { win: number; n: number }>();
export async function rateLimit(key: string, limit: number, windowSec = 60): Promise<boolean> {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const b = buckets.get(key);
  if (!b || b.win !== win) {
    if (buckets.size > 5000) buckets.clear();
    buckets.set(key, { win, n: 1 });
    return true;
  }
  if (b.n >= limit) return false;
  b.n++;
  return true;
}

export function clientKey(req: Request, userId: string | null) {
  return userId ?? req.headers.get("cf-connecting-ip") ?? "anon";
}
