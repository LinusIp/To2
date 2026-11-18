// A subject's skill graph as a simple path (prerequisites first), e.g. /fan/fizika.
// Lessons use the same board + tutor; the pinned demo lesson is marked.
import Link from "next/link";
import AppShell from "@/components/ui/AppShell";
import { ArrowIcon, BackIcon } from "@/components/ui/icons";
import { getSubject, SUBJECT_BY_ID, subjectSkills } from "@/config/subjects";
import { getSkill, topoOrder } from "@/data/skills";
import { DEMO_LESSONS } from "@/lib/ai/mock/lessons";
import { t } from "@/i18n/uz";

export default async function SubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const known = SUBJECT_BY_ID[subjectId];
  const subject = getSubject(subjectId);
  const skills = known ? topoOrder(subjectSkills(subject.id)) : [];
  const sections = [...new Set(skills.map((s) => s.section))];

  return (
    <AppShell>
      <div className="px-[18px] pt-3 pb-6 md:px-2 md:pt-6">
        <div className="flex h-[52px] items-center gap-3">
          <Link href="/home" aria-label={t.tabs.home} title={t.tabs.home} className="icon-btn bg-white">
            <BackIcon />
          </Link>
          <div className="min-w-0">
            <h1 className="m-0 text-[26px] leading-tight font-black">{subject.name}</h1>
            <div className="text-[13px] font-extrabold text-mut">
              {skills.length ? `${t.common.grade(skills[0].grade)} · ${t.subject.skills(skills.length)}` : t.home.soon}
            </div>
          </div>
        </div>
        {skills.length > 0 && <p className="mt-2 mb-1 text-[13px] font-bold text-mut">{t.subject.graphHint}</p>}
        {sections.map((sec) => (
          <section key={sec} className="mt-4">
            <h2 className="m-0 mb-2 text-[17px] font-black">{sec}</h2>
            <div className="flex flex-col gap-2.5">
              {skills
                .filter((s) => s.section === sec)
                .map((s) => {
                  const demo = !!DEMO_LESSONS[s.id];
                  return (
                    <Link
                      key={s.id}
                      href={`/lesson/${s.id}`}
                      className={`card flex min-h-[64px] items-center gap-3 p-3.5 no-underline ${demo ? "ring-2 ring-[#ff8a1f]" : ""}`}
                    >
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[15px] font-black text-white"
                        style={{ background: `linear-gradient(160deg,${subject.from},${subject.to})` }}
                        aria-hidden
                      >
                        {skills.indexOf(s) + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[16px] font-black">{s.title_uz}</span>
                          {demo && <span className="rounded-full bg-[#fff0de] px-2 py-0.5 text-[11px] font-black text-[#c25a00]">{t.subject.demo}</span>}
                        </div>
                        {s.prereqs.length > 0 && (
                          <div className="truncate text-[12px] font-bold text-mut">
                            {t.subject.needs} {s.prereqs.map((p) => getSkill(p)?.title_uz ?? p).join(", ")}
                          </div>
                        )}
                      </div>
                      <ArrowIcon size={18} />
                    </Link>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
