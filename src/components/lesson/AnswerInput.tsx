"use client";
import { uzDecimal } from "@/lib/format/uzNum";
import { useEffect, useRef, useState } from "react";
import type { Expect } from "@/lib/ai/schema";
import { t } from "@/i18n/uz";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Answer box for a question: number/fraction/expression field, or A/B/C option rows. */
export default function AnswerInput({
  expect,
  onSubmit,
  disabled,
  autoFocus = true,
  wrong = false,
}: {
  expect: Expect;
  onSubmit: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** shake the picked option */
  wrong?: boolean;
}) {
  const [v, setV] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setV("");
    setPick(null);
    if (autoFocus && typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) ref.current?.focus();
  }, [expect, autoFocus]);

  if (expect.kind === "choice" && expect.choices?.length) {
    return (
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label={t.lesson.choose} className="flex flex-col gap-2.5">
          {expect.choices.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={pick === c}
              disabled={disabled}
              className={`opt ${wrong && pick === c ? "bad" : ""}`}
              onClick={() => setPick(c)}
            >
              <i>{LETTERS[i]}</i>
              <span className="font-chalk text-[20px]">{uzDecimal(c)}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary w-full" disabled={disabled || !pick} onClick={() => pick && onSubmit(pick)}>
          {t.lesson.check}
        </button>
      </div>
    );
  }

  const prompt = expect.prompt ?? "";
  const m = prompt.match(/^(.*?)\?(.*)$/);
  const before = m ? m[1].trim() : prompt;
  const after = m ? m[2].trim() : "";

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSubmit(v.trim());
      }}
    >
      <div className="flex items-center gap-3">
        {before && <label htmlFor="ans" className="font-chalk text-[24px] whitespace-nowrap">{uzDecimal(before)}</label>}
        <input
          ref={ref}
          id="ans"
          value={v}
          onChange={(e) => setV(e.target.value)}
          inputMode={expect.kind === "number" ? "decimal" : "text"}
          autoComplete="off"
          placeholder="?"
          disabled={disabled}
          aria-label={t.lesson.answer}
          className={`field min-w-0 flex-1 text-center font-chalk text-[24px] ${wrong ? "border-red" : ""}`}
        />
        {after && <span className="font-chalk text-[24px] whitespace-nowrap">{uzDecimal(after)}</span>}
      </div>
      <button type="submit" disabled={disabled || !v.trim()} className="btn btn-primary w-full">
        {t.lesson.check}
      </button>
    </form>
  );
}
