"use client";
// Tiny toast system: toast("Saqlandi!", "success") from anywhere; <Toaster/> renders them (aria-live).
import { useSyncExternalStore } from "react";

type Tone = "info" | "success" | "error";
interface Item {
  id: number;
  text: string;
  tone: Tone;
}
let items: Item[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function toast(text: string, tone: Tone = "info", ms = 2600) {
  const id = ++seq;
  items = [...items, { id, text, tone }].slice(-3);
  emit();
  setTimeout(() => {
    items = items.filter((i) => i.id !== id);
    emit();
  }, ms);
}

// WCAG AA: white text on each background ≥ 4.5:1
const TONE: Record<Tone, string> = {
  info: "bg-ink text-white",
  success: "bg-[#127a37] text-white",
  error: "bg-[#b4380a] text-white",
};

export function Toaster() {
  const list = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    () => items,
    () => items,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[104px] z-50 flex flex-col-reverse items-center gap-2 px-4 md:bottom-8">
      {list.map((i) => (
        <div
          key={i.id}
          role={i.tone === "error" ? "alert" : "status"}
          className={`toast-up max-w-full rounded-2xl px-5 py-3 text-[15px] font-extrabold shadow-[0_5px_0_rgba(0,0,0,.18),0_14px_30px_rgba(20,26,58,.25)] ${TONE[i.tone]}`}
        >
          {i.text}
        </div>
      ))}
    </div>
  );
}
