"use client";
// Diagnostic = the first expedition (CLAUDE.md §7): every answer adds a block to the bridge.
// No timer, no lives, no red errors; "Bilmayman" is always there. Quiz layout from the prototype.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { t } from "@/i18n/uz";
import { getCharacter } from "@/config/characters";
import TutorPortrait from "@/components/characters/TutorPortrait";
import AnswerInput from "@/components/lesson/AnswerInput";
import SuccessScreen from "@/components/ui/SuccessScreen";
import { CloseIcon } from "@/components/ui/icons";
import { useMe } from "@/lib/client/me";
import { speak, unlockAudio, type Speech } from "@/lib/audio/player";
import { speakMath } from "@/lib/ai/speakMath";
import type { Expect } from "@/lib/ai/schema";

interface DProblem {
  index: number;
  total: number;
  skillId: string;
  skillTitle: string;
  q: string;
  kind: Expect["kind"];
  choices?: string[];
  prompt?: string;
}

export default function Diagnostic() {
  const router = useRouter();
  const { user, load } = useMe();
  const [p, setP] = useState<DProblem | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ weak: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);
  const voice = useRef<Speech | null>(null);
  const ch = getCharacter(user?.characterId);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load().then(async (u) => {
      if (!u) return router.replace("/onboarding");
      const r = await fetch("/api/diagnostic", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start" }) });
      if (!r.ok) return setErr(t.common.error);
      setP(((await r.json()) as { problem: DProblem }).problem);
    });
  }, [load, router]);

  // the tutor reads each question aloud (captions are always on screen too)
  useEffect(() => {
    if (!p) return;
    voice.current?.stop();
    // the voice gets the maths as words ("1/2 + 1/4 = ?" → "ikkidan bir qo'shuv to'rtdan bir nechaga teng?")
    voice.current = speak(speakMath(p.q), ch.id, { emotion: "encouraging" });
    return () => voice.current?.stop();
  }, [p, ch.id]);

  const send = async (answer: string) => {
    if (busy || !p) return;
    unlockAudio();
    setBusy(true);
    try {
      const r = await fetch("/api/diagnostic", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "answer", answer }) });
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { correct?: boolean; problem?: DProblem; done?: boolean; weakCount?: number };
      setResults((x) => [...x, !!j.correct]);
      setFeedback({ ok: !!j.correct });
      await new Promise((res) => setTimeout(res, j.correct ? 800 : 1400));
      setFeedback(null);
      if (j.done) {
        await load(true);
        setDone({ weak: j.weakCount ?? 0 });
      } else if (j.problem) setP(j.problem);
    } catch {
      setErr(t.common.error);
    } finally {
      setBusy(false);
    }
  };

  const total = p?.total ?? 8;
  const expect: Expect | null = p ? { kind: p.kind, answer: "?", choices: p.choices, prompt: p.prompt } : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col bg-ph px-[18px] pt-4 pb-6">
      <div className="flex h-[52px] items-center gap-3.5">
        <Link href="/home" aria-label="Chiqish" title="Chiqish" className="icon-btn">
          <CloseIcon />
        </Link>
        {/* the bridge: one block per question */}
        <div className="flex flex-1 gap-1" role="img" aria-label={`Ko'prik: ${total} blokdan ${results.length} tasi qurildi`}>
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              className="h-2.5 flex-1 rounded-[5px]"
              style={{ background: i < results.length ? (results[i] ? "#2f6bff" : "#ffc42e") : i === results.length ? "#bcd0ff" : "#e6ebf8" }}
            />
          ))}
        </div>
        <div className="font-extrabold text-mut">
          {Math.min(results.length + 1, total)} / {total}
        </div>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <TutorPortrait id={ch.id} pose={feedback?.ok ? "cheer" : "point"} frame="half" className="h-[120px] w-[120px] flex-none" alt="" />
        <div className="card relative mb-4 flex-1 px-4 py-3" aria-live="polite">
          <div className="text-[12px] font-black tracking-wide text-blue uppercase">{ch.name}</div>
          <div className="text-[15px] leading-[1.4] font-extrabold">
            {feedback ? (feedback.ok ? `${t.diagnostic.correct} +XP` : "Bu blokni keyinroq birga quramiz!") : results.length === 0 ? "Yo'lni ochish uchun yordam ber!" : p?.skillTitle}
          </div>
        </div>
      </div>

      {err && (
        <div role="alert" className="mb-3 rounded-[14px] bg-[#fff4e8] px-3.5 py-2.5 text-[14px] font-extrabold text-[#c2410c]">
          {err}
        </div>
      )}

      {p && expect && (
        <div className="flex flex-col gap-3">
          <div className="card p-5">
            <div className="text-[13px] font-extrabold text-mut">{p.skillTitle}</div>
            <div className="mt-2 text-center font-chalk text-[26px] leading-snug">{p.q}</div>
          </div>
          <AnswerInput key={p.index} expect={expect} disabled={busy} onSubmit={(v) => void send(v)} />
          <button type="button" className="btn btn-soft w-full" disabled={busy} onClick={() => void send("")}>
            {t.diagnostic.dontKnow} — keyin birga quramiz
          </button>
        </div>
      )}

      <div className="mt-auto flex items-start gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-[0_4px_14px_rgba(31,54,120,.06)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22b45a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 flex-none">
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          <path d="M8.5 12l2.5 2.5 4.5-5" />
        </svg>
        <div className="text-[13px] leading-[1.4] font-bold text-mut">
          Bu imtihon emas. Vaqt chegarasi yo&apos;q, xato uchun jarima yo&apos;q — {ch.name} sen bilan birga yo&apos;l topadi.
        </div>
      </div>

      {done && (
        <SuccessScreen
          title={t.success.title}
          subtitle={done.weak > 0 ? "Mana sening yo'ling. Birinchi qurilishni boshlaymiz!" : "Zo'r natija! Keyingi darajaga o'tamiz."}
          characterId={ch.id}
          primary={{ label: t.roadmap.title, onClick: () => router.push("/roadmap") }}
        />
      )}
    </main>
  );
}
