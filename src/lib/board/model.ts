// Pure board model: applies BoardCommands to a list of drawn elements and
// schedules commands over a segment's audio duration. No DOM here (unit-tested).
import type { BoardCommand, Color, DrawCommand } from "@/lib/ai/schema";

export type Layer = "main" | "note";

export interface BoardEl {
  /** unique render key (id + layer) */
  key: string;
  id: string;
  cmd: DrawCommand;
  layer: Layer;
  highlight?: Color;
}

export interface BoardState {
  els: BoardEl[];
  /** note layer is dimmed after the learner says "Davom et" */
  noteDim: boolean;
}

export const emptyBoard = (): BoardState => ({ els: [], noteDim: false });

export const BOARD_W = 1000;
export const BOARD_H = 625;
export const FONT_PX = { s: 28, m: 44, l: 60 } as const;

export function isDraw(cmd: BoardCommand): cmd is DrawCommand {
  return cmd.op !== "highlight" && cmd.op !== "erase" && cmd.op !== "pause";
}

/** Apply one command. Draw commands with an existing id (same layer) replace it. */
export function applyCommand(state: BoardState, cmd: BoardCommand, layer: Layer = "main"): BoardState {
  if (cmd.op === "pause") return state;
  if (cmd.op === "erase") {
    if (cmd.target === "all") return { ...state, els: [] };
    if (cmd.target === "note") return { ...state, els: state.els.filter((e) => e.layer !== "note") };
    return { ...state, els: state.els.filter((e) => e.id !== cmd.target) };
  }
  if (cmd.op === "highlight") {
    const c: Color = cmd.color ?? (layer === "note" ? "orange" : "yellow");
    // Prefer the newest element with that id.
    let hit = false;
    const els = [...state.els]
      .reverse()
      .map((e) => {
        if (!hit && e.id === cmd.target) {
          hit = true;
          return { ...e, highlight: c };
        }
        return e;
      })
      .reverse();
    return { ...state, els };
  }
  const withColor: DrawCommand =
    layer === "note" && cmd.op !== "numberline" && !(cmd as { color?: Color }).color
      ? ({ ...cmd, color: "orange" } as DrawCommand)
      : cmd;
  const key = `${layer}:${cmd.id}`;
  const els = state.els.filter((e) => e.key !== key);
  els.push({ key, id: cmd.id, cmd: withColor, layer });
  return { ...state, els };
}

export function applyAll(state: BoardState, cmds: BoardCommand[], layer: Layer = "main"): BoardState {
  return cmds.reduce((s, c) => applyCommand(s, c, layer), state);
}

export function clearNotes(state: BoardState): BoardState {
  return { ...state, els: state.els.filter((e) => e.layer !== "note"), noteDim: false };
}

/** Relative "drawing effort" of a command (CLAUDE.md §3: text ≈ length, shapes ≈ 1). */
export function commandWeight(cmd: BoardCommand): number {
  switch (cmd.op) {
    case "write":
      return Math.max(1, cmd.text.length / 6);
    case "latex":
      return Math.max(1, cmd.tex.replace(/\\[a-z]+|[{}]/gi, "").length / 5);
    case "line":
      return 0.8;
    case "rect":
    case "circle":
    case "ellipse":
      return 1;
    case "numberline":
      return 2.5;
    case "fractionbar":
      return 2;
    case "plot":
      return 3;
    case "highlight":
      return 0.6;
    case "erase":
      return 0.3;
    case "pause":
      return 0; // handled as fixed ms
  }
}

export interface Slot {
  index: number;
  start: number; // ms from segment start
  end: number;
}

/**
 * Spread commands over the audio duration, proportional to weight.
 * Drawing uses ~90% of the audio so the chalk finishes as the sentence ends.
 * `pause` commands take their own ms. Minimum 250ms per drawn command.
 */
export function scheduleSegment(cmds: BoardCommand[], durationMs: number): Slot[] {
  const pauseMs = cmds.reduce((a, c) => a + (c.op === "pause" ? c.ms : 0), 0);
  const weights = cmds.map(commandWeight);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const drawBudget = Math.max(0, durationMs * 0.9 - pauseMs);
  const unit = totalW > 0 ? drawBudget / totalW : 0;
  const slots: Slot[] = [];
  let t = 0;
  cmds.forEach((c, i) => {
    const len = c.op === "pause" ? c.ms : Math.max(250, weights[i] * unit);
    slots.push({ index: i, start: t, end: t + len });
    t += len;
  });
  return slots;
}

/** Total length of a schedule (may exceed the audio if there are many commands). */
export function scheduleLength(slots: Slot[]): number {
  return slots.length ? slots[slots.length - 1].end : 0;
}

/** Approximate bounding box of a drawn element (for highlight + LLM context). */
export function bbox(cmd: DrawCommand): { x: number; y: number; w: number; h: number } {
  switch (cmd.op) {
    case "write": {
      const fs = FONT_PX[cmd.size ?? "m"];
      return { x: cmd.x, y: cmd.y, w: Math.max(fs, cmd.text.length * fs * 0.5), h: fs * 1.15 };
    }
    case "latex": {
      const fs = FONT_PX[cmd.size ?? "m"];
      const hasFrac = cmd.tex.includes("\\frac");
      const len = cmd.tex.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, (_, a: string, b: string) => (a.length > b.length ? a : b)).replace(/\\[a-z]+|[{}\s]/gi, "").length;
      return { x: cmd.x, y: cmd.y, w: Math.max(fs, len * fs * 0.55), h: hasFrac ? fs * 2.4 : fs * 1.15 };
    }
    case "line":
      return {
        x: Math.min(cmd.from[0], cmd.to[0]),
        y: Math.min(cmd.from[1], cmd.to[1]),
        w: Math.abs(cmd.to[0] - cmd.from[0]),
        h: Math.abs(cmd.to[1] - cmd.from[1]),
      };
    case "rect":
    case "circle":
    case "ellipse":
    case "plot":
      return { x: cmd.x, y: cmd.y, w: cmd.w, h: cmd.h };
    case "numberline":
      return { x: cmd.x, y: cmd.y - 20, w: cmd.w, h: 70 };
    case "fractionbar":
      return { x: cmd.x, y: cmd.y, w: cmd.w, h: cmd.h ?? 54 };
  }
}

/** Compact board description sent to the LLM on interrupt: ids + their text. */
export function describeBoard(state: BoardState): { id: string; op: string; text?: string; x: number; y: number }[] {
  return state.els.map((e) => {
    const b = bbox(e.cmd);
    const text =
      e.cmd.op === "write" ? e.cmd.text : e.cmd.op === "latex" ? e.cmd.tex : e.cmd.op === "fractionbar" ? `${e.cmd.filled}/${e.cmd.parts}` : undefined;
    return { id: e.id, op: e.cmd.op, text, x: Math.round(b.x), y: Math.round(b.y) };
  });
}

/** Find free space on the right/bottom for the note layer. */
export function freeArea(state: BoardState): { x: number; y: number } {
  const main = state.els.filter((e) => e.layer === "main").map((e) => bbox(e.cmd));
  const maxX = main.reduce((m, b) => Math.max(m, b.x + b.w), 0);
  if (maxX < 640) return { x: Math.max(maxX + 40, 600), y: 60 };
  const maxY = main.reduce((m, b) => Math.max(m, b.y + b.h), 0);
  return { x: 40, y: Math.min(Math.max(maxY + 30, 420), 540) };
}
