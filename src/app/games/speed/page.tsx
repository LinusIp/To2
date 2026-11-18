"use client";
import SpeedGame from "@/components/games/SpeedGame";

// settings={{ calm }} can be passed by the inclusive-mode panel (a11y-hook); default = auto-detect
export default function Page() {
  return <SpeedGame />;
}
