import type { Color } from "@/lib/ai/schema";

export type BoardTheme = "chalk" | "white";

export const PALETTE: Record<BoardTheme, Record<Color, string> & { bg: string; grid: string }> = {
  chalk: {
    bg: "#1f2d27",
    grid: "rgba(245,243,234,0.06)",
    ink: "#f5f3ea",
    blue: "#7cc7ff",
    red: "#ff9bb0",
    green: "#8be28b",
    orange: "#ffaa5c",
    purple: "#cdb2ff",
    yellow: "#ffd85c",
  },
  white: {
    bg: "#fbfaf6",
    grid: "rgba(27,26,23,0.06)",
    ink: "#1b1a17",
    blue: "#1d6fd1",
    red: "#d6334f",
    green: "#2f8f3a",
    orange: "#d9670f",
    purple: "#7b4bc4",
    yellow: "#b88400",
  },
};
