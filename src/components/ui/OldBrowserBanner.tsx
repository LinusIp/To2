"use client";
// Small "please update" banner for browsers that can't do modern CSS (CSS.supports oklch fails:
// roughly Chrome < 111 / Safari < 15.4 / old Android WebViews). Never blocks; dismissible.
// Inline styles on purpose: it has to look right even where our stylesheet doesn't fully work.
import { useEffect, useState } from "react";

export default function OldBrowserBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const ok = typeof CSS !== "undefined" && CSS.supports("color", "oklch(0 0 0)");
      if (!ok && sessionStorage.getItem("to2-old-browser") !== "1") setShow(true);
    } catch {
      /* ignore */
    }
  }, []);
  if (!show) return null;
  return (
    <div role="status" style={{ position: "fixed", left: 8, right: 8, bottom: 84, zIndex: 60, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "#fff4e8", color: "#7c2d12", font: "700 14px/1.35 system-ui, sans-serif", boxShadow: "0 6px 18px rgba(0,0,0,.18)" }}>
      <span style={{ flex: 1 }}>Brauzeringiz eskirgan — ilova to&apos;g&apos;ri ko&apos;rinishi uchun uni (yoki Android System WebView ni) yangilang.</span>
      <button
        type="button"
        aria-label="Yopish"
        onClick={() => {
          setShow(false);
          try {
            sessionStorage.setItem("to2-old-browser", "1");
          } catch {
            /* ignore */
          }
        }}
        style={{ minWidth: 44, minHeight: 44, border: 0, borderRadius: 12, background: "#fde2c8", color: "#7c2d12", font: "900 18px system-ui, sans-serif" }}
      >
        ×
      </button>
    </div>
  );
}
