"use client";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { t } from "@/i18n/uz";
import { useMe } from "@/lib/client/me";

/** Primary CTA: "Boshlash" for new visitors, "Davom etish" for returning ones. */
export default function LandingCta() {
  const { user, load } = useMe();
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="flex flex-col items-start gap-2">
      <Link href={user ? "/roadmap" : "/onboarding"} className="btn btn-primary h-16 px-7 text-[22px] no-underline">
        {user ? t.common.continue : t.landing.cta} <ArrowRight size={22} aria-hidden />
      </Link>
      <span className="text-[13px] font-bold text-muted">{user ? `${user.nickname} · ${t.common.grade(user.grade)}` : t.landing.ctaHint}</span>
    </div>
  );
}
