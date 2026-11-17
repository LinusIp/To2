"use client";
// /lesson and /practice tabs → the learner's current roadmap node (or onboarding).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/client/me";
import { t } from "@/i18n/uz";

export default function CurrentRedirect({ base }: { base: string }) {
  const router = useRouter();
  const load = useMe((s) => s.load);
  useEffect(() => {
    void load(true).then((u) => {
      const rm = useMe.getState().roadmap;
      if (!u) router.replace("/onboarding");
      else router.replace(`${base}/${rm?.currentId ?? "frac-add-unlike"}`);
    });
  }, [base, load, router]);
  return <div className="p-8 font-pixel text-[18px]">{t.common.loading}</div>;
}
