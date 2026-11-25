// Tutor greetings ("Ovozini eshit" / tapping a tutor card): a static file first, then /api/tts.
// public/audio/greetings/<id>.wav is exported from production by scripts/export-greetings.mjs (cache hits
// only, 0 credits); src/config/greetingAudio.json lists which tutors have one, so we never request a 404.
import type { Clip } from "./player";
import files from "@/config/greetingAudio.json";

const HAS_FILE = new Set<string>(files as string[]);
/**
 * Tutors whose greeting may come from /api/tts when there is no static file: only lines already cached
 * in production (0 credits). The locked tutors (Agent Shox, Sardor, Ravshan, Diyorbek, Shadow) are
 * uncached (~242 credits in total, not approved), so they stay captions-only: never generate from here.
 */
const API_OK = new Set<string>(["blokbek", "lola", "ziyo"]);

export const greetingFileUrl = (id: string) => `/audio/greetings/${id}.wav`;

const loads = new Map<string, Promise<Clip | null>>();

/** The greeting's static clip, or null (no file / failed). Cached per tutor; call early to prefetch. */
export function greetingClip(id: string): Promise<Clip | null> {
  if (!HAS_FILE.has(id)) return Promise.resolve(null);
  let p = loads.get(id);
  if (!p) {
    p = fetch(greetingFileUrl(id))
      .then(async (r): Promise<Clip | null> => (r.ok && (r.headers.get("content-type") ?? "").startsWith("audio/") ? { blob: await r.blob(), env: null } : null))
      .catch(() => null);
    loads.set(id, p);
    void p.then((c) => {
      if (!c) loads.delete(id);
    });
  }
  return p;
}

/** /api/tts may voice this tutor's greeting (its line is cached in production). */
export const greetingApiAllowed = (id: string) => API_OK.has(id);
