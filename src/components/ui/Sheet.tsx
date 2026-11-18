"use client";
// Bottom sheet (phones) / centred dialog (≥ 768 px). Esc or the backdrop closes it.
import { useEffect, type ReactNode } from "react";
import { ui } from "@/i18n/uz-ui";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label={ui.close} className="backdrop absolute inset-0 border-0 bg-[rgba(20,26,58,.45)]" onClick={onClose} />
      <div className="sheet relative w-full max-w-[520px] rounded-t-[32px] bg-white px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[var(--shadow-2)] md:rounded-[32px] md:pb-6">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#d5dbee] md:hidden" aria-hidden />
        <h2 className="t-h2 m-0 mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}
