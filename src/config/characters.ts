// The 8 voxel tutors (CLAUDE.md §6 roster). All share ONE 3D rig (src/components/characters/voxel.ts);
// a tutor is just this config. Original designs only — no game IP, no weapons.
export type CharacterId = "blokbek" | "agent-shox" | "ziyo" | "lola" | "sardor" | "ravshan" | "diyorbek" | "shadow";

export interface VoxelTop {
  c: string;
  side: string;
  kind: "hoodie" | "jacket" | "vest" | "labcoat";
  print?: string;
  hem?: boolean;
  cuff?: string;
  collar?: string;
  vest?: string;
}

export interface VoxelCfg {
  skin: string;
  hair: string;
  hairStyle: "messy" | "slick" | "hood" | "long" | "cap" | "volume";
  hood?: string;
  cap?: string;
  eyes?: "sun" | "glasses" | "glow";
  female?: boolean;
  top: VoxelTop;
  pants: [string, string];
  shoes: string;
  sole: string;
  acc: ("neckphones" | "hoodup" | "headphones" | "longhair" | "flower" | "cap" | "labcoat" | "glow")[];
}

export interface CharacterConfig {
  id: CharacterId;
  name: string;
  /** short tagline shown in the UI */
  tag: string;
  /** greeting spoken on the choose-tutor screen ("Ovozini eshit") */
  hi: string;
  /** teaching style, fed to the LLM prompt */
  style: string;
  catchphrases_uz: string[];
  /** MVP: "soon" tutors are shown (with their art) but can't be picked yet */
  status: "playable" | "soon";
  /** XP needed; "streak" = hidden, unlocked by a 7-day streak (applies once status is "playable") */
  unlock: number | "streak";
  /** kept for older code paths */
  unlockXp: number;
  color: string;
  voxel: VoxelCfg;
  /**
   * VoiceLab TTS: model (lison = v1 flat; lison-v2 = "Expressive", takes [happy]/[excited]/[calm]
   * tags, 1.5 credits/char) and base speed (v2 speaks ~1.4× slower than v1 at speed 1).
   * Voice ids live in src/lib/ai/index.ts (overridable with the VOICE_IDS var). A/B in REPORT.md.
   */
  tts?: { model: "lison" | "lison-v2"; speed: number };
}

export const DEFAULT_TTS = { model: "lison", speed: 1 } as const;

const C = (c: Omit<CharacterConfig, "unlockXp">): CharacterConfig => ({ ...c, unlockXp: c.unlock === "streak" ? 9999 : c.unlock });

export const CHARACTERS: CharacterConfig[] = [
  C({
    id: "blokbek",
    name: "Blokbek",
    tag: "Matematika ustasi",
    hi: "Salom! Men Blokbek. Matematikani blokma-blok quramiz!",
    style: "Do'stona va sabrli. Yechimni bloklar kabi qadam-baqadam quradi: \"Keling, blokma-blok quramiz!\"",
    catchphrases_uz: ["Keling, blokma-blok quramiz!", "Zo'r qurilish!", "Yana bitta blok qo'shamiz."],
    unlock: 0,
    status: "playable",
    tts: { model: "lison-v2", speed: 1.28 }, // Javohir — friendly builder
    color: "#2f6bff",
    voxel: { skin: "#c98b5e", hair: "#2b1d14", hairStyle: "messy", top: { c: "#24262d", side: "#1b1d22", kind: "hoodie", print: "To2", hem: true, cuff: "#e0873a" }, pants: ["#34446a", "#3d5080"], shoes: "#f2f2f2", sole: "#3b6fd9", acc: ["neckphones"] },
  }),
  C({
    id: "agent-shox",
    name: "Agent Shox",
    tag: "Aqlli strateg",
    hi: "Agent Shox. Har bir masala — bu missiya. Rejani tuzamiz.",
    style: "Xotirjam va jiddiy. Har bir masala — missiya, avval reja tuziladi, keyin vazifalar bajariladi.",
    catchphrases_uz: ["Missiya boshlandi!", "Vazifa bajarildi!", "Rejaga amal qilamiz."],
    unlock: 0,
    status: "soon",
    color: "#2a2d33",
    voxel: { skin: "#d9a273", hair: "#17171a", hairStyle: "slick", eyes: "sun", top: { c: "#2a2d33", side: "#1f2126", kind: "jacket", collar: "#3a3e46" }, pants: ["#26282e", "#2d3037"], shoes: "#1a1a1c", sole: "#444444", acc: [] },
  }),
  C({
    id: "lola",
    name: "Lola",
    tag: "Mehribon tutor",
    hi: "Salom, men Lola. Xato qilsang ham qo'rqma — birga tushunamiz.",
    style: "Iliq va sabrli. Xatodan keyin albatta rag'batlantiradi, hech qachon shoshirmaydi.",
    catchphrases_uz: ["Xato — bu o'rganish!", "Juda yaxshi!", "Sekin-asta, birga."],
    unlock: 0,
    status: "playable",
    tts: { model: "lison-v2", speed: 1.22 }, // Gulya — warm, patient (female)
    color: "#e0457b",
    voxel: { skin: "#d9a273", hair: "#241812", hairStyle: "long", female: true, top: { c: "#f1ede6", side: "#d9d3c8", kind: "vest", vest: "#e0457b" }, pants: ["#34446a", "#3d5080"], shoes: "#ffffff", sole: "#e0457b", acc: ["longhair", "flower"] },
  }),
  C({
    id: "ziyo",
    name: "Ziyo",
    tag: "Bilimga chanqoq",
    hi: "Men Ziyo! Doim so'rayman: nega? Keling, birga bilib olamiz!",
    style: "Qiziquvchan, ko'p \"nega?\" deb so'raydi va o'quvchini o'zi kashf qilishga undaydi.",
    catchphrases_uz: ["Nega shunday ekan?", "Keling, tekshirib ko'ramiz!", "Qiziq-a?"],
    unlock: 0,
    status: "playable",
    tts: { model: "lison-v2", speed: 1.3 }, // Rustam — curious, young
    color: "#3c9a3c",
    voxel: { skin: "#d39a6c", hair: "#2b1d14", hairStyle: "hood", hood: "#3c9a3c", top: { c: "#3c9a3c", side: "#2f7d2f", kind: "hoodie" }, pants: ["#2f3a2f", "#36433a"], shoes: "#f2f2f2", sole: "#3c9a3c", acc: ["hoodup", "headphones"] },
  }),
  C({
    id: "sardor",
    name: "Sardor",
    tag: "Mantiq ustasi",
    hi: "Sardor. Qisqa va aniq: mantiq bilan yechamiz.",
    style: "Mantiq birinchi o'rinda. Qisqa, aniq gapiradi, har qadamni asoslaydi.",
    catchphrases_uz: ["Mantiqan o'ylaymiz.", "Aniq va qisqa.", "Isbotlandi."],
    unlock: 300,
    status: "soon",
    color: "#1f2a3a",
    voxel: { skin: "#c98b5e", hair: "#1e1611", hairStyle: "cap", cap: "#1d1f24", top: { c: "#1f2a3a", side: "#18212e", kind: "jacket", collar: "#2a374b" }, pants: ["#23262c", "#2a2e35"], shoes: "#1a1a1c", sole: "#666666", acc: ["cap"] },
  }),
  C({
    id: "ravshan",
    name: "Ravshan",
    tag: "Hisobchi",
    hi: "Ravshan — tez hisob ustasi. Sizga sirli usullarni o'rgataman!",
    style: "Tez og'zaki hisob, qulay usullar va hiylalarni o'rgatadi. Shiddatli va quvnoq.",
    catchphrases_uz: ["Tez hisoblaymiz!", "Mana sirli usul!", "Chaqqon!"],
    unlock: 400,
    status: "soon",
    color: "#9a4a22",
    voxel: { skin: "#e0b08a", hair: "#9a4a22", hairStyle: "volume", top: { c: "#d9d4cc", side: "#bdb7ad", kind: "jacket", collar: "#ffffff" }, pants: ["#4a4f5a", "#555b67"], shoes: "#2a2a2a", sole: "#9a4a22", acc: ["headphones"] },
  }),
  C({
    id: "diyorbek",
    name: "Diyorbek",
    tag: "Ilmiy yordamchi",
    hi: "Diyorbek. Har bir formulaning ortida haqiqiy hayot bor.",
    style: "\"Nega\"ni tushuntiradi, hayotiy va ilmiy misollar keltiradi.",
    catchphrases_uz: ["Hayotda bu shunday ishlaydi.", "Tajriba qilamiz!", "Ilm — kuch."],
    unlock: 500,
    status: "soon",
    color: "#3b6fd9",
    voxel: { skin: "#c98b5e", hair: "#2b1d14", hairStyle: "messy", eyes: "glasses", top: { c: "#f0efea", side: "#d6d4cc", kind: "labcoat" }, pants: ["#2b2d33", "#33363d"], shoes: "#1a1a1c", sole: "#777777", acc: ["labcoat"] },
  }),
  C({
    id: "shadow",
    name: "Shadow",
    tag: "Maxfiy qahramon",
    hi: "Sirli masalalar seni kutmoqda…",
    style: "Sirli, topishmoqlar bilan gapiradi, lekin matematikani aniq tushuntiradi.",
    catchphrases_uz: ["Topishmoq yechildi.", "Sir ochildi…", "Yana bir sir."],
    unlock: "streak",
    status: "soon",
    color: "#7b4dff",
    voxel: { skin: "#15111d", hair: "#2a2238", hairStyle: "hood", hood: "#2a2238", eyes: "glow", top: { c: "#2a2238", side: "#1f192b", kind: "hoodie" }, pants: ["#1f1a28", "#241e2f"], shoes: "#1a1622", sole: "#7b4dff", acc: ["hoodup", "glow"] },
  }),
];

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c])) as Record<CharacterId, CharacterConfig>;
export const CHARACTER_IDS = CHARACTERS.map((c) => c.id) as [CharacterId, ...CharacterId[]];

/** MVP: tutors the learner can actually pick and learn with. */
export const PLAYABLE = CHARACTERS.filter((c) => c.status === "playable");

/**
 * The tutor to USE for a learner (lesson, voice, avatars). Unknown or not-yet-playable ids
 * (e.g. a guest who picked Agent Shox before the MVP cut) fall back to Blokbek.
 * To show a specific card regardless of status, use CHARACTER_BY_ID.
 */
export function getCharacter(id: string | undefined | null): CharacterConfig {
  const c = CHARACTER_BY_ID[(id ?? "blokbek") as CharacterId];
  return c && c.status === "playable" ? c : CHARACTERS[0];
}

export function isUnlocked(id: CharacterId, xp: number, streak = 0): boolean {
  const c = CHARACTER_BY_ID[id];
  if (!c || c.status !== "playable") return false;
  return c.unlock === "streak" ? streak >= 7 : xp >= c.unlock;
}

export function lockText(c: CharacterConfig, xp: number): string {
  if (c.status === "soon") return "Tez orada";
  return c.unlock === "streak" ? "7 kunlik seriya" : `${c.unlock} XP · ${Math.max(0, c.unlock - xp)} qoldi`;
}
