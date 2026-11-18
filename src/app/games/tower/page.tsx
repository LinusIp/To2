"use client";
import TowerGame from "@/components/games/TowerGame";

// settings={{ calm }} can be passed by the inclusive-mode panel (a11y-hook); default = auto-detect
export default function Page() {
  return <TowerGame />;
}
