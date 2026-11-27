"use client";
// "Qahramonlar" (prototype screen 4), 25 Nov report C5–C7:
// - hero = the selected tutor, FULL BODY, in a flat classroom (wall · chalkboard with the name in chalk · wood floor);
//   no gradient wash. The greeting bubble sits BESIDE the tutor's head (left of it), never over the face.
//   The hero's tutor is #4's live 3D <TutorHero/> (idle · waves on select · lip-sync to the greeting); it shows
//   the full-body portrait until the model draws or if WebGL fails. Only the hero has a canvas: grid = portraits.
// - "Ustozlar": the other selectable tutors (the selected one is not repeated — it is the hero).
// - "Tez orada": locked tutors as a small row; a tap shakes the card and plays its greeting (static file or
//   captions only — greet() never asks /api/tts for a line that isn't cached), the words shown under the row.
import { useEffect, useRef, useState } from "react";
import { CHARACTERS, CHARACTER_BY_ID, getCharacter, isUnlocked, lockText, type CharacterConfig, type CharacterId } from "@/config/characters";
import { speak, unlockAudio, type Speech } from "@/lib/audio/player";
import { greetingApiAllowed, greetingClip } from "@/lib/audio/greetings";
import { readPref } from "@/lib/client/prefs";
import { t } from "@/i18n/uz";
import TutorPortrait from "./TutorPortrait";
import TutorHero from "./TutorHero";
import { LockIcon, SpeakerIcon } from "@/components/ui/icons";
import { Burst } from "@/components/ui/Celebrate";


export default function TutorPicker({ value, onChange, xp, streak }: { value: CharacterId; onChange: (id: CharacterId) => void; xp: number; streak: number }) {
  const sel = getCharacter(value);
  const [shake, setShake] = useState<string | null>(null);
  const [bump, setBump] = useState(0);
  /** the greeting being said now (shown in a bubble until it ends) */
  const [saying, setSaying] = useState<{ id: string; text: string } | null>(null);
  /** the Speech of the greeting playing now — the hero's mouth follows it */
  const [speech, setSpeech] = useState<{ id: string; s: Speech } | null>(null);
  const current = useRef<Speech | null>(null);
  const turn = useRef(0);

  // the selected tutor's greeting file loads ahead, so a tap plays at once
  useEffect(() => {
    void greetingClip(value);
  }, [value]);
  useEffect(() => () => current.current?.stop(), []);

  /** Say tutor `id`'s greeting. Called from a tap, so audio is allowed; a newer tap stops the older one. */
  const greet = (id: CharacterId) => {
    // CHARACTER_BY_ID, not getCharacter(): that one falls back to Blokbek for "Tez orada" tutors
    const c = CHARACTER_BY_ID[id] ?? getCharacter(id);
    unlockAudio();
    current.current?.stop();
    current.current = null;
    setSpeech(null);
    const my = ++turn.current;
    setSaying({ id: c.id, text: c.hi });
    const start = (s: Speech) => {
      if (my !== turn.current) return s.stop();
      current.current = s;
      setSpeech({ id: c.id, s });
      void s.ended.then(() => {
        if (my !== turn.current) return;
        setSaying(null);
        setSpeech(null);
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
  const talking = saying !== null && saying.id === sel.id;
  const bubble = talking ? saying.text : null;

  const open = CHARACTERS.filter((c) => c.status !== "soon" && isUnlocked(c.id, xp, streak));
  const others = open.filter((c) => c.id !== sel.id);
  const locked = CHARACTERS.filter((c) => !open.includes(c));
  const lockedSaying = saying && locked.some((c) => c.id === saying.id) ? CHARACTER_BY_ID[saying.id as CharacterId] : null;
  const nameOf = (c: CharacterConfig) => (c.status !== "soon" && c.unlock === "streak" && !isUnlocked(c.id, xp, streak) ? "???" : c.name);

  const pick = (id: CharacterId) => {
    onChange(id);
    setBump((b) => b + 1);
    greet(id);
  };
  const tapLocked = (id: CharacterId) => {
    setShake(id);
    setTimeout(() => setShake(null), 350);
    greet(id);
  };

  return (
    <div>
      {/* hero: flat classroom, full-body tutor on the right, bubble beside the head */}
      <section aria-label={`${t.tutors.title}: ${sel.name}`} className="relative h-[300px] overflow-hidden rounded-[32px] bg-[#e7edf9] shadow-[0_4px_0_#c9d3ea,0_12px_28px_rgba(31,54,120,.14)]" data-testid="tutor-hero">
        {/* chalkboard with the tutor's name in chalk */}
        <div aria-hidden className="absolute top-3 left-3 h-[150px] w-[58%] rounded-[14px] border-[5px] border-[#8a5a2c] bg-chalkboard px-3 pt-2.5 shadow-[0_3px_0_#5e3c1c]">
          <div className="font-chalk text-[30px] leading-none text-chalk">{sel.name}</div>
          <div className="mt-1.5 font-chalk text-[17px] leading-tight text-chalk-yellow">{sel.tag}</div>
        </div>
        {/* wood floor */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[64px] border-t-4 border-[#a87442] bg-[#c08a55]" />
        <Burst fire={bump} count={14} />
        <div className="absolute right-[-14px] bottom-[8px] h-[272px] w-[204px]" data-testid="hero-tutor">
          <TutorHero id={value} speaking={speech?.id === sel.id ? speech.s : null} wave={bump} className="h-full w-full" />
        </div>
        <h2 className="sr-only">{`${sel.name} — ${sel.tag}`}</h2>
        <div aria-live="polite" className="absolute top-3 left-3 w-[58%]">
          {bubble && (
            <p key={bubble} className="bounce-in relative m-0 rounded-2xl bg-white px-3.5 py-2.5 text-[15px] leading-snug font-extrabold text-ink shadow-[0_4px_0_rgba(0,0,0,.12),0_10px_22px_rgba(20,26,58,.22)]" data-testid="greeting-bubble">
              {/* tail points right, at the tutor's head */}
              <span aria-hidden className="absolute top-5 -right-2 h-4 w-4 rotate-45 rounded-[3px] bg-white" />
              <span className="relative">{bubble}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => greet(sel.id)}
          className="absolute bottom-3 left-3 flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-black text-blue-800 shadow-[0_4px_0_#8a5a2c] transition-transform duration-100 active:translate-y-[4px] active:shadow-none"
        >
          <SpeakerIcon size={16} /> {talking ? "…" : t.tutors.hear}
        </button>
      </section>

      {/* the other selectable tutors (the hero is the selected one) */}
      {others.length > 0 && (
        <div className="stagger mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label={t.tutors.title} data-testid="tutor-grid">
          {others.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={false}
              aria-label={`${c.name}, ${c.tag}`}
              onClick={() => pick(c.id)}
              className="card-press relative flex h-[176px] flex-col items-center justify-end overflow-hidden rounded-[24px] bg-[#eef3ff] shadow-[var(--shadow-1)]"
            >
              <TutorPortrait id={c.id} pose="sig" frame="half" alt={c.name} className="absolute top-0.5 left-1/2 h-[140px] w-[140px] -translate-x-1/2" />
              <div className="relative w-full bg-white px-1.5 pt-1.5 pb-2.5 text-center">
                <b className="block text-[16px] font-black">{c.name}</b>
                <span className="t-caption text-mut">{c.tag}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* locked tutors: a small row, tap = shake + greeting */}
      {locked.length > 0 && (
        <div className="mt-5">
          <h2 className="t-h3 m-0 mb-2.5 flex items-center gap-2">
            <LockIcon size={14} /> {t.tutors.soon}
          </h2>
          <div className="no-scrollbar -mx-[18px] flex gap-2.5 overflow-x-auto px-[18px] pb-2 md:mx-0 md:px-0" data-testid="tutor-locked">
            {locked.map((c) => {
              const name = nameOf(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`${name}, yopiq: ${lockText(c, xp)}. Salomini eshitish`}
                  onClick={() => tapLocked(c.id)}
                  className={`relative flex h-[132px] w-[104px] flex-none flex-col items-center justify-end overflow-hidden rounded-[20px] bg-[#eceff6] ${saying?.id === c.id ? "shadow-[0_0_0_3px_var(--color-blue)]" : "shadow-[var(--shadow-1)]"}`}
                  style={shake === c.id ? { animation: "shake .35s" } : undefined}
                >
                  <TutorPortrait id={c.id} pose="sig" frame="half" alt="" className="absolute top-0 left-1/2 h-[96px] w-[96px] -translate-x-1/2" style={{ opacity: 0.55, filter: "saturate(.5)" }} />
                  <div className="relative w-full bg-white px-1 pt-1 pb-1.5 text-center">
                    <b className="block truncate text-[13px] font-black">{name}</b>
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-mut">
                      <LockIcon size={9} /> {lockText(c, xp)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div aria-live="polite" className="min-h-[24px]">
            {lockedSaying && (
              <p key={lockedSaying.id} className="bounce-in m-0 rounded-2xl bg-white px-3.5 py-2.5 text-[14px] leading-snug font-extrabold text-ink shadow-[var(--shadow-1)]" data-testid="card-greeting-bubble">
                <span className="text-blue-700">{nameOf(lockedSaying)}:</span> {lockedSaying.hi}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
