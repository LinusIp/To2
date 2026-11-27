"use client";
// Task #4 (teacher assistant) — B2B story. Class weak-point heatmap on SAMPLE data + one-click practice set.
// TODO(team): connect to a real class (teacher accounts + class codes) after the hackathon.
import { uzDecimal } from "@/lib/format/uzNum";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Sparkles } from "lucide-react";
import { t } from "@/i18n/uz";
import { brand } from "@/config/brand";
import { SKILL_BY_ID } from "@/data/skills";
import { generateProblem, seeded, type Problem } from "@/data/problems";

const CLASS_SKILLS = ["frac-equivalent", "lcm", "frac-add-unlike", "frac-sub-unlike", "dec-mul-div", "pct-of-number", "int-add-sub", "eq-one-step"];
const STUDENTS = ["Aziza", "Bekzod", "Dilnoza", "Jasur", "Kamola", "Mirzo", "Nodira", "Otabek", "Sevara", "Temur", "Umida", "Zafar"];

function sampleMastery(): number[][] {
  const r = seeded(2026);
  return STUDENTS.map((_, i) =>
    CLASS_SKILLS.map((s, j) => {
      const base = s.startsWith("frac-add") || s === "frac-sub-unlike" ? 0.35 : s === "pct-of-number" ? 0.5 : 0.72;
      return Math.max(0.05, Math.min(0.98, base + (r() - 0.5) * 0.5 + (i % 4 === 0 ? 0.15 : 0) - (j === 2 && i % 3 === 0 ? 0.1 : 0)));
    }),
  );
}

const cellColor = (p: number) => (p >= 0.85 ? "#22b45a" : p >= 0.5 ? "#ffc42e" : "#ff9d9d");

export default function TeacherPage() {
  const data = useMemo(sampleMastery, []);
  const avg = CLASS_SKILLS.map((_, j) => data.reduce((a, row) => a + row[j], 0) / data.length);
  const weakest = avg.indexOf(Math.min(...avg));
  const [skillIdx, setSkillIdx] = useState(weakest);
  const [set, setSet] = useState<Problem[] | null>(null);

  const generate = () => {
    const r = seeded(Date.now() % 100000);
    setSet(Array.from({ length: 10 }, () => generateProblem(CLASS_SKILLS[skillIdx], r)));
  };

  return (
    <main className="mx-auto min-h-dvh max-w-[1200px] bg-ph px-4 py-6 md:px-6">
      <div className="mb-1 flex items-center justify-between gap-3 print:hidden">
        <Link href="/" className="font-black text-[20px] font-bold no-underline">
          {brand.name}
        </Link>
        <span className="rounded-md bg-soft px-2 text-[12px] font-extrabold">Namuna ma&apos;lumot</span>
      </div>
      <h1 className="m-0 font-black text-[30px] font-bold">{t.teacher.title}</h1>
      <p className="mt-1 text-[15px] font-bold text-mut">6-&ldquo;B&rdquo; sinf · {t.teacher.subtitle}</p>

      <div className="mt-4 overflow-x-auto card p-3 print:hidden">
        <table className="w-full border-separate border-spacing-1 text-[13px]">
          <thead>
            <tr>
              <th className="text-left font-extrabold">{t.teacher.students}</th>
              {CLASS_SKILLS.map((s, j) => (
                <th key={s} className="min-w-[88px] align-bottom font-extrabold">
                  <button type="button" onClick={() => setSkillIdx(j)} className={`w-full rounded-md px-1 py-1 text-left leading-tight ${j === skillIdx ? "bg-gold" : ""}`}>
                    {SKILL_BY_ID[s].title_uz}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STUDENTS.map((n, i) => (
              <tr key={n}>
                <td className="pr-2 font-extrabold whitespace-nowrap">{n}</td>
                {data[i].map((p, j) => (
                  <td key={j} title={`${n}: ${Math.round(p * 100)}%`} className="h-8 rounded-md text-center font-black" style={{ background: cellColor(p) }}>
                    {Math.round(p * 100)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="pr-2 font-extrabold">{t.teacher.avg}</td>
              {avg.map((p, j) => (
                <td key={j} className={`h-9 rounded-md text-center font-black font-bold ${j === weakest ? "ring-2 ring-blue" : ""}`} style={{ background: cellColor(p) }}>
                  {Math.round(p * 100)}%
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="mt-2 flex flex-wrap gap-3 text-[12px] font-extrabold">
          <span className="flex items-center gap-1"><span className="h-3 w-3" style={{ background: "#22b45a" }} /> O&apos;zlashtirildi ≥85</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3" style={{ background: "#ffc42e" }} /> Jarayonda 50–85</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3" style={{ background: "#ff9d9d" }} /> Zaif &lt;50</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
        <div className="text-[15px] font-extrabold">
          {t.teacher.skill}: {SKILL_BY_ID[CLASS_SKILLS[skillIdx]].title_uz}
          {skillIdx === weakest && <span className="ml-2 rounded-md bg-blue px-2 text-[12px] text-white rounded-full">eng zaif</span>}
        </div>
        <button type="button" className="btn btn-primary" onClick={generate}>
          <Sparkles size={18} aria-hidden /> {t.teacher.generate}
        </button>
        {set && (
          <button type="button" className="btn" onClick={() => window.print()}>
            <Printer size={18} aria-hidden /> Chop etish
          </button>
        )}
      </div>

      {set && (
        <section className="mt-4 card p-5">
          <h2 className="m-0 font-black text-[22px]">
            {t.teacher.set}: {SKILL_BY_ID[CLASS_SKILLS[skillIdx]].title_uz}
          </h2>
          <ol className="mt-3 flex flex-col gap-2 pl-6 text-[16px] font-bold">
            {set.map((p) => (
              <li key={p.key}>{uzDecimal(p.q)}</li>
            ))}
          </ol>
          <details className="mt-3">
            <summary className="cursor-pointer text-[14px] font-extrabold">Javoblar (o&apos;qituvchi uchun)</summary>
            <ol className="mt-2 pl-6 text-[14px] font-bold">
              {set.map((p) => (
                <li key={p.key}>{uzDecimal(p.expect.answer)}</li>
              ))}
            </ol>
          </details>
        </section>
      )}
    </main>
  );
}
