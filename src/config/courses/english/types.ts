// A "course" = one school subject the same board + tutor can teach (CLAUDE.md feedback: not only maths).
// Self-contained on purpose: feat/subjects owns the shared subjects registry; the main agent maps
// this shape onto it when merging (see REPORT.md "Languages"). Nothing here is wired into the app yet.
import type { BoardCommand, LessonSegment } from "@/lib/ai/schema";

export type CourseBoardOp = BoardCommand["op"];

export interface CourseSkill {
  id: string;
  title_uz: string;
  grade: number;
  prereqs: string[];
  section: string;
}

/** How the tutor talks and draws in this subject — appended to the tutor's system prompt. */
export interface CourseFlavour {
  /** who the tutor is: "ingliz tili ustozi" */
  teacher: string;
  /** what must be exact */
  exact: string;
  /** Uzbek school terms to use */
  terms: string;
  /** how this subject uses the board */
  board: string;
  /** extra rules (language of examples, how English is spoken by the Uzbek voice…) */
  rules: string[];
  /** off-topic rule: "Savol ${scope} aloqasiz bo'lsa" */
  scope: string;
  /** segments per lesson, e.g. "6–8" */
  length: string;
}

export interface Course {
  id: string;
  name: string;
  /** short glyph for the home tile */
  glyph: string;
  from: string;
  to: string;
  status: "ready" | "beta" | "soon";
  skills: CourseSkill[];
  /** the pinned, hand-written lesson (instant, voice pre-cached) */
  demo: { skillId: string; segments: LessonSegment[] };
  flavour: CourseFlavour;
  /** board commands the LLM may use in this course */
  boardOps: CourseBoardOp[];
}
