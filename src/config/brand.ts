// The product name lives ONLY here and in src/i18n/uz.ts — the team will rename it.
// (Code identifiers, URLs, package names, the worker, D1 bindings and the x-to2-commit header keep "to2".)
export const brand = {
  name: "Ilmobod",
  shortName: "Ilmobod",
  /** wordmark split: "Ilm" in ink + "obod" in the primary blue */
  wordmark: ["Ilm", "obod"] as const,
  tagline: "Har bir fan — bir shahar. Har bir topshiriq — bir bino.",
  /** header of the towns picker (feat/roadmap reads it on merge) */
  townsHeader: "Ilmobod — shaharni o'qib quring!",
  themeColor: "#2563eb",
} as const;
