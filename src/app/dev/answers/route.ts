// GET /dev/answers → which path answered YOUR last live questions (this browser's session only):
// source (pinned / interrupt-cache / llm / rate-limited / llm-failed / mock), the normalized question,
// the cache key, the step, where it was written (slate / main board), segments and time.
// Works in production. The same `source` is printed in the browser console for every answer.
import { recentAnswers } from "@/lib/server/answerLog";
import { userIdFor } from "@/lib/server/session";

export async function GET(req: Request) {
  const userId = await userIdFor(req);
  if (!userId) return Response.json({ error: "no session: open the app in this browser first" }, { status: 401, headers: { "cache-control": "no-store" } });
  const rows = (await recentAnswers(userId)) as { at: number }[];
  return Response.json(
    { answers: rows.map((r) => ({ ...r, at: new Date(r.at).toISOString() })) },
    { headers: { "cache-control": "no-store" } },
  );
}
