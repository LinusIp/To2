// GET /dev/credits[?day=YYYY-MM-DD] → VoiceLab TTS spend: today's total (Tashkent day), by tutor,
// source (live / prefetch / answer / warm) and model, plus the daily cap. Works in production
// (totals only, nothing personal) so the team can watch the budget during the demo.
import { creditsSummary } from "@/lib/server/credits";

export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get("day") ?? undefined;
  const s = await creditsSummary(day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined);
  return Response.json(s, { headers: { "cache-control": "no-store" } });
}
