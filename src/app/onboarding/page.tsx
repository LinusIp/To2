"use client";
// One screen: nickname (optional) → grade → tutor. Defaults are pre-filled so it is ONE tap to continue.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Volume2 } from "lucide-react";
import { t } from "@/i18n/uz";
import { brand } from "@/config/brand";
import { CHARACTERS, getCharacter, type CharacterId } from "@/config/characters";
import Character from "@/components/characters/Character";
import { speak, unlockAudio } from "@/lib/audio/player";
import { useMe } from "@/lib/client/me";
import type { PublicUser } from "@/lib/server/repo";

export default function Onboarding() {
  const router = useRouter();
  const { user, load, setUser } = useMe();
  const [nick, setNick] = useState("");
  const [grade, setGrade] = useState(6);
  const [ch, setCh] = useState<CharacterId>("blokbek");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);

  useEffect(() => {
    void load().then((u) => {
      if (u) {
        setNick(u.nickname);
        setGrade(u.grade);
        setCh(u.characterId as CharacterId);
      }
    });
  }, [load]);

  const sel = getCharacter(ch);

  const preview = () => {
    unlockAudio();
    setTalking(true);
    const s = speak(`Salom! Men ${sel.name}. ${sel.catchphrases_uz[0]}`, ch);
    void s.ended.then(() => setTalking(false));
  };

  const submit = async (skipDiagnostic: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: nick.trim() || "Mehmon", grade, characterId: ch }),
      });
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { user: PublicUser };
      setUser(j.user);
      if (skipDiagnostic) {
        await load(true);
        const cur = useMe.getState().roadmap?.currentId ?? (grade <= 5 ? "frac-add-like" : "frac-add-unlike");
        router.push(`/lesson/${cur}`);
      } else router.push("/diagnostic");
    } catch {
      setErr(t.common.error);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-4 bg-paper px-4 pt-4 pb-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="font-pixel text-[28px] font-bold no-underline">
          {brand.name}
        </Link>
        {user && (
          <Link href="/roadmap" className="text-[14px] font-extrabold">
            {t.nav.roadmapLong} →
          </Link>
        )}
      </div>

      <h1 className="m-0 font-pixel text-[28px] leading-[1.1] font-bold">{t.onboarding.characterTitle}</h1>

      {/* hero preview of the selected tutor */}
      <div className="relative flex h-[250px] flex-none items-end overflow-hidden rounded-[20px] border-[3px] border-ink shadow-[4px_4px_0_#1b1a17]" style={{ background: sel.world }}>
        {/* ground blocks */}
        <div className="absolute inset-x-0 bottom-0 h-8 border-t-[3px] border-ink bg-grass" />
        <div className="relative z-10 ml-3">
          <Character id={ch} size={130} state={talking ? "talking" : "happy"} fakeTalk={false} />
        </div>
        <div className="absolute top-3 right-3 z-10 flex w-[52%] flex-col gap-2 rounded-2xl border-[3px] border-ink bg-white p-3">
          <div className="font-pixel text-[22px] leading-none font-bold">{sel.name}</div>
          <div className="text-[13px] leading-[1.35] font-bold text-muted">{sel.vibe}. {sel.catchphrases_uz[0]}</div>
          <button type="button" className="btn h-10 text-[13px]" onClick={preview}>
            <Volume2 size={16} aria-hidden /> Ovozini eshit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t.onboarding.characterTitle}>
        {CHARACTERS.map((c) => {
          const locked = c.unlockXp > (user?.xp ?? 0);
          const on = c.id === ch;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={locked}
              onClick={() => setCh(c.id)}
              title={locked ? t.onboarding.locked(c.unlockXp) : c.name}
              className={`flex h-[112px] flex-col items-center justify-end gap-1 overflow-hidden rounded-2xl border-[3px] pb-1.5 text-[11px] font-extrabold ${
                on ? "border-ink bg-gold shadow-[3px_3px_0_#1b1a17]" : locked ? "border-locked-ink bg-locked text-muted" : "border-ink bg-white"
              }`}
            >
              <div style={{ filter: locked ? "brightness(0) opacity(0.35)" : undefined }}>
                <Character id={c.id} size={44} state="idle" />
              </div>
              {locked ? (
                <span className="flex items-center gap-0.5">
                  <Lock size={11} aria-hidden /> {c.unlockXp} XP
                </span>
              ) : (
                c.name
              )}
            </button>
          );
        })}
      </div>

      <div>
        <div id="grade" className="mb-2 text-[15px] font-extrabold">
          {t.onboarding.gradeTitle}
        </div>
        <div role="radiogroup" aria-labelledby="grade" className="grid grid-cols-5 gap-2">
          {[5, 6, 7, 8, 9].map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={grade === g}
              onClick={() => setGrade(g)}
              className={`h-12 rounded-[14px] border-[3px] border-ink font-pixel text-[20px] font-bold ${grade === g ? "bg-gold shadow-[3px_3px_0_#1b1a17]" : "bg-white"}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[15px] font-extrabold">{t.onboarding.nicknameTitle}</span>
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value.slice(0, 24))}
          placeholder={t.onboarding.nicknamePlaceholder}
          className="h-12 rounded-xl border-[3px] border-ink bg-white px-3 text-[16px] font-bold"
          autoComplete="off"
        />
        <span className="text-[12px] font-bold text-muted">{t.onboarding.nicknameHint}</span>
      </label>

      {err && (
        <div role="alert" className="rounded-xl border-[3px] border-ink bg-cream px-3 py-2 text-[14px] font-extrabold">
          {err}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2.5 pt-2">
        <button type="button" className="btn btn-primary h-[60px] text-[19px]" disabled={busy} onClick={() => void submit(false)}>
          {t.onboarding.finish} <ArrowRight size={20} aria-hidden />
        </button>
        <button type="button" className="btn h-12 text-[15px]" disabled={busy} onClick={() => void submit(true)}>
          {t.onboarding.skipDiagnostic}
        </button>
        <p className="m-0 text-center text-[12px] font-bold text-muted">
          {t.onboarding.consent}{" "}
          <Link href="/maxfiylik" className="underline">
            {t.onboarding.consentLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
