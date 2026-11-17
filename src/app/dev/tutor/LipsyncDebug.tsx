"use client";
// Dev-only lip-sync overlay for /dev/tutor: plays a real (cached) voice line of the selected tutor
// and shows, over the last ~4 s: the amplitude fed to the mouth (envelope), the live level of what the
// speakers actually play (AnalyserNode), the rig's mouth frame — and the audio→mouth offset, found by
// cross-correlating "audible" with "mouth open" over ±200 ms (target: within ±40 ms).
import { useEffect, useRef, useState } from "react";
import { speak, unlockAudio, type Speech } from "@/lib/audio/player";
import { lipTrace, mouth, setLipTrace } from "@/lib/audio/lipsync";

const LINES: Record<string, { text: string; emotion: string }[]> = {
  blokbek: [
    { text: "Salom! Men Blokbek. Matematikani blokma-blok quramiz!", emotion: "happy" },
    { text: "Barakalla! Ikkita oltidan bir. Pushti bloklar ham olti bo'lakka bo'lindi.", emotion: "happy" },
  ],
  lola: [
    { text: "Salom, men Lola. Xato qilsang ham qo'rqma — birga tushunamiz.", emotion: "happy" },
    { text: "Barakalla! Ikkita oltidan bir. Pushti bloklar ham olti bo'lakka bo'lindi.", emotion: "happy" },
  ],
  ziyo: [
    { text: "Men Ziyo! Doim so'rayman: nega? Keling, birga bilib olamiz!", emotion: "happy" },
    { text: "Barakalla! Ikkita oltidan bir. Pushti bloklar ham olti bo'lakka bo'lindi.", emotion: "happy" },
  ],
};

type Sample = { t: number; amp: number; live: number; frame: number };

/** lag (ms) that best aligns mouth-open with audible; > 0 = the mouth leads the audio */
export function estimateOffset(samples: Sample[]): { lagMs: number; corr: number } | null {
  const pts = samples.filter((s) => s.live >= 0);
  if (pts.length < 60) return null;
  const t0 = pts[0].t;
  const step = 5;
  const n = Math.floor((pts[pts.length - 1].t - t0) / step);
  if (n < 50) return null;
  // resample both signals on a 5 ms grid
  const audible = new Float32Array(n);
  const open = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * step;
    while (j < pts.length - 1 && pts[j + 1].t <= t) j++;
    audible[i] = pts[j].live;
    open[i] = pts[j].frame > 0 ? 1 : 0;
  }
  const mean = (a: Float32Array) => a.reduce((x, y) => x + y, 0) / a.length;
  const ma = mean(audible);
  const mo = mean(open);
  let best = { lagMs: 0, corr: -Infinity };
  for (let lag = -40; lag <= 40; lag++) {
    // positive lag: compare open[i] with audible[i + lag] (mouth earlier than sound)
    let c = 0, va = 0, vo = 0;
    for (let i = Math.max(0, -lag); i < Math.min(n, n - lag); i++) {
      const a = audible[i + lag] - ma;
      const o = open[i] - mo;
      c += a * o;
      va += a * a;
      vo += o * o;
    }
    const r = c / Math.sqrt(va * vo || 1);
    if (r > best.corr) best = { lagMs: lag * step, corr: r };
  }
  return best;
}

export default function LipsyncDebug({ tutor, onVoice }: { tutor: string; onVoice: (on: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const samples = useRef<Sample[]>([]);
  const [info, setInfo] = useState({ frame: -1, source: "none", lag: "—" });
  const sp = useRef<Speech | null>(null);

  useEffect(() => {
    setLipTrace(true);
    let raf = 0;
    let lastInfo = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const rig = (window as unknown as { __tutor?: { ch?: { mouth?: number } } }).__tutor?.ch;
      const frame = rig?.mouth ?? -1;
      const live = lipTrace.live.length ? lipTrace.live[lipTrace.live.length - 1] : -1;
      const s = samples.current;
      if (mouth.speaking) s.push({ t: now, amp: mouth.amp, live, frame });
      while (s.length && now - s[0].t > 4000) s.shift();
      const c = canvas.current?.getContext("2d");
      if (c && canvas.current) {
        const W = canvas.current.width;
        const H = canvas.current.height;
        c.clearRect(0, 0, W, H);
        c.fillStyle = "#0f1424";
        c.fillRect(0, 0, W, H);
        const x = (t: number) => W - ((now - t) / 4000) * W;
        const line = (k: "amp" | "live", color: string) => {
          c.strokeStyle = color;
          c.lineWidth = 2;
          c.beginPath();
          s.forEach((p, i) => {
            const v = k === "amp" ? p.amp : Math.max(0, p.live);
            const y = H * 0.62 - v * H * 0.55;
            if (i) c.lineTo(x(p.t), y);
            else c.moveTo(x(p.t), y);
          });
          c.stroke();
        };
        line("live", "#4ade80"); // audible level
        line("amp", "#ffc83d"); // fed to the mouth (envelope, 30 ms ahead)
        // mouth frame strip
        for (let i = 1; i < s.length; i++) {
          const f = s[i].frame;
          c.fillStyle = f < 0 ? "#2a3150" : ["#4b5a8f", "#6f88d9", "#2f6bff", "#9fb8ff"][f] ?? "#fff";
          c.fillRect(x(s[i - 1].t), H * 0.72, Math.max(1, x(s[i].t) - x(s[i - 1].t)), H * 0.2);
        }
      }
      if (now - lastInfo > 250) {
        lastInfo = now;
        const off = estimateOffset(samples.current);
        setInfo({ frame, source: mouth.source, lag: off ? `${off.lagMs > 0 ? "+" : ""}${off.lagMs} ms (r=${off.corr.toFixed(2)})` : "—" });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setLipTrace(false);
      sp.current?.stop();
    };
  }, []);

  const play = (i: number) => {
    unlockAudio();
    sp.current?.stop();
    samples.current = [];
    onVoice(true);
    const l = (LINES[tutor] ?? LINES.blokbek)[i];
    sp.current = speak(l.text, tutor, { emotion: l.emotion });
    void sp.current.ended.then(() => onVoice(false));
  };

  return (
    <section className="mt-3 rounded-[16px] bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,.08)]" data-testid="lipsync-debug">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] font-bold">
        <span className="font-black">Lip-sync</span>
        <button type="button" className="rounded-full bg-blue px-3 py-1.5 text-white" onClick={() => play(0)}>
          ▶ greeting (real voice)
        </button>
        <button type="button" className="rounded-full bg-blue px-3 py-1.5 text-white" onClick={() => play(1)}>
          ▶ lesson line
        </button>
        <span className="font-mono" data-testid="lip-frame">
          frame {info.frame}
        </span>
        <span className="font-mono">source {info.source}</span>
        <span className="font-mono" data-testid="lip-offset">
          mouth vs audio: {info.lag}
        </span>
      </div>
      <canvas ref={canvas} width={1000} height={140} className="h-[140px] w-full rounded-[10px]" />
      <div className="mt-1 text-[12px] text-mut">
        green = audible (analyser) · yellow = fed to the mouth (envelope, read 45 ms ahead) · strip = mouth frame (dark = rest). Offset &gt; 0 means the mouth leads.
      </div>
    </section>
  );
}
