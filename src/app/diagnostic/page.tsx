"use client";
// Adaptive diagnostic as a "bridge-building expedition": every answer adds a block. No timer, no penalty.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { t } from "@/i18n/uz";
import { getCharacter, type CharacterId } from "@/config/characters";
import Character from "@/components/characters/Character";
import Confetti from "@/components/characters/Confetti";
import AnswerInput from "@/components/lesson/AnswerInput";
import { useMe } from "@/lib/client/me";
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
  const [answered, setAnswered] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; answer: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const started = useRef(false);

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

  const ch = getCharacter(user?.characterId);

  const send = async (answer: string, action: "answer" | "skip" = "answer") => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/diagnostic", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, answer }) });
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { correct?: boolean; answer?: string; problem?: DProblem; done?: boolean };
      if (action === "answer") {
        setResults((x) => [...x, !!j.correct]);
        setAnswered((n) => n + 1);
        setFeedback({ ok: !!j.correct, answer: j.answer ?? "" });
        if (j.correct) setBurst((b) => b + 1);
        await new Promise((res) => setTimeout(res, j.correct ? 700 : 1300));
        setFeedback(null);
      }
      if (j.done) {
        setDone(true);
        await load(true);
        setTimeout(() => router.push("/roadmap"), 900);
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
    <main className="mx-auto flex min-h-dvh max-w-[620px] flex-col bg-paper">
      {/* sky scene with the bridge */}
      <div className="relative h-[380px] flex-none overflow-hidden border-b-[3px] border-ink bg-sky md:h-[400px]">
        <svg viewBox="0 0 390 330" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" shapeRendering="crispEdges" aria-hidden>
          <rect width="390" height="330" fill="#cfe8ff" />
          <rect x="318" y="40" width="34" height="34" fill="#ffd85c" />
          <g fill="#ffffff">
            <rect x="40" y="60" width="60" height="12" />
            <rect x="54" y="50" width="30" height="12" />
            <rect x="200" y="84" width="54" height="10" />
          </g>
          <rect x="0" y="236" width="112" height="94" fill="#7a5230" />
          <rect x="0" y="236" width="112" height="12" fill="#3fae49" />
          <rect x="282" y="236" width="108" height="94" fill="#7a5230" />
          <rect x="282" y="236" width="108" height="12" fill="#3fae49" />
          <rect x="112" y="290" width="170" height="40" fill="#1e5fa8" />
          {/* bridge blocks = progress */}
          {Array.from({ length: total }, (_, i) => {
            const w = 170 / total;
            const filled = i < answered;
            return filled ? (
              <rect key={i} x={112 + i * w} y={236} width={w - 1} height={12} fill={results[i] ? "#ffc83d" : "#b0773a"} stroke="#1b1a17" strokeWidth={1.5} />
            ) : i === answered ? (
              <rect key={i} x={112 + i * w} y={236} width={w - 1} height={12} fill="none" stroke="#f28c28" strokeWidth={2} strokeDasharray="4 3" className="chalk-glow" />
            ) : null;
          })}
        </svg>
        <div className="absolute inset-x-3 top-3 z-10 flex items-center gap-2">
          <Link href="/roadmap" aria-label="Chiqish" title="Chiqish" className="btn h-11 w-11 flex-none rounded-full p-0">
            <X size={20} aria-hidden />
          </Link>
          <div className="flex h-11 flex-1 items-center gap-2.5 rounded-full border-[3px] border-ink bg-white px-3.5">
            <div className="truncate font-pixel text-[14px] font-bold">{p?.skillTitle ?? t.diagnostic.title}</div>
            <div className="ml-auto text-[13px] font-extrabold whitespace-nowrap">{t.diagnostic.question(Math.min(answered + 1, total), total)}</div>
          </div>
        </div>
        <div className="absolute inset-x-3 top-[66px] z-10 rounded-[18px] border-[3px] border-ink bg-white px-3.5 pt-2.5 pb-3 shadow-[3px_3px_0_#1b1a17]" aria-live="polite">
          <div className="mb-0.5 font-pixel text-[12px] font-bold tracking-wide text-rust uppercase">{ch.name}</div>
          <div className="text-[16px] leading-[1.4] font-bold">
            {done ? t.diagnostic.done : feedback ? (feedback.ok ? t.diagnostic.correct : `${t.diagnostic.wrong} (${feedback.answer})`) : p ? p.q : answered === 0 ? t.diagnostic.intro : t.common.loading}
          </div>
        </div>
        <div className="absolute bottom-[26%] left-3 z-10 md:left-6">
          <div className="relative">
            <Confetti burst={burst} />
            <Character id={(user?.characterId ?? "blokbek") as CharacterId} size={84} state={done || feedback?.ok ? "celebrate" : busy ? "thinking" : "happy"} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-6">
        {err && (
          <div role="alert" className="rounded-xl border-[3px] border-ink bg-cream px-3 py-2 text-[14px] font-extrabold">
            {err}
          </div>
        )}
        {p && expect && !done && (
          <>
            <div className="text-[13px] font-extrabold text-muted">{t.diagnostic.answerLabel}</div>
            {expect.kind === "choice" ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {expect.choices?.map((c) => (
                  <button key={c} type="button" disabled={busy} onClick={() => void send(c)} className="btn h-[76px] rounded-[18px] font-chalk text-[26px] shadow-[0_6px_0_#1b1a17]">
                    {c}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-[3px] border-ink bg-white p-3">
                <AnswerInput key={p.index} expect={expect} disabled={busy} onSubmit={(v) => void send(v)} />
              </div>
            )}
            <button type="button" className="btn h-[52px] rounded-full font-body text-[15px] font-extrabold" disabled={busy} onClick={() => void send("", "answer")}>
              {t.diagnostic.dontKnow} — keyin birga quramiz
            </button>
          </>
        )}
        <div className="mt-auto flex items-start gap-2.5 rounded-2xl border-[3px] border-ink bg-mint px-3.5 py-3">
          <ShieldCheck size={20} className="mt-0.5 flex-none" aria-hidden />
          <div className="text-[13px] leading-[1.4] font-bold">Bu imtihon emas. Vaqt chegarasi yo&apos;q, xato uchun jarima yo&apos;q — {ch.name} sen bilan birga yo&apos;l topadi.</div>
        </div>
      </div>
    </main>
  );
}
