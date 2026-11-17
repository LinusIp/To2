"use client";
// Current guest user + roadmap, shared by all screens.
import { create } from "zustand";
import type { PublicUser } from "@/lib/server/repo";
import type { Roadmap } from "@/lib/learning/roadmap";

interface MeState {
  loaded: boolean;
  user: PublicUser | null;
  mastery: Record<string, number>;
  roadmap: Roadmap | null;
  lessonsFinished: number;
  load: (force?: boolean) => Promise<PublicUser | null>;
  setUser: (u: PublicUser) => void;
}

let inflight: Promise<PublicUser | null> | null = null;

export const useMe = create<MeState>((set, get) => ({
  loaded: false,
  user: null,
  mastery: {},
  roadmap: null,
  lessonsFinished: 0,
  setUser: (u) => set({ user: u }),
  load: async (force = false) => {
    if (get().loaded && !force) return get().user;
    if (inflight && !force) return inflight;
    inflight = (async () => {
      try {
        const r = await fetch("/api/user", { cache: "no-store" });
        const j = (await r.json()) as { user: PublicUser | null; mastery?: Record<string, number>; lessonsFinished?: number };
        let roadmap: Roadmap | null = null;
        if (j.user) {
          const rr = await fetch("/api/roadmap", { cache: "no-store" });
          if (rr.ok) roadmap = ((await rr.json()) as { roadmap: Roadmap }).roadmap;
        }
        set({ loaded: true, user: j.user, mastery: j.mastery ?? {}, roadmap, lessonsFinished: j.lessonsFinished ?? 0 });
        return j.user;
      } catch {
        set({ loaded: true });
        return get().user;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },
}));
