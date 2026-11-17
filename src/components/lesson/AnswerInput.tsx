"use client";
import { useEffect, useRef, useState } from "react";
import type { Expect } from "@/lib/ai/schema";
import { t } from "@/i18n/uz";

/** Answer box for an `ask` segment: number/fraction/expression text, or choice buttons. */
export default function AnswerInput({
  expect,
  onSubmit,
  disabled,
  compact = false,
  autoFocus = true,
}: {
  expect: Expect;
  onSubmit: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setV("");
    if (autoFocus && window.matchMedia("(min-width: 768px)").matches) ref.current?.focus();
  }, [expect, autoFocus]);

  if (expect.kind === "choice" && expect.choices?.length) {
    return (
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.lesson.choose}>
        {expect.choices.map((c) => (
          <button key={c} type="button" disabled={disabled} className="btn btn-go min-w-[64px] text-[18px]" onClick={() => onSubmit(c)}>
            {c}
          </button>
        ))}
      </div>
    );
  }

  // "1/3 = ?/6" style prompt → render "1/3 =" [input] "/ 6"
  const prompt = expect.prompt ?? "";
  const m = prompt.match(/^(.*?)\?(.*)$/);
  const before = m ? m[1].trim() : prompt;
  const after = m ? m[2].trim() : "";
  const numeric = expect.kind === "number";

  return (
    <form
      className="flex items-center gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSubmit(v.trim());
      }}
    >
      <label htmlFor="ans" className={`font-pixel font-bold whitespace-nowrap ${compact ? "text-[18px]" : "text-[20px]"}`}>
        {before || t.lesson.answer}
      </label>
      <input
        ref={ref}
        id="ans"
        value={v}
        onChange={(e) => setV(e.target.value)}
        inputMode={numeric ? "decimal" : "text"}
        autoComplete="off"
        placeholder="?"
        disabled={disabled}
        aria-label={t.lesson.answer}
        className="h-12 min-w-0 rounded-[10px] border-[3px] border-ink bg-cream text-center font-pixel text-[22px] font-bold text-ink"
        style={{ width: expect.kind === "number" ? 72 : 120 }}
      />
      {after && <span className="font-pixel text-[20px] font-bold whitespace-nowrap">{after}</span>}
      <div className="flex-1" />
      <button type="submit" disabled={disabled || !v.trim()} className="btn btn-go h-12 text-[17px]">
        {t.lesson.check}
      </button>
    </form>
  );
}
