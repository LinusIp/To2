"use client";
import MissionGame from "@/components/games/MissionGame";

// settings={{ calm }} can be passed by the inclusive-mode panel (a11y-hook); default = auto-detect
export default function Page() {
  return <MissionGame />;
}
