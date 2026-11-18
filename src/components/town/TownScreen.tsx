"use client";
// Town screen: the course town image, a dashed route, and one pin (a real <button>) per building.
// Pins: done = gold ✓ · current = pulsing + the chosen tutor's face · locked = grey + lock, area dimmed with a scaffold.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AppShell, { ScreenTop } from "@/components/ui/AppShell";
import TutorPortrait from "@/components/characters/TutorPortrait";
import Confetti from "@/components/characters/Confetti";
import { ArrowIcon, CheckIcon, LockIcon } from "@/components/ui/icons";
import { useMe } from "@/lib/client/me";
import { getCharacter } from "@/config/characters";
import { TOWN_BY_ID } from "@/config/towns";
import { CURRICULA } from "@/data/curricula";
import { P_START } from "@/lib/learning/mastery";
import { buildPath } from "@/lib/learning/path";
import { assignQuests, questFallback, townProgress, townVoiceCommand, type TownData, type TownQuest } from "@/lib/learning/town";
import { loadTown, loadTownProgress, resolvePending, setPending } from "@/lib/client/town";

function Scaffold() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 21V5M20 21V5M4 9h16M4 15h16M4 9l16 6M20 9 4 15" />
    </svg>
  );
}

export default function TownScreen({ townId }: { townId: string }) {
  const router = useRouter();
  const meta = TOWN_BY_ID[townId];
  const { user, mastery, roadmap, load, loaded } = useMe();
  const [town, setTown] = useState<TownData | null>(null);
  const [placeholder, setPlaceholder] = useState(false);
  const [done, setDone] = useState<number[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!meta) return;
    void (async () => {
      const u = await load(true);
      if (!u) return router.replace("/onboarding");
      const [tw, prog] = await Promise.all([loadTown(townId), loadTownProgress()]);
      if (tw) {
        setTown(tw.town);
        setPlaceholder(tw.placeholder);
      }
      setDone(prog[townId] ?? []);
      const fin = await resolvePending(useMe.getState().mastery);
      if (fin && fin.town === townId) {
        setDone(fin.done);
        setBurst((b) => b + 1);
        setToast(t.town.built);
        setTimeout(() => setToast(null), 3500);
      }
    })();
  }, [meta, townId, load, router]);

  const curriculum = meta ? CURRICULA[meta.curriculum] : undefined;
  const started = useMemo(() => roadmap?.nodes.filter((n) => n.started).map((n) => n.id) ?? [], [roadmap]);
  const path = useMemo(() => (curriculum ? buildPath(curriculum, mastery, user?.grade ?? 6, { touched: Object.keys(mastery), started }) : null), [curriculum, mastery, user, started]);
  const quests = useMemo(() => (town && path ? assignQuests(town, path, done, { practiceOnly: meta?.practiceOnly }) : []), [town, path, done, meta]);
  const prog = townProgress(quests);
  const ch = getCharacter(user?.characterId);
  const focused = quests.find((q) => q.n === focus) ?? quests.find((q) => q.status === "current") ?? null;

  // inclusive voice commands ("to2:voice" window event, detail {command: next|prev|open|back}) — no-op if nobody sends them
  const voiceRef = useRef<(raw: unknown) => void>(() => {});
  voiceRef.current = (raw: unknown) => {
    const cmd = townVoiceCommand(raw);
    if (!cmd || !quests.length) return;
    const cur = focused?.n ?? 1;
    if (cmd === "back") return router.push("/towns");
    if (cmd === "open") {
      if (focused) void open(focused);
      return;
    }
    const n = cmd === "next" ? Math.min(quests.length, cur + 1) : Math.max(1, cur - 1);
    setFocus(n);
    pinRefs.current[n]?.focus();
  };
  const pinRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  useEffect(() => {
    const h = (e: Event) => voiceRef.current((e as CustomEvent).detail);
    window.addEventListener("to2:voice", h);
    return () => window.removeEventListener("to2:voice", h);
  }, []);

  if (!meta || !curriculum) {
    return (
      <AppShell>
        <ScreenTop title={meta?.name ?? t.town.pickerTitle} back="/towns" />
        <div className="card mx-[18px] p-5 text-center font-extrabold text-mut">{t.town.soon}</div>
      </AppShell>
    );
  }

  const open = async (q: TownQuest) => {
    setFocus(q.n);
    if (!q.href || !q.skillId) return;
    setPending({ town: townId, n: q.n, skillId: q.skillId, p0: mastery[q.skillId] ?? P_START });
    let href = q.href;
    // arena / workshop → games module; if /games isn't deployed yet, the practice stand-in opens instead
    const fb = questFallback(q.kind, q.skillId, townId, q.n);
    if (fb) {
      const ok = await fetch(href.split("?")[0], { method: "HEAD" }).then((r) => r.ok).catch(() => false);
      if (!ok) href = fb;
    }
    router.push(href);
  };
  const label = (q: TownQuest) => t.town.pin(q.n, t.town.kind[q.kind], q.status !== "locked");

  return (
    <AppShell>
      <ScreenTop title={meta.name} back="/towns" />
      <div className="flex flex-col gap-3 px-[18px] pb-8 md:px-2">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 text-[16px] font-black">{t.town.header}</p>
          <span className="flex-none rounded-full bg-[#fff3d1] px-3 py-1 text-[13px] font-black text-[#7a5200]">{t.town.progress(prog.done, prog.total)}</span>
        </div>

        {!loaded || !town ? (
          <div className="p-6 text-center font-extrabold text-mut">{t.common.loading}</div>
        ) : (
          <>
            <section className="relative -mx-[18px] overflow-hidden md:mx-0 md:rounded-[28px]" style={{ background: "linear-gradient(180deg,#4f8ff7 0%,#77b0ff 45%,#a9d0ff 100%)" }} aria-label={meta.name}>
              <div className="relative">
                <img src={town.image} alt={placeholder ? t.town.placeholder : meta.name} className="block w-full" />
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                  <polyline points={town.route.map(([x, y]) => `${(x * 100).toFixed(2)},${(y * 100).toFixed(2)}`).join(" ")} fill="none" stroke="#fff" strokeWidth="0.9" strokeDasharray="0.1 2.2" strokeLinecap="round" opacity=".95" />
                </svg>
                {/* dimmed construction sites behind locked pins */}
                {quests
                  .filter((q) => q.status === "locked")
                  .map((q) => (
                    <span key={`s${q.n}`} aria-hidden className="pointer-events-none absolute flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-start justify-end rounded-full bg-[#1b2238]/40 p-1.5" style={{ left: `${q.marker[0] * 100}%`, top: `${q.marker[1] * 100}%` }}>
                      <Scaffold />
                    </span>
                  ))}
                {/* pins: DOM order = route order = keyboard focus order */}
                {quests.map((q) => {
                  const style = { left: `${q.marker[0] * 100}%`, top: `${q.marker[1] * 100}%` };
                  const base = "absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] text-[16px] font-black focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#141a3a]";
                  return (
                    <button
                      key={q.n}
                      type="button"
                      style={style}
                      aria-label={label(q)}
                      title={label(q)}
                      aria-disabled={q.status === "locked" || undefined}
                      data-testid={`pin-${q.n}`}
                      ref={(el) => {
                        pinRefs.current[q.n] = el;
                      }}
                      onFocus={() => setFocus(q.n)}
                      onClick={() => void open(q)}
                      className={
                        q.status === "done"
                          ? `${base} border-white bg-[#ffc83d] text-[#5a3b00] shadow-[0_4px_10px_rgba(0,0,0,.25)]`
                          : q.status === "current"
                            ? `${base} node-current border-white bg-blue text-white shadow-[0_0_0_6px_rgba(47,107,255,.35)]`
                            : `${base} border-[#cfd5e6] bg-[#e3e7f2] text-[#5b6383]`
                      }
                    >
                      {q.status === "done" ? <CheckIcon size={18} /> : q.status === "locked" ? <LockIcon size={14} /> : q.n}
                      {q.status === "current" && (
                        <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 h-11 w-11 -translate-x-1/2 overflow-hidden rounded-full border-[3px] border-white bg-soft2 shadow" aria-hidden>
                          <TutorPortrait id={ch.id} pose="idle" frame="face" className="h-11 w-11" alt="" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <Confetti burst={burst} />
            </section>

            {toast && (
              <div role="status" className="card self-center bg-[#fff3d1] px-5 py-2.5 text-[16px] font-black text-[#5a3b00]">
                {toast}
              </div>
            )}

            {/* caption for the focused / current building — read by screen readers (aria-live) */}
            <div className="card flex flex-col gap-2 p-4" aria-live="polite">
              {!path?.steps.length ? (
                <>
                  <p className="m-0 text-[14px] font-extrabold text-mut">{t.town.noPath}</p>
                  <Link href="/diagnostic" className="btn btn-primary w-full">
                    {t.home.diagnostic}
                  </Link>
                </>
              ) : prog.total > 0 && prog.done === prog.total ? (
                <p className="m-0 text-[16px] font-black text-green">{t.town.allDone}</p>
              ) : focused ? (
                <>
                  <div className="text-[12px] font-extrabold text-mut">
                    {focused.n}. {t.town.kind[focused.kind]} · {t.town.state[focused.status]}
                  </div>
                  <div className="text-[17px] leading-[1.2] font-black">
                    {t.town.action[focused.kind]}: {focused.topic}
                  </div>
                  {focused.status === "locked" ? (
                    <p className="m-0 text-[13px] font-extrabold text-mut">{t.town.lockedHint}</p>
                  ) : (
                    <button type="button" className="btn btn-primary w-full" onClick={() => void open(focused)}>
                      {t.town.go} <ArrowIcon />
                    </button>
                  )}
                </>
              ) : null}
            </div>

            <Link href={`/map?subject=${meta.curriculum}`} className="btn btn-soft min-h-11 w-full text-[14px]">
              {t.town.mindMap} <ArrowIcon />
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
