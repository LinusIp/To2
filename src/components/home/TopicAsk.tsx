"use client";
// "Istalgan mavzu" (beta): type or say any school topic → a short LLM board lesson with the same
// tutor and chalkboard (/lesson/t:<topic>). Guardrails: cleanTopic() here + on the server, and the
// prompt refuses non-school topics.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import { cleanTopic, topicSkillId } from "@/data/skills";
import { micSupported, startRecording, stopRecording } from "@/lib/audio/recorder";
import { ArrowIcon, MicIcon } from "@/components/ui/icons";

export default function TopicAsk() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [rec, setRec] = useState<"idle" | "rec" | "stt">("idle");
  const [err, setErr] = useState("");
  const [canMic, setCanMic] = useState(false);
  useEffect(() => setCanMic(micSupported()), []);

  const go = (value = text) => {
    const id = topicSkillId(value);
    if (!id) {
      setErr(t.topic.invalid);
      return;
    }
    router.push(`/lesson/${encodeURIComponent(id)}`);
  };

  const mic = async () => {
    setErr("");
    if (rec === "rec") {
      setRec("stt");
      const r = await stopRecording().catch(() => null);
      if (!r) return setRec("idle");
      try {
        const fd = new FormData();
        fd.append("audio", r.blob, "topic.webm");
        const j = (await (await fetch("/api/stt", { method: "POST", body: fd })).json()) as { text?: string };
        const said = (j.text ?? "").trim();
        if (!said) throw new Error("empty");
        setText(said);
        if (cleanTopic(said)) go(said);
        else setErr(t.topic.invalid);
      } catch {
        setErr(t.topic.sttFailed);
      }
      setRec("idle");
      return;
    }
    try {
      await startRecording();
      setRec("rec");
    } catch {
      setErr(t.topic.micDenied);
    }
  };

  return (
    <form
      id="istalgan-mavzu"
      className="card mt-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <div className="flex items-center gap-2">
        <label htmlFor="topic-input" className="text-[16px] font-black">
          {t.topic.question}
        </label>
        <span className="rounded-full bg-[#efe8ff] px-2 py-0.5 text-[11px] font-black text-[#6b3fe0]">Beta</span>
      </div>
      <div className="mt-1 text-[12px] font-bold text-mut">{t.topic.hint}</div>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          id="topic-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErr("");
          }}
          maxLength={80}
          placeholder={t.topic.placeholder}
          className="min-h-11 min-w-0 flex-1 rounded-[14px] border-2 border-[#dfe4f3] bg-white px-3 text-[15px] font-bold outline-none focus:border-blue"
        />
        {canMic && (
          <button
            type="button"
            onClick={() => void mic()}
            aria-label={rec === "rec" ? t.topic.micStop : t.topic.micStart}
            title={rec === "rec" ? t.topic.micStop : t.topic.micStart}
            disabled={rec === "stt"}
            className={`icon-btn shrink-0 ${rec === "rec" ? "bg-[#ff5a5a] text-white" : "bg-soft2"}`}
          >
            <MicIcon size={20} />
          </button>
        )}
        <button type="submit" aria-label={t.topic.go} title={t.topic.go} className="icon-btn shrink-0 bg-blue text-white">
          <ArrowIcon size={18} />
        </button>
      </div>
      {rec !== "idle" && <div className="mt-1.5 text-[12px] font-extrabold text-blue">{rec === "rec" ? t.topic.listening : t.common.loading}</div>}
      {err && (
        <div role="alert" className="mt-1.5 text-[12px] font-extrabold text-[#c2410c]">
          {err}
        </div>
      )}
    </form>
  );
}
