// Small key-value store for sessions, diagnostic state, lesson/answer caches and TTS audio.
//
// Why not just KV: Workers KV on our plan allows 1,000 writes per DAY (reads: 100,000). The app
// writes on every new guest, every cached answer and every audio clip, and hit that cap on
// 2026-11-18 — after that every write threw and requests failed with 500. So:
//   - writes go to D1 (table kv_store; 100,000 writes/day, rows up to 2 MB),
//   - reads try D1 first, then KV (everything cached before the switch stays valid),
//   - nothing here throws: a failed write is logged and the request carries on.
import { getDb } from "@/db/client";
import { getEnv } from "@/lib/env";

type Row = { value: string | number[] | ArrayBuffer; mime: string | null; expires_at: number | null };

const now = () => Math.floor(Date.now() / 1000);

async function d1Row(key: string): Promise<Row | null> {
  try {
    await getDb(); // creates kv_store on a fresh database
    const r = await getEnv().DB.prepare("SELECT value, mime, expires_at FROM kv_store WHERE key = ?").bind(key).first<Row>();
    if (!r) return null;
    if (r.expires_at && r.expires_at < now()) return null;
    return r;
  } catch (e) {
    console.warn("[store] d1 read failed", (e as Error).message);
    return null;
  }
}

const toBytes = (v: Row["value"]): ArrayBuffer =>
  v instanceof ArrayBuffer ? v : Array.isArray(v) ? new Uint8Array(v).buffer : new TextEncoder().encode(String(v)).buffer;

export async function storeGetText(key: string): Promise<string | null> {
  const r = await d1Row(key);
  if (r) return typeof r.value === "string" ? r.value : new TextDecoder().decode(toBytes(r.value));
  try {
    return await getEnv().KV.get(key);
  } catch {
    return null;
  }
}

export async function storeGetJson<T>(key: string): Promise<T | null> {
  const t = await storeGetText(key);
  if (t == null) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

export async function storeGetBytes(key: string): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  const r = await d1Row(key);
  if (r) return { bytes: toBytes(r.value), mime: r.mime ?? "application/octet-stream" };
  try {
    const kv = await getEnv().KV.getWithMetadata<{ mime?: string }>(key, "arrayBuffer");
    return kv.value ? { bytes: kv.value, mime: kv.metadata?.mime ?? "application/octet-stream" } : null;
  } catch {
    return null;
  }
}

/** Write (upsert). `ttlSec` = expiry; omit to keep forever. Never throws; returns false on failure. */
export async function storePut(key: string, value: string | ArrayBuffer, opts: { ttlSec?: number; mime?: string } = {}): Promise<boolean> {
  try {
    await getDb();
    const exp = opts.ttlSec ? now() + opts.ttlSec : null;
    const v = typeof value === "string" ? value : new Uint8Array(value);
    await getEnv()
      .DB.prepare("INSERT INTO kv_store (key, value, mime, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, mime = excluded.mime, expires_at = excluded.expires_at")
      .bind(key, v, opts.mime ?? null, exp)
      .run();
    return true;
  } catch (e) {
    console.warn("[store] write failed", key.slice(0, 40), (e as Error).message);
    return false;
  }
}

export async function storeDelete(key: string): Promise<void> {
  try {
    await getDb();
    await getEnv().DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(key).run();
  } catch (e) {
    console.warn("[store] delete failed", (e as Error).message);
  }
}
