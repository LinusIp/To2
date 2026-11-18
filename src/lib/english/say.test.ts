import { describe, expect, it } from "vitest";
import { cleanPhrase, geminiRequest, pcmFromGemini, pcmToWav, phraseKey, sayableParts, MAX_PHRASE } from "./say";
import { EN_TO_BE } from "@/config/courses/english/demoLesson";

describe("English say — phrase whitelist", () => {
  it("accepts short English phrases (A–Z, spaces, ' . ? !)", () => {
    expect(cleanPhrase("  I'm   a student. ")).toBe("I'm a student.");
    expect(cleanPhrase("Are you OK?")).toBe("Are you OK?");
    expect(cleanPhrase("I’m")).toBe("I'm");
  });
  it("rejects anything else", () => {
    for (const bad of ["", "   ", "x".repeat(MAX_PHRASE + 1), "2 + 2", "she/he", "to be — bo", "<script>", "hi; DROP", "Привет", "..."]) expect(cleanPhrase(bad), bad).toBeNull();
  });
  it("finds the English parts of the demo lesson's board text", () => {
    expect(sayableParts("I am = I'm")).toEqual(["I am", "I'm"]);
    expect(sayableParts("he / she / it is")).toEqual(["he she it is"]);
    expect(sayableParts("to be = bo'lmoq")).toEqual(["to be"]);
    expect(sayableParts("She ___ a teacher.")).toEqual([]);
    expect(sayableParts("men ...man")).toEqual([]);
    expect(sayableParts("She is a teacher.")).toEqual(["She is a teacher."]);
    const all = EN_TO_BE.flatMap((s) => s.board).flatMap((c) => (c.op === "write" ? sayableParts(c.text) : []));
    expect(all).toContain("we you they are");
    expect(all).toContain("We are friends.");
  });
});

describe("English say — Gemini", () => {
  it("the request never carries a key (it goes in a header, added by the route)", () => {
    const r = geminiRequest("I am");
    expect(r.url).not.toMatch(/key=/);
    expect(JSON.stringify(r.body)).not.toMatch(/key/i);
    expect(r.body.generationConfig.responseModalities).toEqual(["AUDIO"]);
    expect(r.body.contents[0].parts[0].text).toContain("I am");
  });
  it("turns Gemini's base64 PCM into a playable WAV", () => {
    const pcm = new Uint8Array([1, 0, 2, 0, 3, 0, 4, 0]);
    const json = { candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;codec=pcm;rate=24000", data: btoa(String.fromCharCode(...pcm)) } }] } }] };
    const got = pcmFromGemini(json)!;
    expect(got.rate).toBe(24000);
    expect([...got.pcm]).toEqual([...pcm]);
    const wav = new DataView(pcmToWav(got.pcm, got.rate));
    expect(String.fromCharCode(wav.getUint8(0), wav.getUint8(1), wav.getUint8(2), wav.getUint8(3))).toBe("RIFF");
    expect(wav.getUint32(24, true)).toBe(24000);
    expect(wav.getUint32(40, true)).toBe(8);
    expect(wav.byteLength).toBe(52);
  });
  it("no audio in the response → null (the button hides)", () => {
    expect(pcmFromGemini({})).toBeNull();
    expect(pcmFromGemini({ candidates: [{ content: { parts: [{ text: "sorry" }] } }] })).toBeNull();
  });
  it("cache key is stable and case-insensitive", async () => {
    expect(await phraseKey("I am")).toBe(await phraseKey("i am"));
    expect(await phraseKey("I am")).not.toBe(await phraseKey("I'm"));
    expect(await phraseKey("I am")).toMatch(/^ensay:v1:[0-9a-f]{64}$/);
  });
});
