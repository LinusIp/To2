import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseVoiceCommand } from "./commands";
import { VOICE_EVENT, claimListening, dispatchVoice, handlesBackItself, listeningClaimed, onVoice, toVoiceDetail } from "./bus";

const cmd = (s: string) => parseVoiceCommand(s);
const wire = (s: string) => {
  const c = cmd(s);
  return c ? toVoiceDetail(c) : null;
};

describe("town / game commands", () => {
  it("parses the new commands", () => {
    expect(cmd("keyingi bino")).toEqual({ type: "nextBuilding" });
    expect(cmd("keyingi binoga o'tamiz")).toEqual({ type: "nextBuilding" });
    expect(cmd("keyingi uyga")).toEqual({ type: "nextBuilding" }); // not "uyga" = home
    expect(cmd("oldingi bino")).toEqual({ type: "prevBuilding" });
    expect(cmd("ochish")).toEqual({ type: "open" });
    expect(cmd("och")).toEqual({ type: "open" });
    expect(cmd("Orqaga")).toEqual({ type: "back" });
    expect(cmd("orqaga qayt")).toEqual({ type: "back" });
  });
  it("javob bir/ikki/uch/to'rt → answers 1–4", () => {
    expect(cmd("javob bir")).toEqual({ type: "answer", letter: "A", index: 0 });
    expect(cmd("javob ikki")).toEqual({ type: "answer", letter: "B", index: 1 });
    expect(cmd("Javob uch")).toEqual({ type: "answer", letter: "C", index: 2 });
    expect(cmd("javob to'rt")).toEqual({ type: "answer", letter: "D", index: 3 });
    expect(cmd("javob 2")).toEqual({ type: "answer", letter: "B", index: 1 });
  });
  it("does not steal other phrases", () => {
    expect(cmd("doskani o'chir")?.type).not.toBe("open"); // erase, not open
    expect(cmd("keyingi")?.type).toBe("continue");
    expect(cmd("bosh sahifa")?.type).toBe("home");
    expect(cmd("bir ikki uch")).toBeNull(); // numbers without "javob" are not answers
    expect(cmd("Nega maxrajlarni ko'paytirdik?")).toBeNull();
  });
});

describe('"to2:voice" wire format (feat/roadmap TownScreen, feat/games)', () => {
  it("maps spoken phrases to the agreed details", () => {
    expect(wire("keyingi bino")).toEqual({ command: "next" });
    expect(wire("oldingi bino")).toEqual({ command: "prev" });
    expect(wire("ochish")).toEqual({ command: "open" });
    expect(wire("orqaga")).toEqual({ command: "back" });
    expect(wire("davom et")).toEqual({ command: "continue" });
    expect(wire("bosh sahifa")).toEqual({ command: "home" });
    expect(wire("javob bir")).toEqual({ command: "answer", n: 1 });
    expect(wire("javob to'rt")).toEqual({ command: "answer", n: 4 });
    expect(wire("B")).toEqual({ command: "answer", n: 2 });
  });
  it("lesson-only commands are not sent", () => {
    for (const s of ["sekinroq", "qaytar", "tushunmadim", "to'xta", "doskani o'qi"]) expect(wire(s), s).toBeNull();
  });
  it("the town route handles back/home itself (no app fallback there)", () => {
    expect(handlesBackItself("/town/kasrlar")).toBe(true);
    expect(handlesBackItself("/towns")).toBe(false);
    expect(handlesBackItself("/home")).toBe(false);
  });
});

describe("event bus", () => {
  const g = globalThis as unknown as { window?: EventTarget };
  beforeEach(() => (g.window = new EventTarget()));
  afterEach(() => delete g.window);

  it("is a plain window event named to2:voice (no import needed by other branches)", () => {
    const seen: unknown[] = [];
    window.addEventListener(VOICE_EVENT, (e) => seen.push((e as CustomEvent).detail));
    expect(VOICE_EVENT).toBe("to2:voice");
    expect(dispatchVoice({ type: "nextBuilding" })).toBe(false); // nobody called preventDefault
    dispatchVoice({ type: "answer", letter: "C", index: 2 });
    expect(dispatchVoice({ type: "slower" })).toBe(false); // not sent
    expect(seen).toEqual([{ command: "next" }, { command: "answer", n: 3 }]);
  });

  it("a listener can mark a command handled", () => {
    const off = onVoice((d) => d.command === "open");
    expect(dispatchVoice({ type: "open" })).toBe(true);
    expect(dispatchVoice({ type: "back" })).toBe(false);
    off();
    expect(dispatchVoice({ type: "open" })).toBe(false);
  });

  it("screens with their own recogniser claim the mic", () => {
    expect(listeningClaimed()).toBe(false);
    const a = claimListening();
    const b = claimListening();
    a();
    a(); // releasing twice is harmless
    expect(listeningClaimed()).toBe(true);
    b();
    expect(listeningClaimed()).toBe(false);
  });
});
