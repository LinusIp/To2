// Binary ↔ base64 text for the D1 store (see store.ts for why audio is kept as text, not BLOB).
import { Buffer } from "node:buffer";

export const encodeBytes = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64");

/** base64 → an exact-size ArrayBuffer (Buffer may sit inside a larger shared pool). */
export function decodeBytes(s: string): ArrayBuffer {
  const buf = Buffer.from(s, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Largest binary value that still fits a D1 row (2 MB) once base64-encoded (×4/3) with a key. */
export const MAX_STORE_BYTES = 1_400_000;
