// GET /version → { commit, short, dirty, builtAt } — what is live, in one request.
// Also sent as the `x-to2-commit` header. Never cached.
import { BUILD } from "@/lib/build";

export function GET() {
  return Response.json(
    { commit: BUILD.commit, short: BUILD.commit.slice(0, 7), dirty: BUILD.dirty, builtAt: BUILD.builtAt },
    { headers: { "cache-control": "no-store", "x-to2-commit": BUILD.commit.slice(0, 7) } },
  );
}
