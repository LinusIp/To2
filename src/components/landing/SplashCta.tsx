"use client";
import Link from "next/link";
import { useEffect } from "react";
import { t } from "@/i18n/uz";
import { useMe } from "@/lib/client/me";
import { ArrowIcon } from "@/components/ui/icons";

/** Splash buttons: "Boshlash" (new) / "Davom etish" (returning) + "Kirish". */
export default function SplashCta() {
  const { user, load } = useMe();
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="flex w-full flex-col gap-3">
      <Link href={user ? "/home" : "/onboarding"} className="btn btn-white w-full text-[18px]">
        {user ? t.splash.cont : t.splash.start} <ArrowIcon size={22} />
      </Link>
      <Link href={user ? "/home" : "/onboarding"} className="mx-auto px-4 py-2 text-[17px] font-extrabold text-white no-underline">
        {user ? `${user.nickname} · ${t.common.grade(user.grade)}` : t.splash.login}
      </Link>
    </div>
  );
}
