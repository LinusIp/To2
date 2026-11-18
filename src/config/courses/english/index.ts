// English (Ingliz tili) course — config + prompt flavour + pinned demo lesson.
// TODO(main agent): register this course in the subjects registry from feat/subjects
// (tile on home, skill lookup in getSkill, flavour in tutor.uz.ts, demo in DEMO_LESSONS) — see REPORT.md.
import raw from "./skills.json";
import { EN_TO_BE } from "./demoLesson";
import type { Course, CourseSkill } from "./types";

export const ENGLISH_SKILLS: CourseSkill[] = raw as CourseSkill[];

export const ENGLISH: Course = {
  id: "ingliz",
  name: "Ingliz tili",
  glyph: "Aa",
  from: "#36c48f",
  to: "#159a6b",
  status: "beta",
  skills: ENGLISH_SKILLS,
  demo: { skillId: "en-to-be", segments: EN_TO_BE },
  flavour: {
    teacher: "ingliz tili ustozi",
    exact: "Grammatika va imlo ANIQ bo'lsin: inglizcha misollar to'g'ri yozilsin.",
    terms: "fe'l, ot, olmosh, sifat, artikl, zamon, birlik, ko'plik, gap, qisqa shakl",
    board:
      "Doskada inglizcha misollarni yoz (to'g'ri imlo bilan), har biri alohida qatorda; qoida yoki shakllarni rangli qilib ajrat; kerak bo'lsa o'zbekcha tarjimani yonida kichik (s) qilib yoz.",
    rules: [
      "Tushuntirish faqat o'zbek tilida; inglizcha so'z va gaplar faqat misol sifatida.",
      "\"say\" ichida inglizcha so'zlarni o'zbek ovozi to'g'ri o'qiydigan qilib yoz: I am → \"ay em\", is → \"iz\", teacher → \"ticher\". Doskada esa haqiqiy inglizcha yozuv.",
      "\"say\" da bir segmentda ko'pi bilan 2 ta inglizcha ibora.",
      "\"ask\" uchun \"expect.kind\":\"choice\", 2–4 ta \"choices\" (inglizcha so'zlar), \"answer\" — choices dan biri, aynan shu yozuvda.",
    ],
    scope: "ingliz tiliga",
    length: "6–8",
  },
  boardOps: ["write", "line", "rect", "highlight", "erase", "pause", "strike", "arrow", "tick", "divider"],
};

export function englishSkill(id: string): CourseSkill | undefined {
  return ENGLISH_SKILLS.find((s) => s.id === id);
}
