// Course towns (src/lib/learning/town.ts): town id ↔ curriculum (src/data/curricula.ts) ↔ town JSON (public/ui/town-<id>.json).
// A town without a curriculum shows as "Tez orada".
export interface TownMeta {
  id: string;
  curriculum: string;
  name: string;
  colour: string;
  /** lessons for this course aren't on this branch yet → every non-game building opens practice */
  practiceOnly?: boolean;
}

export const TOWNS: TownMeta[] = [
  { id: "math", curriculum: "matematika", name: "Matematika shahri", colour: "#2f6bff" },
  { id: "physics", curriculum: "fizika", name: "Fizika shahri", colour: "#ff8a1f", practiceOnly: true },
  { id: "english", curriculum: "ingliz", name: "Ingliz tili shahri", colour: "#22b45a", practiceOnly: true },
];

export const TOWN_BY_ID: Record<string, TownMeta> = Object.fromEntries(TOWNS.map((t) => [t.id, t]));
/** placeholder building count for towns whose JSON hasn't landed yet */
export const TOWN_DEFAULT_SIZE = 7;
