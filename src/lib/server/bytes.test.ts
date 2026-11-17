import { describe, expect, it } from "vitest";
import { MAX_STORE_BYTES, decodeBytes, encodeBytes } from "./bytes";

describe("store bytes (base64 text instead of D1 BLOB)", () => {
  it("round-trips arbitrary bytes exactly", () => {
    const src = new Uint8Array(70_001);
    for (let i = 0; i < src.length; i++) src[i] = (i * 131 + 7) & 255;
    const back = new Uint8Array(decodeBytes(encodeBytes(src.buffer)));
    expect(back.byteLength).toBe(src.byteLength);
    expect(back).toEqual(src);
  });

  it("returns an exact-size ArrayBuffer (not a slice of a pooled Buffer)", () => {
    const out = decodeBytes(encodeBytes(new Uint8Array([1, 2, 3])));
    expect(out.byteLength).toBe(3);
    expect([...new Uint8Array(out)]).toEqual([1, 2, 3]);
  });

  it("the size cap stays under a 2 MB D1 row once encoded", () => {
    expect(Math.ceil(MAX_STORE_BYTES / 3) * 4).toBeLessThan(2_000_000);
  });

  it("is fast enough for the Worker CPU budget (600 KB WAV)", () => {
    const wav = new Uint8Array(600_000).map((_, i) => i & 255);
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) decodeBytes(encodeBytes(wav));
    const per = (performance.now() - t0) / 10;
    expect(per).toBeLessThan(10); // ms per encode+decode on this machine (native code)
  });
});
