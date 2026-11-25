"use client";
// "Qahramonlar" (prototype screen 4): big hero card for the selected tutor + 2-column grid.
// Locked tutors are silhouettes with their unlock condition. Tapping a tutor (or "Ovozini eshit") plays its
// greeting; the words are always shown in a speech bubble (captions-only when muted or without audio).
import { useEffect, useRef, useState } from "react";
import { CHARACTERS, getCharacter, isUnlocked, lockText, type CharacterId } from "@/config/characters";
import { speak, unlockAudio, type Speech } from "@/lib/audio/player";
import { greetingApiAllowed, greetingClip } from "@/lib/audio/greetings";
import { readPref } from "@/lib/client/prefs";
import { t } from "@/i18n/uz";
import TutorPortrait from "./TutorPortrait";
import { CheckIcon, LockIcon, SpeakerIcon } from "@/components/ui/icons";
import { Burst } from "@/components/ui/Celebrate";

export default function TutorPicker({ value, onChange, xp, streak }: { value: CharacterId; onChange: (id: CharacterId) => void; xp: number; streak: number }) {
  const sel = getCharacter(value);
  const [shake, setShake] = useState<string | null>(null);
  const [bump, setBump] = useState(0);
  /** the greeting being said now (shown in the bubble until it ends) */
  const [saying, setSaying] = useState<{ id: string; text: string } | null>(null);
  const current = useRef<Speech | null>(null);
  const turn = useRef(0);

  // the selected tutor's greeting file loads ahead, so a tap plays at once
  useEffect(() => {
    void greetingClip(value);
  }, [value]);
  useEffect(() => () => current.current?.stop(), []);

  /** Say tutor `id`'s greeting. Called from a tap, so audio is allowed; a newer tap stops the older one. */
  const greet = (id: CharacterId) => {
    const c = getCharacter(id);
    unlockAudio();
    current.current?.stop();
    current.current = null;
    const my = ++turn.current;
    setSaying({ id: c.id, text: c.hi });
    const start = (s: Speech) => {
      if (my !== turn.current) return s.stop();
      current.current = s;
      void s.ended.then(() => {
        if (my === turn.current) setSaying(null);
      });
    };
    if (readPref("sound", "1") === "0") return start(speak(c.hi, c.id, { muted: true }));
    void greetingClip(c.id).then((clip) => {
      if (my !== turn.current) return;
      if (clip) start(speak(c.hi, c.id, { clip }));
      else if (greetingApiAllowed(c.id)) start(speak(c.hi, c.id, { emotion: "happy" }));
      else start(speak(c.hi, c.id, { muted: true })); // uncached voice: captions only, never generate here
    });
  };
  const talking = saying !== null;
  const bubble = saying && saying.id === sel.id ? saying.text : null;

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
        <div aria-live="polite" className="absolute inset-x-3 bottom-[76px] flex justify-center">
          {bubble && (
            <p key={bubble} className="bounce-in relative m-0 max-w-[300px] rounded-2xl bg-white px-4 py-2.5 text-center text-[15px] leading-snug font-extrabold text-ink shadow-[0_4px_0_rgba(0,0,0,.12),0_10px_22px_rgba(20,26,58,.22)]" data-testid="greeting-bubble">
              <span aria-hidden className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 rounded-[3px] bg-white" />
              <span className="relative">{bubble}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => greet(sel.id)}
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
                greet(c.id);
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
