// Cause: the "nothing is playing" timeout read the SHARED <audio> element. After any earlier clip,
// currentTime sat at that clip's end (≠ 0), so the timeout never fired; a hung TTS request then
// left `started` unresolved and the lesson timeline (and the tutor) stopped for good.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lipsync", () => ({ attachAnalyser: vi.fn(), resumeAudioContext: vi.fn(), startMouth: vi.fn(), startTextMouth: vi.fn(), stopMouth: vi.fn() }));
vi.mock("./envelope", () => ({ decodeEnvelope: () => null }));

/** Minimal shared <audio>: play() "plays" a clip of `clipMs`, firing playing → ended. */
class FakeAudio {
  static instances: FakeAudio[] = [];
  static clipMs = 1000;
  src = "";
  paused = true;
  currentTime = 0;
  duration = NaN;
  muted = false;
  preload = "";
  crossOrigin = "";
  playbackRate = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  onloadedmetadata: (() => void) | null = null;
  constructor() {
    FakeAudio.instances.push(this);
  }
  play() {
    if (this.src.startsWith("data:")) return Promise.resolve(); // the unlock blip
    this.paused = false;
    this.duration = FakeAudio.clipMs / 1000;
    setTimeout(() => this.onplaying?.(), 0);
    setTimeout(() => {
      this.paused = true;
      this.currentTime = this.duration; // stays at the clip's end, like a real element
      this.onended?.();
    }, FakeAudio.clipMs);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeAudio.instances = [];
  vi.stubGlobal("Audio", FakeAudio);
  URL.createObjectURL = () => "blob:clip";
  URL.revokeObjectURL = () => {};
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** a TTS answer (plain object: a real Response body needs real timers under the fake clock) */
const okFetch = () => Promise.resolve({ status: 200, headers: new Headers({ "content-type": "audio/wav" }), blob: async () => ({}) } as unknown as Response);
/** a TTS request that never answers (slow mobile network, killed request) */
const hangingFetch = (_u: string, init?: RequestInit) =>
  new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));

describe("speak(): a line that never starts playing goes captions-only", () => {
  it("first line of the session: hung request → captions-only after the timeout", async () => {
    vi.stubGlobal("fetch", vi.fn(hangingFetch));
    const { speak } = await import("./player");
    const sp = speak("Salom!", "blokbek", { startTimeoutMs: 4000 });
    let started = -1;
    void sp.started.then((ms) => (started = ms));
    await vi.advanceTimersByTimeAsync(3999);
    expect(started).toBe(-1);
    await vi.advanceTimersByTimeAsync(2);
    expect(started).toBeGreaterThan(0); // captions-only duration
    let ended = false;
    void sp.ended.then(() => (ended = true));
    await vi.advanceTimersByTimeAsync(started + 10);
    expect(ended).toBe(true);
  });

  it("AFTER an earlier clip played (shared element at currentTime ≠ 0): still falls back — the bug", async () => {
    const fetchMock = vi.fn(okFetch);
    vi.stubGlobal("fetch", fetchMock);
    const { speak } = await import("./player");
    // line 1 plays normally and ends; the shared element now sits at currentTime = 1 s, paused
    const one = speak("Birinchi gap.", "blokbek");
    await vi.advanceTimersByTimeAsync(1100);
    await one.ended;
    expect(FakeAudio.instances[0].currentTime).toBe(1);
    // line 2: its TTS request hangs
    fetchMock.mockImplementation(hangingFetch as never);
    const two = speak("Ikkinchi gap.", "blokbek", { startTimeoutMs: 4000 });
    let started = -1;
    void two.started.then((ms) => (started = ms));
    await vi.advanceTimersByTimeAsync(4001);
    expect(started).toBeGreaterThan(0); // before the fix: never resolved → the tutor froze
    let ended = false;
    void two.ended.then(() => (ended = true));
    await vi.advanceTimersByTimeAsync(started + 10);
    expect(ended).toBe(true);
  });

  it("default timeout (main lesson) is 13 s, and a line that plays in time is NOT cut", async () => {
    vi.stubGlobal("fetch", vi.fn(okFetch));
    const { speak } = await import("./player");
    FakeAudio.clipMs = 20_000; // a long line, still playing at 13 s
    const sp = speak("Uzun gap.", "lola");
    const t = await Promise.race([sp.started, vi.advanceTimersByTimeAsync(50).then(() => -1)]);
    expect(t).toBe(20_000);
    await vi.advanceTimersByTimeAsync(14_000);
    let ended = false;
    void sp.ended.then(() => (ended = true));
    await vi.advanceTimersByTimeAsync(1);
    expect(ended).toBe(false); // still playing its real audio
    await vi.advanceTimersByTimeAsync(7000);
    expect(ended).toBe(true);
    FakeAudio.clipMs = 1000;
  });

  it("a stopped line doesn't detach the handlers of the line that replaced it", async () => {
    vi.stubGlobal("fetch", vi.fn(okFetch));
    const { speak } = await import("./player");
    const one = speak("Bir.", "ziyo");
    one.stop();
    const two = speak("Ikki.", "ziyo");
    one.stop(); // late / repeated stop of the old line
    let ended = false;
    void two.ended.then(() => (ended = true));
    await vi.advanceTimersByTimeAsync(1100);
    expect(ended).toBe(true);
  });
});
