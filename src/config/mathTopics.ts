// Home-screen subject tiles → groups of curriculum sections (src/data/skills.uz.json).
export interface Subject {
  id: string;
  title: string;
  sections: string[];
  /** big glyph shown on the tile (or an icon key) */
  glyph: string;
  icon?: "triangle" | "bars";
  from: string;
  to: string;
  bar: string;
}

export const SUBJECTS: Subject[] = [
  { id: "algebra", title: "Algebra", sections: ["Ifodalar", "Chiziqli tenglamalar"], glyph: "x²", from: "#4d86ff", to: "#2f6bff", bar: "#2f6bff" },
  { id: "geometriya", title: "Geometriya", sections: ["Geometriya"], glyph: "", icon: "triangle", from: "#34cc6c", to: "#1fa955", bar: "#22b45a" },
  { id: "funksiyalar", title: "Funksiyalar", sections: ["Koordinatalar va grafiklar"], glyph: "", icon: "bars", from: "#ffa63d", to: "#ff8019", bar: "#ff8a1f" },
  { id: "kasrlar", title: "Kasrlar", sections: ["Kasrlar", "O'nli kasrlar", "Foizlar"], glyph: "½", from: "#a27bff", to: "#7c4dff", bar: "#8a5cf6" },
  { id: "sonlar", title: "Sonlar", sections: ["Natural sonlar", "Bo'linish va EKUK/EKUB", "Manfiy sonlar"], glyph: "123", from: "#2fc3d6", to: "#1a9fb3", bar: "#1aa3b8" },
];

export const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));

export function subjectOfSection(section: string): Subject | undefined {
  return SUBJECTS.find((s) => s.sections.includes(section));
}
