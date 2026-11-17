// Minimal PCM WAV helpers (VoiceLab TTS returns 16-bit mono 24 kHz WAV). Used on the server to
// join per-sentence clips with silences into one file. Pure + unit-tested; runs in Workers.

export interface Pcm {
  sampleRate: number;
  channels: number;
  bits: number;
  data: Uint8Array; // raw PCM bytes
}

export function parseWav(buf: ArrayBuffer): Pcm {
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (buf.byteLength < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("not a WAV file");
  let off = 12;
  let fmt: { sampleRate: number; channels: number; bits: number; format: number } | null = null;
  while (off + 8 <= buf.byteLength) {
    const id = tag(off);
    const size = v.getUint32(off + 4, true);
    if (id === "fmt ") fmt = { format: v.getUint16(off + 8, true), channels: v.getUint16(off + 10, true), sampleRate: v.getUint32(off + 12, true), bits: v.getUint16(off + 22, true) };
    if (id === "data") {
      if (!fmt) throw new Error("WAV: data before fmt");
      if (fmt.format !== 1) throw new Error("WAV: not PCM");
      // some encoders write 0xFFFFFFFF for streamed sizes: clamp to the buffer
      const len = Math.min(size, buf.byteLength - off - 8);
      return { sampleRate: fmt.sampleRate, channels: fmt.channels, bits: fmt.bits, data: new Uint8Array(buf, off + 8, len) };
    }
    off += 8 + size + (size & 1);
  }
  throw new Error("WAV: no data chunk");
}

export function wavDurationMs(p: Pcm) {
  return (p.data.byteLength / (p.sampleRate * p.channels * (p.bits / 8))) * 1000;
}

/**
 * Concatenate clips with silences: `parts` alternate audio and silence (number = ms of silence).
 * All clips must share one format (the first clip's format is used).
 */
export function joinWav(parts: (ArrayBuffer | number)[]): ArrayBuffer {
  const clips = parts.filter((p): p is ArrayBuffer => typeof p !== "number").map(parseWav);
  if (!clips.length) throw new Error("joinWav: no audio");
  const { sampleRate, channels, bits } = clips[0];
  for (const c of clips)
    if (c.sampleRate !== sampleRate || c.channels !== channels || c.bits !== bits) throw new Error("joinWav: mixed formats");
  const frame = channels * (bits / 8);
  const silence = (ms: number) => Math.max(0, Math.round((ms / 1000) * sampleRate)) * frame;
  let total = 0;
  let k = 0;
  for (const p of parts) total += typeof p === "number" ? silence(p) : clips[k++].data.byteLength;
  const out = new ArrayBuffer(44 + total);
  const v = new DataView(out);
  const w = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + total, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * frame, true);
  v.setUint16(32, frame, true);
  v.setUint16(34, bits, true);
  w(36, "data");
  v.setUint32(40, total, true);
  const bytes = new Uint8Array(out);
  let at = 44;
  k = 0;
  for (const p of parts) {
    if (typeof p === "number") at += silence(p); // zero-filled already
    else {
      const d = clips[k++].data;
      bytes.set(d, at);
      at += d.byteLength;
    }
  }
  return out;
}
