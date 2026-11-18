import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseVoiceCommand } from "./commands";
import { A11Y_COMMAND_EVENT, claimListening, dispatchA11yCommand, listeningClaimed, onA11yCommand } from "./bus";

const cmd = (s: string) => parseVoiceCommand(s);

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

describe("a11y:command bus", () => {
  const g = globalThis as unknown as { window?: EventTarget };
  beforeEach(() => (g.window = new EventTarget()));
  afterEach(() => delete g.window);

  it("delivers commands as window events; a listener returning true marks it handled", () => {
    const got: string[] = [];
    const off = onA11yCommand((c, text) => {
      got.push(`${c.type}:${text}`);
      return c.type === "open";
    });
    expect(dispatchA11yCommand({ type: "open" }, "ochish")).toBe(true);
    expect(dispatchA11yCommand({ type: "nextBuilding" }, "keyingi bino")).toBe(false);
    off();
    expect(dispatchA11yCommand({ type: "open" })).toBe(false);
    expect(got).toEqual(["open:ochish", "nextBuilding:keyingi bino"]);
  });

  it("works with a plain addEventListener (no import needed by other branches)", () => {
    let seen: unknown = null;
    window.addEventListener(A11Y_COMMAND_EVENT, (e) => {
      seen = (e as CustomEvent).detail.command;
      e.preventDefault();
    });
    expect(dispatchA11yCommand({ type: "answer", letter: "C", index: 2 }, "javob uch")).toBe(true);
    expect(seen).toEqual({ type: "answer", letter: "C", index: 2 });
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
