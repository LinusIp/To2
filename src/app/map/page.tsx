"use client";
// "Aql xaritasi": the whole subject as a mind map + the learner's personal path (src/lib/learning/path.ts).
// Subject comes from ?subject= (default maths) — other subjects plug in via src/data/curricula.ts.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AppShell, { ScreenTop } from "@/components/ui/AppShell";
import MindMap, { STATUS_STYLE } from "@/components/roadmap/MindMap";
import { ArrowIcon, CheckIcon, LockIcon } from "@/components/ui/icons";
import { useMe } from "@/lib/client/me";
import { getCurriculum } from "@/data/curricula";
import { buildMindMap, buildPath, type MindLeaf, type PathStep, type StepStatus } from "@/lib/learning/path";

function StatusChip({ status, order }: { status: StepStatus; order?: number }) {
  const st = STATUS_STYLE[status];
  return (
    <span className="grid h-9 w-9 flex-none place-items-center rounded-xl text-[14px] font-black" style={{ background: st.fill, color: st.text, border: `2px solid ${st.stroke}` }} aria-hidden>
      {status === "mastered" ? <CheckIcon size={16} /> : status === "locked" ? <LockIcon size={14} /> : order || "+"}
    </span>
  );
}

const STATUSES: StepStatus[] = ["mastered", "current", "next", "locked", "optional"];

export default function MindMapPage() {
  const router = useRouter();
  const { user, mastery, roadmap, load, loaded } = useMe();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void load(true).then((u) => {
      if (!u) router.replace("/onboarding");
    });
    setSubjectId(new URLSearchParams(window.location.search).get("subject"));
  }, [load, router]);

  const curriculum = getCurriculum(subjectId);
  const grade = user?.grade ?? 6;
  const started = useMemo(() => roadmap?.nodes.filter((n) => n.started).map((n) => n.id) ?? [], [roadmap]);
  const path = useMemo(() => buildPath(curriculum, mastery, grade, { touched: Object.keys(mastery), started }), [curriculum, mastery, grade, started]);
  const map = useMemo(() => buildMindMap(curriculum, mastery, path, { grade, maxGrade: Math.max(grade, 6) + 1 }), [curriculum, mastery, path, grade]);
  const titleOf = (id: string) => curriculum.skills.find((s) => s.id === id)?.title_uz ?? id;

  const leaves = map.branches.flatMap((b) => b.leaves.map((l) => ({ ...l, section: b.section })));
  const sel = selected ? leaves.find((l) => l.id === selected) : undefined;
  const selStep = selected ? path.steps.find((s) => s.id === selected) : undefined;
  const current = path.steps.find((s) => s.status === "current");

  const select = (id: string) => {
    setSelected(id === selected ? null : id);
    setFocus(null);
  };

  return (
    <AppShell>
      <ScreenTop title={t.mindmap.title} back="/roadmap" />
      <div className="flex flex-col gap-4 px-[18px] pb-8 md:px-2">
        {!loaded ? (
          <div className="p-6 text-center font-extrabold text-mut">{t.common.loading}</div>
        ) : (
          <>
            <p className="m-0 text-[14px] leading-[1.35] font-extrabold text-mut">{t.mindmap.intro}</p>

            {current && (
              <Link href={`/lesson/${current.id}`} className="btn btn-primary w-full">
                {t.roadmap.continue}: {current.title} <ArrowIcon />
              </Link>
            )}

            <div className="card p-2">
              <MindMap map={map} focus={focus} selected={selected} onFocus={(s) => (setFocus(s), setSelected(null))} onSelect={select} />
              <div className="px-2 pb-1 text-center text-[12px] font-extrabold text-mut">
                {t.mindmap.mastered(map.mastered, map.total)} · {t.mindmap.tapHint}
              </div>
            </div>

            <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-2 p-0" aria-label={t.mindmap.legend}>
              {STATUSES.map((s) => (
                <li key={s} className="flex items-center gap-1.5 text-[12px] font-extrabold">
                  <span className="scale-75">
                    <StatusChip status={s} order={s === "next" || s === "current" ? 1 : undefined} />
                  </span>
                  {t.roadmap.status[s]}
                </li>
              ))}
            </ul>

            {sel && <SkillCard leaf={sel} section={sel.section} step={selStep} titleOf={titleOf} onClose={() => setSelected(null)} />}

            {focus && !sel && (
              <section aria-label={t.mindmap.section(focus)} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h2 className="m-0 text-[17px] font-black">{t.mindmap.section(focus)}</h2>
                  <button type="button" className="btn btn-soft min-h-10 px-4 text-[13px]" onClick={() => setFocus(null)}>
                    {t.mindmap.close}
                  </button>
                </div>
                {map.branches
                  .find((b) => b.section === focus)
                  ?.leaves.map((l) => (
                    <button key={l.id} type="button" onClick={() => select(l.id)} className="card flex min-h-11 w-full items-center gap-3 px-3.5 py-2.5 text-left">
                      <StatusChip status={l.status} order={l.order} />
                      <span className="flex-1 text-[15px] font-extrabold">{l.title}</span>
                      <span className="text-[12px] font-black text-mut">{t.roadmap.status[l.status]}</span>
                    </button>
                  ))}
              </section>
            )}

            <section aria-label={t.mindmap.yourPath} className="flex flex-col gap-2">
              <h2 className="m-0 text-[17px] font-black">{t.mindmap.yourPath}</h2>
              {path.steps.length === 0 ? (
                <div className="card p-4 text-[14px] font-extrabold text-mut">{t.mindmap.pathEmpty}</div>
              ) : (
                <ol className="m-0 flex list-none flex-col gap-2 p-0">
                  {path.steps.map((s) => (
                    <li key={s.id}>
                      <PathRow step={s} titleOf={titleOf} />
                    </li>
                  ))}
                </ol>
              )}
              {!roadmap?.currentId && (
                <Link href="/diagnostic" className="btn w-full">
                  {t.home.diagnostic}
                </Link>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function reasonText(step: PathStep, titleOf: (id: string) => string) {
  return step.reason.kind === "weak" ? t.mindmap.reasonWeak : t.mindmap.reasonPrereq(titleOf(step.reason.of));
}

function PathRow({ step, titleOf }: { step: PathStep; titleOf: (id: string) => string }) {
  const body = (
    <>
      <StatusChip status={step.status} order={step.order} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold">{step.title}</span>
        <span className="block text-[12px] font-extrabold text-mut">
          {step.status === "locked" && step.lockedBy ? t.mindmap.lockedBy(titleOf(step.lockedBy)) : reasonText(step, titleOf)}
        </span>
      </span>
      <span className="text-[12px] font-black text-mut">{t.roadmap.status[step.status]}</span>
    </>
  );
  if (step.status === "locked")
    return (
      <div className="flex w-full items-center gap-3 rounded-[22px] bg-[#e9edf7] px-3.5 py-3 text-[#4f5878]" aria-disabled>
        {body}
      </div>
    );
  return (
    <Link href={step.status === "mastered" ? `/practice/${step.id}` : `/lesson/${step.id}`} className={`card flex w-full items-center gap-3 px-3.5 py-3 no-underline ${step.status === "current" ? "node-current" : ""}`}>
      {body}
    </Link>
  );
}

function SkillCard({ leaf, section, step, titleOf, onClose }: { leaf: MindLeaf; section: string; step?: PathStep; titleOf: (id: string) => string; onClose: () => void }) {
  const locked = leaf.status === "locked";
  return (
    <section className="card flex flex-col gap-2 p-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <StatusChip status={leaf.status} order={leaf.order} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-extrabold text-mut">
            {section} · {leaf.grade}-sinf
          </div>
          <div className="text-[17px] leading-[1.2] font-black">{leaf.title}</div>
          <div className="mt-1 text-[13px] font-extrabold">
            {t.roadmap.status[leaf.status]} · {Math.round(leaf.p * 100)}%
          </div>
          {step && <div className="text-[12px] font-extrabold text-mut">{step.status === "locked" && step.lockedBy ? t.mindmap.lockedBy(titleOf(step.lockedBy)) : reasonText(step, titleOf)}</div>}
        </div>
        <button type="button" className="icon-btn" aria-label={t.mindmap.close} title={t.mindmap.close} onClick={onClose}>
          ×
        </button>
      </div>
      {!locked && (
        <Link href={leaf.status === "mastered" ? `/practice/${leaf.id}` : `/lesson/${leaf.id}`} className="btn w-full">
          {leaf.status === "mastered" ? t.mindmap.practice : t.mindmap.start} <ArrowIcon />
        </Link>
      )}
    </section>
  );
}
