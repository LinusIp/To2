"use client";
// "Qahramonlar" (prototype screen 4): big hero card for the selected tutor + 2-column grid.
// Locked tutors are silhouettes with their unlock condition. "Ovozini eshit" plays the tutor's voice.
import { useState } from "react";
import { CHARACTERS, getCharacter, isUnlocked, lockText, type CharacterId } from "@/config/characters";
import { speak, unlockAudio } from "@/lib/audio/player";
import { t } from "@/i18n/uz";
import TutorPortrait from "./TutorPortrait";
import { CheckIcon, LockIcon, SpeakerIcon } from "@/components/ui/icons";

export default function TutorPicker({ value, onChange, xp, streak }: { value: CharacterId; onChange: (id: CharacterId) => void; xp: number; streak: number }) {
  const sel = getCharacter(value);
  const [shake, setShake] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const [bump, setBump] = useState(0);

  const hear = () => {
    unlockAudio();
    setTalking(true);
    const s = speak(sel.hi, sel.id);
    void s.ended.then(() => setTalking(false));
  };

  return (
    <div>
      <div className="relative h-[250px] overflow-hidden rounded-[24px] shadow-[0_0_0_3px_#2f6bff,0_12px_26px_rgba(47,107,255,.3)]" style={{ background: "linear-gradient(160deg,#6aa0ff,#3a72ff)" }}>
        <div key={`${value}-${bump}`} className="anim-in absolute top-3 left-1/2 -translate-x-1/2">
          <TutorPortrait id={value} pose="wave" frame="half" className="h-[250px] w-[250px]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 px-3.5 pt-8 pb-3.5 text-center text-white" style={{ background: "linear-gradient(to top, rgba(36,84,220,.95) 55%, rgba(36,84,220,0))" }}>
          <div className="text-[24px] font-black">{sel.name}</div>
          <div className="text-[13px] font-bold opacity-90">{sel.tag}</div>
        </div>
        <button
          type="button"
          onClick={hear}
          className="absolute top-3 right-3 flex h-10 items-center gap-2 rounded-full bg-white/95 px-3.5 text-[13px] font-black text-ink shadow-[0_4px_12px_rgba(0,0,0,.15)]"
        >
          <SpeakerIcon size={16} /> {talking ? "…" : t.tutors.hear}
        </button>
        <div className="absolute right-4 bottom-[22px] grid h-[30px] w-[30px] place-items-center rounded-full bg-white shadow-[0_4px_10px_rgba(0,0,0,.15)]">
          <CheckIcon color="#2f6bff" />
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label={t.tutors.title}>
        {CHARACTERS.map((c) => {
          const open = isUnlocked(c.id, xp, streak);
          const secret = c.unlock === "streak" && !open;
          const on = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={open ? `${c.name}, ${c.tag}` : `${secret ? t.tutors.secret : c.name}, yopiq: ${lockText(c, xp)}`}
              onClick={() => {
                if (!open) {
                  setShake(c.id);
                  setTimeout(() => setShake(null), 350);
                  return;
                }
                onChange(c.id);
                setBump((b) => b + 1);
              }}
              className={`relative flex h-[190px] flex-col items-center justify-end overflow-hidden rounded-[20px] bg-white ${on ? "shadow-[0_0_0_3px_#2f6bff,0_8px_20px_rgba(47,107,255,.25)]" : "shadow-[0_6px_18px_rgba(31,54,120,.08)]"}`}
              style={shake === c.id ? { animation: "shake .35s" } : undefined}
            >
              <TutorPortrait id={c.id} pose="idle" frame="half" locked={!open} className="absolute top-0.5 left-1/2 h-[150px] w-[150px] -translate-x-1/2" />
              <div className="relative w-full px-1.5 pt-7 pb-2.5 text-center" style={{ background: "linear-gradient(to top,#fff 62%,rgba(255,255,255,0))" }}>
                <b className="block text-[16px] font-black">{secret ? "???" : c.name}</b>
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-mut">
                  {open ? (
                    c.tag
                  ) : (
                    <>
                      <LockIcon size={11} /> {lockText(c, xp)}
                    </>
                  )}
                </span>
              </div>
              {on && (
                <span className="absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-blue text-white">
                  <CheckIcon size={14} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
