"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Old route → Progress tab. */
export default function ProfileRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/progress"), [router]);
  return null;
}
