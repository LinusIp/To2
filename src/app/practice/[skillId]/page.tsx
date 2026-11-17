"use client";
// Quick-fire practice: generated problems, mathjs-checked on the server, XP + mastery per answer.
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { t } from "@/i18n/uz";
import AppShell from "@/components/ui/AppShell";
import AnswerInput from "@/components/lesson/AnswerInput";
import Character from "@/components/characters/Character";
import Confetti from "@/components/characters/Confetti";
import { StreakChip, XpBar } from "@/components/ui/hud";
import { getSkill } from "@/data/skills";
import { useMe } from "@/lib/client/me";
import type { Problem } from "@/data/problems";
import type { CharacterId } from "@/config/characters";

export default function PracticePage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = use(params);
  const skill = getSkill(skillId);
  const { user, mastery, load } = useMe();
  const [p, setP] = useState<Problem | null>(null);
  const [res, setRes] = useState<{ ok: boolean; xp: number; mastered?: boolean } | null>(null);
  const [run, setRun] = useState(0);
  const [m, setM] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const [startedAt, setStartedAt] = useState(0);

  const next = useCallback(async () => {
    setRes(null);
    const r = await fetch(`/api/practice?skillId=${encodeURIComponent(skillId)}`, { cache: "no-store" });
    if (r.ok) {
      setP(((await r.json()) as { problem: Problem }).problem);
      setStartedAt(Date.now());
    }
  }, [skillId]);

  useEffect(() => {
    void load();
    void next();
  }, [load, next]);

  useEffect(() => {
    if (m === null && mastery[skillId] !== undefined) setM(mastery[skillId]);
  }, [mastery, skillId, m]);

  const submit = async (given: string) => {
    if (!p || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillId, expect: p.expect, given, question: p.q, source: "practice", msTaken: Date.now() - startedAt }),
      });
      const j = (await r.json()) as { correct: boolean; xp: number; p?: number; becameMastered?: boolean; unreadable?: boolean };
      if (j.unreadable) return;
      setRes({ ok: j.correct, xp: j.xp, mastered: j.becameMastered });
      if (typeof j.p === "number") setM(j.p);
      if (j.correct) {
        setRun((x) => x + 1);
        setBurst((b) => b + 1);
      } else setRun(0);
      void load(true);
    } finally {
      setBusy(false);
    }
  };

  if (!skill) return null;
  const pct = Math.round((m ?? 0.3) * 100);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-[680px] flex-col gap-4 px-4 pt-4 pb-6 md:pt-6">
        <div className="flex items-center gap-2.5">
          <Link href="/roadmap" aria-label={t.nav.backToMap} title={t.nav.backToMap} className="btn h-11 w-11 flex-none rounded-xl p-0">
            <ChevronLeft size={24} strokeWidth={3} aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-extrabold text-muted">
              {t.practice.title} · {skill.section}
            </div>
            <h1 className="m-0 truncate font-pixel text-[20px] font-bold md:text-[26px]">{skill.title_uz}</h1>
          </div>
          {user && <StreakChip days={user.streak} />}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-extrabold whitespace-nowrap">{t.practice.mastery}</span>
          <XpBar value={pct} max={100} className="flex-1" />
          <span className="font-pixel text-[14px]">{pct}%</span>
        </div>

        <div className="relative rounded-2xl border-[3px] border-ink bg-chalkboard p-5 text-chalk shadow-[4px_4px_0_#1b1a17]">
          <Confetti burst={burst} />
          <div className="font-chalk text-[24px] leading-snug font-bold md:text-[30px]">{p ? p.q : t.common.loading}</div>
          {run >= 2 && <div className="mt-2 font-pixel text-[14px] text-chalk-yellow">{t.practice.streak(run)}</div>}
        </div>

        {p && !res && (
          <div className="rounded-2xl border-[3px] border-ink bg-white p-3">
            <AnswerInput key={p.key} expect={p.expect} disabled={busy} onSubmit={(v) => void submit(v)} />
          </div>
        )}

        {res && p && (
          <div className={`flex items-center gap-3 rounded-2xl border-[3px] border-ink p-3 ${res.ok ? "bg-mint" : "bg-cream"}`} role="status">
            <Character id={(user?.characterId ?? "blokbek") as CharacterId} size={56} state={res.ok ? "celebrate" : "idle"} />
            <div className="flex-1">
              <div className="font-pixel text-[18px] font-bold">
                {res.ok ? t.practice.correct : t.practice.wrong(p.expect.answer)} {res.xp > 0 && `+${res.xp} XP`}
              </div>
              {!res.ok && <div className="text-[14px] font-bold">{p.hint}</div>}
              {res.mastered && <div className="text-[14px] font-extrabold text-grass-dark">{t.roadmap.status.mastered}!</div>}
            </div>
          </div>
        )}

        {res && (
          <button type="button" className="btn btn-primary h-14 text-[18px]" onClick={() => void next()} autoFocus>
            {t.practice.next} <ArrowRight size={20} aria-hidden />
          </button>
        )}
        {!res && p && (
          <details className="rounded-xl border-[3px] border-dashed border-ink bg-white px-3 py-2">
            <summary className="cursor-pointer text-[14px] font-extrabold">{t.lesson.hint}</summary>
            <p className="m-0 mt-1 text-[14px] font-bold">{p.hint}</p>
          </details>
        )}
        <Link href={`/lesson/${skill.id}`} className="text-center text-[14px] font-extrabold">
          {t.nav.lesson}: {skill.title_uz} →
        </Link>
      </div>
    </AppShell>
  );
}
