"use client";
// Onboarding: pick a tutor → grade → (optional) nickname. Defaults are pre-filled: ONE tap to continue.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import { getCharacter, type CharacterId } from "@/config/characters";
import TutorPicker from "@/components/characters/TutorPicker";
import { useMe } from "@/lib/client/me";
import type { PublicUser } from "@/lib/server/repo";
import { ArrowIcon, BackIcon } from "@/components/ui/icons";

export default function Onboarding() {
  const router = useRouter();
  const { user, load, setUser } = useMe();
  const [nick, setNick] = useState("");
  const [grade, setGrade] = useState(6);
  const [ch, setCh] = useState<CharacterId>("blokbek");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void load().then((u) => {
      if (u) {
        setNick(u.nickname);
        setGrade(u.grade);
        setCh(getCharacter(u.characterId).id);
      }
    });
  }, [load]);

  const submit = async (skipDiagnostic: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: nick.trim() || "Mehmon", grade, characterId: ch }),
      });
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { user: PublicUser };
      setUser(j.user);
      if (skipDiagnostic) {
        await load(true);
        router.push("/home");
      } else router.push("/diagnostic");
    } catch {
      setErr(t.common.error);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col gap-5 bg-ph px-[18px] pt-4 pb-8">
      <div className="flex h-[52px] items-center justify-between">
        <Link href="/" aria-label={t.nav.back} className="icon-btn">
          <BackIcon />
        </Link>
        <h1 className="m-0 text-[22px] font-black">{t.onboarding.characterTitle}</h1>
        <div className="w-11" />
      </div>

      <TutorPicker value={ch} onChange={setCh} xp={user?.xp ?? 0} streak={user?.streak ?? 0} />

      <div>
        <div id="grade" className="mb-2 text-[16px] font-black">
          {t.onboarding.gradeTitle}
        </div>
        <div role="radiogroup" aria-labelledby="grade" className="grid grid-cols-5 gap-2">
          {[5, 6, 7, 8, 9].map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={grade === g}
              onClick={() => setGrade(g)}
              className={`h-[52px] rounded-2xl text-[20px] font-black ${grade === g ? "bg-blue text-white shadow-[0_8px_18px_rgba(47,107,255,.3)]" : "bg-white text-ink shadow-[0_4px_12px_rgba(31,54,120,.06)]"}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-[16px] font-black">{t.onboarding.nicknameTitle}</span>
        <input value={nick} onChange={(e) => setNick(e.target.value.slice(0, 24))} placeholder={t.onboarding.nicknamePlaceholder} className="field" autoComplete="off" />
        <span className="text-[13px] font-bold text-mut">{t.onboarding.nicknameHint}</span>
      </label>

      {err && (
        <div role="alert" className="rounded-[14px] bg-[#fff4e8] px-3.5 py-2.5 text-[14px] font-extrabold text-[#c2410c]">
          {err}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-2">
        <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void submit(false)}>
          {t.onboarding.finish} <ArrowIcon />
        </button>
        <button type="button" className="btn w-full" disabled={busy} onClick={() => void submit(true)}>
          {t.onboarding.skipDiagnostic}
        </button>
        <p className="m-0 text-center text-[12px] font-bold text-mut">
          {t.onboarding.consent}{" "}
          <Link href="/maxfiylik" className="text-blue underline">
            {t.onboarding.consentLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
