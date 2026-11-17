// GET /dev/credits[?day=YYYY-MM-DD] → VoiceLab TTS spend: today's total (Tashkent day), by tutor,
// source (live / prefetch / answer / warm) and model, plus the daily cap. Works in production
// (totals only, nothing personal) so the team can watch the budget during the demo.
import { creditRows, creditsSummary } from "@/lib/server/credits";

// ?since=<ms epoch> → also the individual clips generated since then (text, tutor, source, model, credits)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const day = q.get("day") ?? undefined;
  const since = Number(q.get("since") ?? NaN);
  const s = await creditsSummary(day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined);
  const rows = Number.isFinite(since) ? await creditRows(since) : undefined;
  return Response.json(rows ? { ...s, rows } : s, { headers: { "cache-control": "no-store" } });
}
