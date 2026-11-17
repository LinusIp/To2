import { getDb } from "@/db/client";
import { isMock } from "@/lib/env";

export async function GET() {
  let db = "ok";
  try {
    await getDb();
  } catch (e) {
    db = "error: " + (e as Error).message;
  }
  return Response.json({ ok: true, db, mock: isMock() });
}
