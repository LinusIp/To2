"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Award, Check, Lock } from "lucide-react";
import { t } from "@/i18n/uz";
import AppShell from "@/components/ui/AppShell";
import Character from "@/components/characters/Character";
import { Flame, LevelRow } from "@/components/ui/hud";
import { CHARACTERS, getCharacter, isUnlocked, type CharacterId } from "@/config/characters";
import { useMe } from "@/lib/client/me";
import { SKILL_BY_ID } from "@/data/skills";
import { MASTERED } from "@/lib/learning/mastery";

export default function ProfilePage() {
  const router = useRouter();
  const { user, mastery, lessonsFinished, load, setUser } = useMe();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void load(true).then((u) => {
      if (!u) router.replace("/onboarding");
    });
  }, [load, router]);

  if (!user) return <AppShell><div className="p-6 font-pixel">{t.common.loading}</div></AppShell>;

  const mastered = Object.entries(mastery).filter(([, p]) => p >= MASTERED).map(([id]) => id);
  const badges = [
    { id: "first", on: lessonsFinished >= 1, label: t.profile.badgeNames.first },
    { id: "streak3", on: user.streak >= 3, label: t.profile.badgeNames.streak3 },
    { id: "xp100", on: user.xp >= 100, label: t.profile.badgeNames.xp100 },
    { id: "master1", on: mastered.length >= 1, label: t.profile.badgeNames.master1 },
    { id: "master5", on: mastered.length >= 5, label: t.profile.badgeNames.master5 },
  ];

  const choose = async (id: CharacterId) => {
    setErr(null);
    const r = await fetch("/api/user", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ characterId: id }) });
    const j = (await r.json()) as { error?: string; user: Parameters<typeof setUser>[0] };
    if (!r.ok) return setErr(j.error ?? t.common.error);
    setUser(j.user);
  };

  const reset = async () => {
    if (!window.confirm(t.profile.reset + "?")) return;
    await fetch("/api/user", { method: "DELETE" });
    await load(true);
    router.replace("/");
  };

  const ch = getCharacter(user.characterId);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-[900px] flex-col gap-5 px-4 pt-4 pb-8 md:px-6 md:pt-6">
        <h1 className="m-0 font-pixel text-[28px] font-bold">{t.profile.title}</h1>
        <div className="flex items-end gap-4 rounded-2xl border-[3px] border-ink p-4 shadow-[4px_4px_0_#1b1a17]" style={{ background: ch.world }}>
          <Character id={user.characterId} size={96} state="happy" />
          <div className="mb-2 min-w-0 flex-1">
            <div className="font-pixel text-[24px] font-bold">{user.nickname}</div>
            <div className="text-[14px] font-bold text-muted">{t.common.grade(user.grade)}</div>
            <div className="mt-2">
              <LevelRow level={user.level} xpInLevel={user.xpInLevel} xpPerLevel={user.xpPerLevel} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { k: t.profile.xp, v: `${user.xp}` },
            { k: t.profile.streak, v: <span className="inline-flex items-center gap-1"><Flame size={20} />{user.streak}</span> },
            { k: t.profile.mastered, v: `${mastered.length}` },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl border-[3px] border-ink bg-white p-3 text-center">
              <div className="font-pixel text-[26px] font-bold">{x.v}</div>
              <div className="text-[12px] leading-tight font-extrabold text-muted">{x.k}</div>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-2 font-pixel text-[20px] font-bold">{t.profile.collection}</h2>
          {err && <div role="alert" className="mb-2 text-[14px] font-extrabold text-rust">{err}</div>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {CHARACTERS.map((c) => {
              const open = isUnlocked(c.id, user.xp);
              const on = c.id === user.characterId;
              return (
                <div key={c.id} className={`flex flex-col items-center gap-2 rounded-2xl border-[3px] p-3 ${open ? "border-ink" : "border-locked-ink bg-locked"}`} style={{ background: open ? c.world : undefined }}>
                  <div style={{ filter: open ? undefined : "brightness(0) opacity(0.35)" }}>
                    <Character id={c.id} size={64} state={on ? "happy" : "idle"} />
                  </div>
                  <div className="font-pixel text-[16px] font-bold">{c.name}</div>
                  <div className="text-center text-[12px] font-bold text-muted">{c.vibe}</div>
                  {on ? (
                    <span className="flex h-10 items-center gap-1 text-[14px] font-extrabold"><Check size={16} aria-hidden />{t.profile.selected}</span>
                  ) : open ? (
                    <button type="button" className="btn h-10 text-[14px]" onClick={() => void choose(c.id)}>{t.profile.choose}</button>
                  ) : (
                    <span className="flex h-10 items-center gap-1 text-[14px] font-extrabold"><Lock size={14} aria-hidden />{t.profile.unlockAt(c.unlockXp)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-pixel text-[20px] font-bold">{t.profile.badges}</h2>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <div key={b.id} className={`flex items-center gap-1.5 rounded-xl border-[3px] px-3 py-2 text-[14px] font-extrabold ${b.on ? "border-ink bg-gold" : "border-locked-ink bg-locked text-muted"}`}>
                {b.on ? <Award size={16} aria-hidden /> : <Lock size={14} aria-hidden />}
                {b.label}
              </div>
            ))}
          </div>
        </section>

        {mastered.length > 0 && (
          <section>
            <h2 className="mb-2 font-pixel text-[20px] font-bold">{t.profile.mastered}</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {mastered.map((id) => (
                <li key={id}>
                  <Link href={`/practice/${id}`} className="flex items-center gap-2 rounded-xl border-[3px] border-ink bg-mint px-3 py-2 font-extrabold no-underline">
                    <Check size={16} aria-hidden /> {SKILL_BY_ID[id]?.title_uz ?? id}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-3 border-t-[3px] border-dashed border-locked-ink pt-4">
          <Link href="/maxfiylik" className="btn h-11 text-[14px] no-underline">{t.privacy.title}</Link>
          <button type="button" className="btn h-11 text-[14px]" onClick={() => void reset()}>{t.profile.reset}</button>
        </div>
      </div>
    </AppShell>
  );
}
