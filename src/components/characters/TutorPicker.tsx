"use client";
// "Qahramonlar" (prototype screen 4): big hero card for the selected tutor + 2-column grid.
// Locked tutors are silhouettes with their unlock condition. "Ovozini eshit" plays the tutor's voice.
import { useState } from "react";
import { CHARACTERS, getCharacter, isUnlocked, lockText, type CharacterId } from "@/config/characters";
import { speak, unlockAudio } from "@/lib/audio/player";
import { t } from "@/i18n/uz";
import TutorPortrait from "./TutorPortrait";
import { CheckIcon, LockIcon, SpeakerIcon } from "@/components/ui/icons";
import { Burst } from "@/components/ui/Celebrate";

export default function TutorPicker({ value, onChange, xp, streak }: { value: CharacterId; onChange: (id: CharacterId) => void; xp: number; streak: number }) {
  const sel = getCharacter(value);
  const [shake, setShake] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const [bump, setBump] = useState(0);

  const hear = () => {
    unlockAudio();
    setTalking(true);
    const s = speak(sel.hi, sel.id, { emotion: "happy" });
    void s.ended.then(() => setTalking(false));
  };

  return (
    <div>
      <div className="relative h-[260px] overflow-hidden rounded-[32px] shadow-[0_6px_0_var(--color-blue-800),0_16px_32px_rgba(37,99,235,.3)]" style={{ background: "radial-gradient(90% 70% at 50% 30%, #8fb6ff 0%, rgba(143,182,255,0) 70%), linear-gradient(160deg,#5b8cff,#2563eb)" }}>
        <div aria-hidden className="absolute inset-0 opacity-[.12]" style={{ backgroundImage: "radial-gradient(#fff 1.5px, transparent 1.5px)", backgroundSize: "18px 18px" }} />
        <Burst fire={bump} count={14} />
        <div key={`${value}-${bump}`} className="bounce-in absolute top-3 left-1/2 -translate-x-1/2">
          <TutorPortrait id={value} pose="sig" frame="half" className="h-[250px] w-[250px]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 px-3.5 pt-8 pb-3.5 text-center text-white" style={{ background: "linear-gradient(to top, rgba(29,78,216,.97) 55%, rgba(29,78,216,0))" }}>
          <div className="t-h2">{sel.name}</div>
          <div className="t-small opacity-95">{sel.tag}</div>
        </div>
        <button
          type="button"
          onClick={hear}
          className="absolute top-3 right-3 flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-black text-blue-800 shadow-[0_4px_0_#b9c6ea] transition-transform duration-100 active:translate-y-[4px] active:shadow-none"
        >
          <SpeakerIcon size={16} /> {talking ? "…" : t.tutors.hear}
        </button>
        <div key={`ok-${value}`} className="bounce-in absolute right-4 bottom-[22px] grid h-[32px] w-[32px] place-items-center rounded-full bg-white shadow-[0_3px_0_rgba(0,0,0,.18)]">
          <CheckIcon color="#2563eb" />
        </div>
      </div>

      <div className="stagger mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label={t.tutors.title}>
        {CHARACTERS.map((c) => {
          const soon = c.status === "soon";
          const open = isUnlocked(c.id, xp, streak);
          const secret = !soon && c.unlock === "streak" && !open;
          const on = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={soon}
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
              className={`card-press relative flex h-[190px] flex-col items-center justify-end overflow-hidden rounded-[24px] ${on ? "shadow-[0_0_0_3px_var(--color-blue),0_4px_0_3px_var(--color-blue-800),0_10px_22px_rgba(37,99,235,.25)]" : "shadow-[var(--shadow-1)]"}`}
              style={{ background: open || soon ? "linear-gradient(180deg,#e4ecff 0%,#fff 72%)" : "linear-gradient(180deg,#e7e9f2 0%,#fff 72%)", ...(shake === c.id ? { animation: "shake .35s" } : {}) }}
            >
              {/* "sig" art = the cut-outs that match the 3D models; MVP "soon" tutors keep their colours, dimmed */}
              <TutorPortrait
                id={c.id}
                pose="sig"
                frame="half"
                alt={c.name}
                locked={!open && !soon}
                className="absolute top-0.5 left-1/2 h-[150px] w-[150px] -translate-x-1/2"
                style={soon ? { opacity: 0.5, filter: "saturate(.6)" } : undefined}
              />
              {soon && <span className="absolute top-2.5 left-2.5 rounded-full bg-ink px-2.5 py-1 text-[11px] font-black text-white">{t.tutors.soon}</span>}
              <div className="relative w-full px-1.5 pt-7 pb-2.5 text-center" style={{ background: "linear-gradient(to top,#fff 62%,rgba(255,255,255,0))" }}>
                <b className="block text-[16px] font-black">{secret ? "???" : c.name}</b>
                <span className="t-caption inline-flex items-center gap-1 text-mut">
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
                <span className="bounce-in absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-blue text-white shadow-[0_2px_0_var(--color-blue-800)]">
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
