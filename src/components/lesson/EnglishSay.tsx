"use client";
// "Inglizcha talaffuz": a small speaker button for every English phrase written on the board
// (English lessons only). Audio = /api/english/say (Gemini TTS, cached on the server); the Uzbek
// tutor voice keeps explaining. No key / a failed call → the buttons simply don't show.
import { useEffect, useMemo, useState } from "react";
import { useLesson } from "@/lib/lesson/engine";
import { sayableParts } from "@/lib/english/say";
import { SpeakerIcon } from "@/components/ui/icons";
import { EN_UI } from "@/config/courses/english";

let enabledProbe: Promise<boolean> | null = null;
function pronunciationEnabled(): Promise<boolean> {
  enabledProbe ??= fetch("/api/english/say?check=1", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ enabled?: boolean }>) : { enabled: false }))
    .then((j: { enabled?: boolean }) => !!j.enabled)
    .catch(() => false);
  return enabledProbe;
}

export default function EnglishSay({ skillId }: { skillId: string }) {
  const english = skillId.startsWith("en-");
  const els = useLesson((s) => s.board.els);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    if (english) void pronunciationEnabled().then(setEnabled);
  }, [english]);

  const phrases = useMemo(() => {
    const out: string[] = [];
    for (const e of els) {
      if (e.layer !== "main" || e.cmd.op !== "write") continue;
      for (const p of sayableParts(e.cmd.text)) if (!out.includes(p)) out.push(p);
    }
    return out.filter((p) => !failed.has(p)).slice(-8);
  }, [els, failed]);

  if (!english || !enabled || phrases.length === 0) return null;

  const play = (p: string) => {
    const a = new Audio(`/api/english/say?text=${encodeURIComponent(p)}`);
    setPlaying(p);
    a.onended = () => setPlaying(null);
    a.onerror = () => {
      setPlaying(null);
      setFailed((f) => new Set(f).add(p));
    };
    a.play().catch(() => setPlaying(null));
  };

  return (
    <div className="rounded-[18px] bg-white px-3 py-2.5 shadow-[0_4px_12px_rgba(31,54,120,.07)]" aria-label={EN_UI.title}>
      <div className="mb-1.5 text-[12px] font-extrabold text-mut">{EN_UI.title}</div>
      <div className="flex flex-wrap gap-2">
        {phrases.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => play(p)}
            aria-label={EN_UI.listen(p)}
            title={EN_UI.listen(p)}
            className={`flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-extrabold ${playing === p ? "bg-blue text-white" : "bg-soft2 text-ink"}`}
          >
            <SpeakerIcon size={16} />
            <span lang="en">{p}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
