import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  nickname: text("nickname").notNull(),
  grade: integer("grade").notNull(),
  characterId: text("character_id").notNull().default("blokbek"),
  xp: integer("xp").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  lastActiveAt: integer("last_active_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const skillMastery = sqliteTable(
  "skill_mastery",
  {
    userId: text("user_id").notNull(),
    skillId: text("skill_id").notNull(),
    pMastery: real("p_mastery").notNull(),
    attempts: integer("attempts").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skillId] })],
);

export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    skillId: text("skill_id").notNull(),
    problemJson: text("problem_json").notNull(),
    answer: text("answer").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    hintUsed: integer("hint_used", { mode: "boolean" }).notNull().default(false),
    msTaken: integer("ms_taken"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("attempts_user_idx").on(t.userId, t.createdAt)],
);

export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  skillId: text("skill_id").notNull(),
  startedAt: integer("started_at").notNull(),
  finishedAt: integer("finished_at"),
  segmentsJson: text("segments_json"),
});

export const roadmaps = sqliteTable("roadmaps", {
  userId: text("user_id").primaryKey(),
  nodesJson: text("nodes_json").notNull(),
  generatedAt: integer("generated_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type SkillMasteryRow = typeof skillMastery.$inferSelect;
