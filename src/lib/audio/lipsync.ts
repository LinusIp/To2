// Mouth amplitude (0..1) shared between the audio player and the character.
// A plain mutable object read in requestAnimationFrame — no React re-renders per frame.
export const mouth = { amp: 0, speaking: false };

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let data: Uint8Array<ArrayBuffer> | null = null;
let raf = 0;
let fakeT = 0;

/** Connect an <audio> element once (must be called after a user gesture on iOS). */
export function attachAnalyser(el: HTMLAudioElement) {
  if (analyser || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    const src = ctx.createMediaElementSource(el);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    data = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    src.connect(analyser);
    analyser.connect(ctx.destination);
  } catch (e) {
    console.warn("[lipsync] analyser unavailable, using fake mouth", e);
    analyser = null;
  }
}

export function resumeAudioContext() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** Start the amplitude loop. `fake` = no real audio (fallback) → synthetic talking. */
export function startMouth(fake = false) {
  mouth.speaking = true;
  cancelAnimationFrame(raf);
  const tick = () => {
    if (!mouth.speaking) {
      mouth.amp = 0;
      return;
    }
    if (!fake && analyser && data) {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      mouth.amp = Math.min(1, rms * 4.5);
    } else {
      fakeT += 0.25;
      mouth.amp = 0.35 + 0.35 * Math.abs(Math.sin(fakeT) * Math.sin(fakeT * 0.37 + 1));
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

export function stopMouth() {
  mouth.speaking = false;
  mouth.amp = 0;
  cancelAnimationFrame(raf);
}
