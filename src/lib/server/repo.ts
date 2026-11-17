// Data access for users, mastery and attempts (Drizzle on D1).
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { levelFromXp, nextStreak, updateMastery, xpInLevel, XP_PER_LEVEL, P_START } from "@/lib/learning/mastery";
import { buildRoadmap, type Roadmap } from "@/lib/learning/roadmap";

export type UserRow = typeof schema.users.$inferSelect;

export async function getUser(id: string | null): Promise<UserRow | null> {
  if (!id) return null;
  const db = await getDb();
  const r = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return r[0] ?? null;
}

export async function createUser(u: { nickname: string; grade: number; characterId: string }): Promise<UserRow> {
  const db = await getDb();
  const now = Date.now();
  const row: UserRow = { id: crypto.randomUUID(), nickname: u.nickname, grade: u.grade, characterId: u.characterId, xp: 0, streakDays: 1, lastActiveAt: now, createdAt: now };
  await db.insert(schema.users).values(row);
  return row;
}

export async function updateUser(id: string, patch: Partial<Pick<UserRow, "nickname" | "grade" | "characterId">>) {
  const db = await getDb();
  await db.update(schema.users).set(patch).where(eq(schema.users.id, id));
}

export async function deleteUser(id: string) {
  const db = await getDb();
  await db.batch([
    db.delete(schema.attempts).where(eq(schema.attempts.userId, id)),
    db.delete(schema.skillMastery).where(eq(schema.skillMastery.userId, id)),
    db.delete(schema.lessons).where(eq(schema.lessons.userId, id)),
    db.delete(schema.roadmaps).where(eq(schema.roadmaps.userId, id)),
    db.delete(schema.users).where(eq(schema.users.id, id)),
  ]);
}

export async function getMastery(userId: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.select().from(schema.skillMastery).where(eq(schema.skillMastery.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.skillId, r.pMastery]));
}

export async function setMasteryBulk(userId: string, m: Record<string, number>) {
  const db = await getDb();
  const now = Date.now();
  const entries = Object.entries(m);
  if (!entries.length) return;
  await db.batch(
    entries.map(([skillId, p]) =>
      db
        .insert(schema.skillMastery)
        .values({ userId, skillId, pMastery: p, attempts: 0, correct: 0, updatedAt: now })
        .onConflictDoUpdate({ target: [schema.skillMastery.userId, schema.skillMastery.skillId], set: { pMastery: p, updatedAt: now } }),
    ) as [never, ...never[]],
  );
}

/** Record an answer: mastery (BKT-lite), attempts log, XP, streak. */
export async function recordAnswer(opts: {
  userId: string;
  skillId: string;
  problem: unknown;
  answer: string;
  correct: boolean;
  hintUsed: boolean;
  xp: number;
  msTaken?: number;
}) {
  const db = await getDb();
  const now = Date.now();
  const [cur] = await db
    .select()
    .from(schema.skillMastery)
    .where(and(eq(schema.skillMastery.userId, opts.userId), eq(schema.skillMastery.skillId, opts.skillId)))
    .limit(1);
  const before = cur?.pMastery ?? P_START;
  const p = updateMastery(before, opts.correct, opts.hintUsed);
  const user = await getUser(opts.userId);
  const streak = user ? nextStreak(user.streakDays, user.lastActiveAt, now) : 1;
  await db.batch([
    db
      .insert(schema.skillMastery)
      .values({ userId: opts.userId, skillId: opts.skillId, pMastery: p, attempts: 1, correct: opts.correct ? 1 : 0, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.skillMastery.userId, schema.skillMastery.skillId],
        set: { pMastery: p, attempts: (cur?.attempts ?? 0) + 1, correct: (cur?.correct ?? 0) + (opts.correct ? 1 : 0), updatedAt: now },
      }),
    db.insert(schema.attempts).values({
      id: crypto.randomUUID(),
      userId: opts.userId,
      skillId: opts.skillId,
      problemJson: JSON.stringify(opts.problem).slice(0, 2000),
      answer: opts.answer.slice(0, 200),
      isCorrect: opts.correct,
      hintUsed: opts.hintUsed,
      msTaken: opts.msTaken ?? null,
      createdAt: now,
    }),
    db
      .update(schema.users)
      .set({ xp: (user?.xp ?? 0) + opts.xp, streakDays: streak, lastActiveAt: now })
      .where(eq(schema.users.id, opts.userId)),
  ]);
  return { p, before, xp: (user?.xp ?? 0) + opts.xp, streak };
}

export async function addXp(userId: string, xp: number) {
  const user = await getUser(userId);
  if (!user) return;
  const db = await getDb();
  const now = Date.now();
  await db
    .update(schema.users)
    .set({ xp: user.xp + xp, streakDays: nextStreak(user.streakDays, user.lastActiveAt, now), lastActiveAt: now })
    .where(eq(schema.users.id, userId));
}

export async function recentMistakes(userId: string, skillId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.attempts)
    .where(and(eq(schema.attempts.userId, userId), eq(schema.attempts.skillId, skillId), eq(schema.attempts.isCorrect, false)))
    .orderBy(desc(schema.attempts.createdAt))
    .limit(3);
  return rows.map((r) => {
    try {
      const p = JSON.parse(r.problemJson) as { q?: string };
      return `${p.q ?? "?"} → "${r.answer}"`;
    } catch {
      return r.answer;
    }
  });
}

export async function roadmapFor(user: UserRow): Promise<Roadmap> {
  const m = await getMastery(user.id);
  return buildRoadmap(m, user.grade, { touched: Object.keys(m) });
}

export async function saveRoadmap(userId: string, rm: Roadmap) {
  const db = await getDb();
  const nodesJson = JSON.stringify({ path: rm.path, currentId: rm.currentId });
  await db
    .insert(schema.roadmaps)
    .values({ userId, nodesJson, generatedAt: Date.now() })
    .onConflictDoUpdate({ target: schema.roadmaps.userId, set: { nodesJson, generatedAt: Date.now() } });
}

export async function startLessonRow(userId: string, skillId: string) {
  const db = await getDb();
  await db.insert(schema.lessons).values({ id: crypto.randomUUID(), userId, skillId, startedAt: Date.now() });
}

export async function finishLessonRow(userId: string, skillId: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.lessons)
    .where(and(eq(schema.lessons.userId, userId), eq(schema.lessons.skillId, skillId)))
    .orderBy(desc(schema.lessons.startedAt))
    .limit(1);
  if (row && !row.finishedAt) await db.update(schema.lessons).set({ finishedAt: Date.now() }).where(eq(schema.lessons.id, row.id));
  return !!row && !row.finishedAt;
}

export async function lessonsFinished(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select().from(schema.lessons).where(eq(schema.lessons.userId, userId));
  return rows.filter((r) => r.finishedAt).length;
}

export function publicUser(u: UserRow) {
  return {
    id: u.id,
    nickname: u.nickname,
    grade: u.grade,
    characterId: u.characterId,
    xp: u.xp,
    streak: u.streakDays,
    level: levelFromXp(u.xp),
    xpInLevel: xpInLevel(u.xp),
    xpPerLevel: XP_PER_LEVEL,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;
