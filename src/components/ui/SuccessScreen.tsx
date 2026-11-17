"use client";
// "A'lo!" success screen (prototype screen 7): blue gradient, star pop, cheering tutor, confetti.
import Link from "next/link";
import { useMemo } from "react";
import TutorPortrait from "@/components/characters/TutorPortrait";
import { StarIcon } from "./icons";

const COLS = ["#ffc42e", "#ff7ab6", "#7cf0c9", "#b28bff", "#ffffff", "#ff9f43"];

type Action = { label: string; href?: string; onClick?: () => void };

export default function SuccessScreen({
  title,
  subtitle,
  characterId,
  primary,
  secondary,
}: {
  title: string;
  subtitle: string;
  characterId: string;
  primary: Action;
  secondary?: Action;
}) {
  const conf = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 3,
        rot: Math.random() * 90,
        c: COLS[i % COLS.length],
        round: i % 3 === 0,
      })),
    [],
  );
  const btn = (a: Action, cls: string) =>
    a.href ? (
      <Link href={a.href} className={cls}>
        {a.label}
      </Link>
    ) : (
      <button type="button" className={cls} onClick={a.onClick} autoFocus>
        {a.label}
      </button>
    );
  return (
    <div role="status" className="anim-in fixed inset-0 z-50 flex flex-col items-center overflow-hidden text-white" style={{ background: "linear-gradient(170deg,#3f80ff,#1f4fd0)" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {conf.map((c, i) => (
          <div key={i} className="conf" style={{ left: `${c.left}%`, top: -20, background: c.c, animationDelay: `${c.delay}s`, transform: `rotate(${c.rot}deg)`, borderRadius: c.round ? "50%" : 3 }} />
        ))}
      </div>
      <div className="pop mt-[9vh]" style={{ filter: "drop-shadow(0 10px 18px rgba(0,0,0,.25))" }}>
        <StarIcon size={130} />
      </div>
      <div className="mt-1 text-[46px] font-black">{title}</div>
      <div className="text-[19px] font-extrabold opacity-90">{subtitle}</div>
      <TutorPortrait id={characterId} pose="cheer" frame="full" className="mt-2 h-auto w-[min(300px,70vw)]" />
      <div className="absolute inset-x-7 bottom-10 mx-auto flex max-w-[420px] flex-col gap-3">
        {btn(primary, "btn btn-white w-full")}
        {secondary && btn(secondary, "btn w-full bg-transparent text-white shadow-none")}
      </div>
    </div>
  );
}
