"use client";
// "A'lo!" success screen (prototype screen 7): flat blue, star pop, cheering tutor, confetti.
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
  // mockup v2 (screen s6): deep blue-violet sky, twinkling stars, the cheering tutor, a white card
  return (
    <div role="status" className="anim-in fixed inset-0 z-50 overflow-hidden" style={{ background: "#2358dc" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {conf.map((c, i) => (
          <div key={i} className="conf" style={{ left: `${c.left}%`, top: -20, background: c.c, animationDelay: `${c.delay}s`, transform: `rotate(${c.rot}deg)`, borderRadius: c.round ? "50%" : 3 }} />
        ))}
        {[
          [12, 11],
          [82, 10],
          [7, 31],
          [86, 30],
          [44, 7],
        ].map(([x, y], i) => (
          <span key={i} className="pop absolute" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.15}s` }}>
            <StarIcon size={i % 2 ? 26 : 34} />
          </span>
        ))}
      </div>
      <TutorPortrait id={characterId} pose="cheer" frame="half" alt="" className="pop absolute top-[7vh] left-1/2 h-[min(310px,40vh)] w-[min(330px,85vw)] -translate-x-1/2" style={{ objectPosition: "50% 100%", filter: "drop-shadow(0 18px 16px rgba(0,0,40,.35))" }} />
      <div className="absolute inset-x-[18px] bottom-[22px] mx-auto max-w-[460px] rounded-[30px] bg-white px-[22px] pt-[26px] pb-[22px] text-center text-ink shadow-[0_18px_40px_rgba(0,0,40,.35)]">
        <div className="text-[34px] leading-none font-black tracking-[-.5px]">{title}</div>
        <div className="mt-2 mb-[18px] text-[17px] leading-snug font-bold text-[#3c4466]">{subtitle}</div>
        <div className="flex flex-col gap-2.5">
          {btn(primary, "btn btn-primary w-full")}
          {secondary && btn(secondary, "btn w-full")}
        </div>
      </div>
    </div>
  );
}
