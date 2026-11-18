"use client";
// Which skills a round is about: ?skill=<id> (roadmap node button) or the learner's current path.
import { useEffect, useState } from "react";
import { useMe } from "@/lib/client/me";
import { getCharacter } from "@/config/characters";
import { roundSkills } from "@/lib/games/client";

export function useRound() {
  const { user, roadmap, load, loaded } = useMe();
  const [skills, setSkills] = useState<string[] | null>(null);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!loaded) return;
    const param = new URLSearchParams(window.location.search).get("skill");
    setSkills(roundSkills(param, roadmap));
  }, [loaded, roadmap]);
  return { skills, characterId: getCharacter(user?.characterId).id, roadmap };
}
