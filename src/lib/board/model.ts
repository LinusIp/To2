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
  let draw: DrawCommand = cmd;
  // resolve target ids for arrows / strikes into board coordinates
  const center = (t: string): [number, number] | null => {
    const e = [...state.els].reverse().find((x) => x.id === t);
    if (!e) return null;
    const b = bbox(e.cmd);
    return [b.x + b.w / 2, b.y + b.h / 2];
  };
  if (cmd.op === "arrow") {
    const from = typeof cmd.from === "string" ? center(cmd.from) : cmd.from;
    const to = typeof cmd.to === "string" ? center(cmd.to) : cmd.to;
    if (!from || !to) return state;
    draw = { ...cmd, from, to };
  }
  if (cmd.op === "strike") {
    const e = [...state.els].reverse().find((x) => x.id === cmd.target);
    if (!e) return state;
    const b = bbox(e.cmd);
    draw = { ...cmd, from: [b.x - 8, b.y + b.h * 0.62], to: [b.x + b.w + 8, b.y + b.h * 0.38] };
  }
  const withColor: DrawCommand =
    layer === "note" && draw.op !== "numberline" && draw.op !== "divider" && !(draw as { color?: Color }).color
      ? ({ ...draw, color: "orange" } as DrawCommand)
      : draw;
  const key = `${layer}:${cmd.id}`;
  const els = state.els.filter((e) => e.key !== key);
  els.push({ key, id: cmd.id, cmd: withColor, layer });
  void 0;
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
    case "arrow":
      return 1;
    case "tick":
      return 0.6;
    case "divider":
    case "strike":
      return 0.8;
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
/** Speak first, start writing ~300 ms later (CLAUDE.md §5b rule 6). */
export const LEAD_MS = 300;

export function scheduleSegment(cmds: BoardCommand[], durationMs: number): Slot[] {
  const pauseMs = cmds.reduce((a, c) => a + (c.op === "pause" ? c.ms : 0), 0);
  const weights = cmds.map(commandWeight);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const drawBudget = Math.max(0, durationMs * 0.9 - pauseMs - LEAD_MS);
  const unit = totalW > 0 ? drawBudget / totalW : 0;
  const slots: Slot[] = [];
  let t = cmds.length ? LEAD_MS : 0;
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
      return { x: cmd.x, y: cmd.y - (cmd.label ? 40 : 0), w: cmd.w, h: (cmd.h ?? 54) + (cmd.label ? 40 : 0) };
    case "arrow": {
      const f = typeof cmd.from === "string" ? [0, 0] : cmd.from;
      const t = typeof cmd.to === "string" ? [0, 0] : cmd.to;
      return { x: Math.min(f[0], t[0]), y: Math.min(f[1], t[1]), w: Math.abs(t[0] - f[0]), h: Math.abs(t[1] - f[1]) };
    }
    case "tick":
      return { x: cmd.x, y: cmd.y - 26, w: 44, h: 44 };
    case "divider":
      return { x: cmd.x, y: 40, w: 2, h: 550 };
    case "strike": {
      const f = cmd.from ?? [0, 0];
      const t = cmd.to ?? [0, 0];
      return { x: Math.min(f[0], t[0]), y: Math.min(f[1], t[1]), w: Math.abs(t[0] - f[0]), h: Math.abs(t[1] - f[1]) };
    }
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

/** The orange "note" panel (bottom-right) where interruption answers are written. */
export const NOTE_PANEL = { x: 548, y: 506, w: 444, h: 112 } as const;
const NOTE_ROW_H = 44;
const NOTE_MAX_ROWS = 2;

/**
 * Re-lay out note-layer drawings so they never cover the main lesson:
 * text/latex go to rows inside NOTE_PANEL; other shapes are dropped;
 * highlight/erase/pause are kept (highlight points at existing main elements).
 */
export function noteLayouter() {
  let row = 0;
  return <T extends { board: BoardCommand[] }>(s: T): T => ({
    ...s,
    board: s.board.flatMap((c): BoardCommand[] => {
      if (c.op === "highlight" || c.op === "erase" || c.op === "pause") return [c];
      if (c.op !== "write" && c.op !== "latex") return [];
      const r = Math.min(row++, NOTE_MAX_ROWS - 1);
      const y = NOTE_PANEL.y + 10 + r * NOTE_ROW_H;
      if (c.op === "write") return [{ ...c, x: NOTE_PANEL.x + 16, y, size: "s", text: c.text.length > 30 ? c.text.slice(0, 29) + "…" : c.text }];
      // fractions are tall; keep latex only if it fits a row, else turn it into plain text
      if (c.tex.includes("\\frac")) {
        const text = c.tex
          .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
          .replace(/\\cdot/g, "·")
          .replace(/[\\{}]/g, "")
          .slice(0, 30);
        return [{ op: "write", id: c.id, x: NOTE_PANEL.x + 16, y, size: "s", color: c.color, text }];
      }
      return [{ ...c, x: NOTE_PANEL.x + 16, y, size: "s" }];
    }),
  });
}

export function layoutNoteSegments<T extends { board: BoardCommand[] }>(segs: T[]): T[] {
  const lay = noteLayouter();
  return segs.map((s) => lay(s));
}

const SIZES: ("l" | "m" | "s")[] = ["l", "m", "s"];

/** Keep LLM drawings on the canvas: shrink/shift text that would overflow, clamp shapes. */
export function fitToBoard(cmd: BoardCommand): BoardCommand {
  const M = 16;
  if (cmd.op === "write" || cmd.op === "latex") {
    let c = { ...cmd };
    let b = bbox(c);
    let i = SIZES.indexOf(c.size ?? "m");
    while (b.w > BOARD_W - 2 * M && i < SIZES.length - 1) {
      c = { ...c, size: SIZES[++i] };
      b = bbox(c);
    }
    const x = Math.min(Math.max(M, c.x), Math.max(M, BOARD_W - M - b.w));
    const y = Math.min(Math.max(M, c.y), Math.max(M, BOARD_H - M - b.h));
    return { ...c, x, y };
  }
  if (cmd.op === "rect" || cmd.op === "circle" || cmd.op === "ellipse" || cmd.op === "plot") {
    const w = Math.min(cmd.w, BOARD_W - 2 * M);
    const h = Math.min(cmd.h, BOARD_H - 2 * M);
    return { ...cmd, w, h, x: Math.min(Math.max(M, cmd.x), BOARD_W - M - w), y: Math.min(Math.max(M, cmd.y), BOARD_H - M - h) };
  }
  if (cmd.op === "fractionbar" || cmd.op === "numberline") {
    const w = Math.min(cmd.w, BOARD_W - 2 * M);
    return { ...cmd, w, x: Math.min(Math.max(M, cmd.x), BOARD_W - M - w), y: Math.min(Math.max(40, cmd.y), BOARD_H - 80) };
  }
  if (cmd.op === "line") {
    const cx = (v: number) => Math.min(Math.max(M, v), BOARD_W - M);
    const cy = (v: number) => Math.min(Math.max(M, v), BOARD_H - M);
    return { ...cmd, from: [cx(cmd.from[0]), cy(cmd.from[1])], to: [cx(cmd.to[0]), cy(cmd.to[1])] };
  }
  return cmd;
}
