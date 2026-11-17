"use client";
// Practice (prototype "Savol" + "A'lo!" screens): generated problems, mathjs-checked, XP + mastery.
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { t } from "@/i18n/uz";
import AnswerInput from "@/components/lesson/AnswerInput";
import SuccessScreen from "@/components/ui/SuccessScreen";
import { Bar } from "@/components/ui/hud";
import { CloseIcon } from "@/components/ui/icons";
import { getSkill } from "@/data/skills";
import { getCharacter } from "@/config/characters";
import { useMe } from "@/lib/client/me";
import type { Problem } from "@/data/problems";

export default function PracticePage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = use(params);
  const skill = getSkill(skillId);
  const { user, mastery, load } = useMe();
  const [p, setP] = useState<Problem | null>(null);
  const [win, setWin] = useState<{ xp: number; mastered?: boolean } | null>(null);
  const [wrong, setWrong] = useState(false);
  const [tries, setTries] = useState(0);
  const [count, setCount] = useState(0);
  const [m, setM] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const ch = getCharacter(user?.characterId);

  const next = useCallback(async () => {
    setWin(null);
    setWrong(false);
    setTries(0);
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
        body: JSON.stringify({ skillId, expect: p.expect, given, question: p.q, source: "practice", firstTry: tries === 0, hintUsed: tries > 0, msTaken: Date.now() - startedAt }),
      });
      const j = (await r.json()) as { correct: boolean; xp: number; p?: number; becameMastered?: boolean; unreadable?: boolean };
      if (j.unreadable) return;
      if (typeof j.p === "number") setM(j.p);
      if (j.correct) {
        setCount((c) => c + 1);
        setWin({ xp: j.xp, mastered: j.becameMastered });
      } else {
        setWrong(true);
        setTries((x) => x + 1);
        setTimeout(() => setWrong(false), 400);
      }
      void load(true);
    } finally {
      setBusy(false);
    }
  };

  if (!skill) return null;
  const pct = Math.round((m ?? 0.3) * 100);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col bg-ph px-[18px] pt-4 pb-6">
      <div className="flex h-[52px] items-center gap-3.5">
        <Link href="/roadmap" aria-label="Yopish" title="Yopish" className="icon-btn">
          <CloseIcon />
        </Link>
        <Bar value={pct} className="flex-1" label={t.practice.mastery} />
        <div className="font-extrabold text-mut">{pct}%</div>
      </div>
      <div className="mt-1 mb-3 text-[13px] font-extrabold text-mut">
        {t.practice.title} · {skill.title_uz} {count > 0 && `· ${t.practice.streak(count)}`}
      </div>

      <div className="flex flex-col gap-3">
        <div className="card p-5">
          <div className="text-[19px] font-black">{p?.expect.kind === "choice" ? "To'g'ri javobni tanlang:" : "Misolni yeching:"}</div>
          <div className="mt-2.5 text-center font-chalk text-[26px] leading-snug">{p ? p.q : t.common.loading}</div>
        </div>
        {p && <AnswerInput key={p.key} expect={p.expect} disabled={busy} wrong={wrong} onSubmit={(v) => void submit(v)} />}
        {tries > 0 && p && (
          <div className="rounded-[14px] bg-[#fff4e8] px-3.5 py-3 text-[14px] font-extrabold text-[#c2410c]">
            {t.lesson.hint}: {p.hint}
            {tries >= 2 && (
              <div className="mt-1.5 text-ink">
                {t.practice.wrong(p.expect.answer)}{" "}
                <button type="button" className="ml-1 font-black text-blue underline" onClick={() => void next()}>
                  {t.practice.next}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Link href={`/lesson/${skill.id}`} className="mt-auto pt-6 text-center text-[14px] font-extrabold text-blue no-underline">
        {t.nav.lesson}: {skill.title_uz} →
      </Link>

      {win && (
        <SuccessScreen
          title={t.success.title}
          subtitle={`${t.success.correct(win.xp)}${win.mastered ? ` · ${t.roadmap.status.mastered}!` : ""}`}
          characterId={ch.id}
          primary={{ label: t.success.next, onClick: () => void next() }}
          secondary={{ label: t.success.toMap, href: "/roadmap" }}
        />
      )}
    </main>
  );
}
