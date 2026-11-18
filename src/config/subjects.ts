// School subjects (the home tiles + what the tutor prompt knows about each one).
// Matematika is the default; a skill without `subject` is maths. To add a subject: a skill graph
// file in src/data/, an entry in SKILL_GRAPHS (src/data/skills.ts) and an entry here.
import { SKILL_GRAPHS, type Skill } from "@/data/skills";

export type SubjectStatus = "live" | "beta" | "soon";

export interface SubjectConfig {
  id: string;
  name: string;
  /** short glyph drawn on the tile */
  icon: string;
  /** tile gradient */
  from: string;
  to: string;
  status: SubjectStatus;
  /** where the tile goes (live / beta subjects) */
  href?: string;
  /** the skill graph file (src/data/…), for docs and tests; the graph itself comes from SKILL_GRAPHS */
  graphFile?: string;
  /** how the tutor calls itself: "Sen {name}san — … uchun do'stona {role}" */
  role: string;
  /** subject-specific teaching notes appended to the system prompt */
  flavour: string;
  /** correct Uzbek terms the tutor should use */
  terms: string;
  /** what must be exact on the board */
  exact: string;
  /** board ops the prompt offers for this subject (the renderer still accepts all) */
  boardOps: string[];
}

const ALL_OPS = ["write", "latex", "line", "rect", "circle", "ellipse", "numberline", "fractionbar", "plot", "highlight", "erase", "pause"];

export const SUBJECTS: SubjectConfig[] = [
  {
    id: "matematika",
    name: "Matematika",
    icon: "x²",
    from: "#4d86ff",
    to: "#2f6bff",
    status: "live",
    href: "/roadmap",
    graphFile: "src/data/skills.uz.json",
    role: "matematika ustozi",
    flavour: "Matematika: har bir hisobni doskada qatorma-qator yoz, \"=\" belgilarini bir chiziqda tut. Kasr, son o'qi va bloklar bilan ko'rsat.",
    terms: "kasr, surat, maxraj, EKUK, EKUB, tenglama, noma'lum, perimetr, yuz",
    exact: "Matematika",
    boardOps: ALL_OPS,
  },
  {
    id: "fizika",
    name: "Fizika",
    icon: "v=s/t",
    from: "#ffa63d",
    to: "#ff8019",
    status: "live",
    href: "/fan/fizika",
    graphFile: "src/data/skills.fizika.uz.json",
    role: "fizika ustozi",
    flavour:
      "FIZIKA: avval hayotiy misol (mashina, velosiped, sumka, g'isht) va oddiy chizma (jism = to'rtburchak, yo'nalish = strelka, masofa = chiziq). Keyin formula harflar bilan, har harfning ma'nosi va BIRLIGI (km, soat, m/s, kg, N, Pa, J, Vt). Misolda doim birliklarni yoz va javobni birligi bilan ayt. Raqamlar oddiy bo'lsin (butun sonlar).",
    terms: "tezlik, masofa, vaqt, massa, kuch, zichlik, bosim, ish, quvvat, nyuton, joul, vatt, paskal",
    exact: "Fizika formulalari, birliklar va hisoblar",
    boardOps: ["write", "latex", "line", "rect", "circle", "numberline", "plot", "highlight", "erase", "pause"],
  },
  {
    id: "any",
    name: "Istalgan mavzu",
    icon: "?",
    from: "#a27bff",
    to: "#7c4dff",
    status: "beta",
    role: "maktab ustozi",
    flavour:
      "ISTALGAN MAVZU (beta): o'quvchi o'zi tanlagan maktab mavzusi (tarix, biologiya, ingliz tili grammatikasi, geografiya, kimyo…). Doskaga faqat qisqa kalit so'zlar, sanalar, sxema (to'rtburchaklar + strelkalar) yoz — uzun gap yozma. Faktlar ANIQ bo'lsin; ishonching komil bo'lmagan sana yoki raqamni aytma. Ingliz tili mavzusida misollarni inglizcha yoz, tushuntirishni o'zbekcha ber.",
    terms: "fanning o'z o'zbekcha atamalari",
    exact: "Faktlar, sanalar va ta'riflar",
    boardOps: ["write", "line", "rect", "circle", "highlight", "erase", "pause"],
  },
  { id: "kimyo", name: "Kimyo", icon: "H₂O", from: "#cfd6ea", to: "#b9c2dc", status: "soon", role: "kimyo ustozi", flavour: "", terms: "", exact: "", boardOps: [] },
  { id: "biologiya", name: "Biologiya", icon: "DNK", from: "#cfd6ea", to: "#b9c2dc", status: "soon", role: "biologiya ustozi", flavour: "", terms: "", exact: "", boardOps: [] },
  { id: "ingliz", name: "Ingliz tili", icon: "Aa", from: "#cfd6ea", to: "#b9c2dc", status: "soon", role: "ingliz tili ustozi", flavour: "", terms: "", exact: "", boardOps: [] },
];

export const DEFAULT_SUBJECT = "matematika";
export const SUBJECT_BY_ID: Record<string, SubjectConfig> = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));

export function getSubject(id: string | undefined): SubjectConfig {
  return SUBJECT_BY_ID[id ?? DEFAULT_SUBJECT] ?? SUBJECT_BY_ID[DEFAULT_SUBJECT];
}

export function subjectOfSkill(skill: Pick<Skill, "subject">): SubjectConfig {
  return getSubject(skill.subject);
}

/** the skill graph of a subject (empty for "any" and "soon" subjects) */
export function subjectSkills(id: string): Skill[] {
  return SKILL_GRAPHS[id] ?? [];
}
