"use client";
// Demo for <TutorHero>: pick a tutor (it waves), make it talk, toggle calm mode.
// "Gapir" plays the greeting MUTED (captions-only path): the mouth follows the caption text the same way
// it does for an uncached line, and no TTS is requested — 0 VoiceLab credits.
import { useState } from "react";
import TutorHero from "@/components/characters/TutorHero";
import { CHARACTER_BY_ID, type CharacterId } from "@/config/characters";
import { speak, type Speech } from "@/lib/audio/player";
import { useA11y } from "@/lib/a11y/settings";

const IDS: CharacterId[] = ["blokbek", "lola", "ziyo"];

export default function DevHero() {
  const [id, setId] = useState<CharacterId>("blokbek");
  const [wave, setWave] = useState(0);
  const [speech, setSpeech] = useState<Speech | null>(null);
  const calm = useA11y((s) => s.calm);

  const talk = () => {
    speech?.stop();
    const s = speak(CHARACTER_BY_ID[id].hi, id, { muted: true });
    setSpeech(s);
    void s.ended.then(() => setSpeech((cur) => (cur === s ? null : cur)));
  };

  const btn = "rounded-full bg-white px-3.5 py-2 text-[14px] font-bold shadow-[0_2px_8px_rgba(0,0,0,.1)]";
  return (
    <main className="mx-auto max-w-[480px] p-4">
      <h1 className="mb-3 text-[18px] font-black">TutorHero</h1>
      <div className="mb-3 flex flex-wrap gap-2">
        {IDS.map((c) => (
          <button
            key={c}
            type="button"
            data-testid={`pick-${c}`}
            className={`${btn} ${c === id ? "!bg-blue text-white" : ""}`}
            onClick={() => {
              speech?.stop();
              setId(c);
              setWave((w) => w + 1); // waves on select
            }}
          >
            {CHARACTER_BY_ID[c].name}
          </button>
        ))}
      </div>
      <div className="rounded-[24px] p-3" style={{ background: "linear-gradient(160deg,#6aa0ff,#3a72ff)" }}>
        <TutorHero id={id} speaking={speech} wave={wave} className="mx-auto w-[240px]" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" data-testid="hero-wave" className={btn} onClick={() => setWave((w) => w + 1)}>
          Qo&apos;l silkit
        </button>
        <button type="button" data-testid="hero-talk" className={btn} onClick={talk}>
          {speech ? "…" : "Gapir"}
        </button>
        <button type="button" data-testid="hero-calm" className={btn} onClick={() => useA11y.getState().set({ calm: !calm })}>
          Calm: {calm ? "on" : "off"}
        </button>
      </div>
      <p className="mt-2 text-[13px] text-mut">{speech ? CHARACTER_BY_ID[id].hi : " "}</p>
    </main>
  );
}
