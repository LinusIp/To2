"use client";
// "Qahramonlar" — change tutor (prototype screen 4).
import { useEffect, useState } from "react";
import { t } from "@/i18n/uz";
import AppShell, { ScreenTop } from "@/components/ui/AppShell";
import TutorPicker from "@/components/characters/TutorPicker";
import { getCharacter, type CharacterId } from "@/config/characters";
import { useMe } from "@/lib/client/me";
import type { PublicUser } from "@/lib/server/repo";

export default function TutorsPage() {
  const { user, load, setUser } = useMe();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void load();
  }, [load]);
  const value = getCharacter(user?.characterId).id;

  const choose = async (id: CharacterId) => {
    setErr(null);
    if (!user) return;
    setUser({ ...user, characterId: id });
    const r = await fetch("/api/user", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ characterId: id }) });
    const j = (await r.json()) as { error?: string; user?: PublicUser };
    if (!r.ok || !j.user) {
      setErr(j.error ?? t.common.error);
      setUser(user);
    } else {
      setUser(j.user);
      void import("@/components/characters/glbTutor").then((m) => m.preloadGlb(id));
    }
  };

  return (
    <AppShell>
      <ScreenTop title={t.tutors.title} back="/settings" />
      <div className="px-[18px] pb-6 md:px-2">
        {err && (
          <div role="alert" className="mb-3 rounded-[14px] bg-[#fff4e8] px-3.5 py-2.5 text-[14px] font-extrabold text-[#c2410c]">
            {err}
          </div>
        )}
        <TutorPicker value={value} onChange={(id) => void choose(id)} xp={user?.xp ?? 0} streak={user?.streak ?? 0} />
      </div>
    </AppShell>
  );
}
