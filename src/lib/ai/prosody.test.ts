import { describe, expect, it } from "vitest";
import { ANSWER_LEAD_MS, PAUSE, clipText, prosodyPlan, splitSpeech } from "./prosody";
import { joinWav, parseWav, wavDurationMs } from "@/lib/audio/wav";

describe("splitSpeech", () => {
  it("splits at . ! ? … and keeps the terminator", () => {
    expect(splitSpeech("Zo'r! Uchta to'rtdan bir. Nega shunday?")).toEqual([
      { text: "Zo'r!", end: "!" },
      { text: "Uchta to'rtdan bir.", end: "." },
      { text: "Nega shunday?", end: "?" },
    ]);
    // "qani," is a one-word interjection → its own clip
    expect(splitSpeech("Hmm... qani, o'ylab ko'raylik…").map((p) => p.end)).toEqual(["…", ",", "…"]);
  });

  it("gives a short interjection before a comma its own clip", () => {
    expect(splitSpeech("Voy, to'g'ri, olti!")).toEqual([
      { text: "Voy,", end: "," },
      { text: "to'g'ri, olti!", end: "!" },
    ]);
    expect(splitSpeech("Hechqisi yo'q, yana bir urinib ko'ramiz!")[0]).toEqual({ text: "Hechqisi yo'q,", end: "," });
    // a long clause before a comma is not an interjection
    expect(splitSpeech("Ko'k bloklarni bir qatorga qo'yamiz, keyin sanaymiz.")).toHaveLength(1);
  });

  it("handles text without a final terminator and ?! runs", () => {
    expect(splitSpeech("Iks nechaga teng?! Topamiz")).toEqual([
      { text: "Iks nechaga teng?!", end: "?" },
      { text: "Topamiz", end: "" },
    ]);
  });
});

describe("prosodyPlan", () => {
  it("speed = base × emotion factor; the closing question is slower", () => {
    const p = prosodyPlan("Voy, barakalla! Endi sen ayt. Nechaga teng?", "excited", "lison-v2", 1.1);
    expect(p.clips.map((c) => c.speed)).toEqual([1.23, 1.23, 1.23, 1.17]);
    expect(prosodyPlan("Hmm… o'ylab ko'raylik.", "thinking", "lison", 1).clips[0].speed).toBe(0.9);
  });

  it("pauses: 180 after a comma, 320 after . ! ?, 450 after …, none at the end", () => {
    const p = prosodyPlan("Voy, zo'r! Hmm… Bu nima?", "happy", "lison", 1);
    expect(p.clips.map((c) => c.pauseAfter)).toEqual([PAUSE.comma, PAUSE.stop, PAUSE.ellipsis, 0]);
  });

  it("answers to a learner question start with a short thinking pause", () => {
    expect(prosodyPlan("Yaxshi savol!", "thinking", "lison", 1, { answerLead: true }).lead).toBe(ANSWER_LEAD_MS);
    expect(prosodyPlan("Yaxshi savol!", "thinking", "lison", 1).lead).toBe(0);
  });

  it("speech tags only on lison-v2, speeds clamped to 0.5–2", () => {
    expect(clipText(prosodyPlan("Zo'r!", "excited", "lison-v2", 1).clips[0])).toBe("[excited] Zo'r!");
    expect(clipText(prosodyPlan("Zo'r!", "excited", "lison", 1).clips[0])).toBe("Zo'r!");
    expect(prosodyPlan("Zo'r!", "excited", "lison", 3).clips[0].speed).toBe(2);
  });
});

function tone(ms: number, sr = 24000) {
  const n = Math.round((ms / 1000) * sr);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, 1000, true);
  return buf;
}

describe("joinWav", () => {
  it("joins clips with silences of the right length", () => {
    const out = joinWav([250, tone(500), 320, tone(300)]);
    const p = parseWav(out);
    expect(p.sampleRate).toBe(24000);
    expect(wavDurationMs(p)).toBeCloseTo(250 + 500 + 320 + 300, 0);
    const v = new DataView(out);
    expect(v.getInt16(44, true)).toBe(0); // lead silence
    expect(v.getInt16(44 + Math.round(0.25 * 24000) * 2, true)).toBe(1000); // then audio
  });

  it("rejects mixed sample rates", () => {
    expect(() => joinWav([tone(100), tone(100, 16000)])).toThrow(/mixed/);
  });
});
