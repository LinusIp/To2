// Colour helpers for flat fills with white text (WCAG AA). Used where a config colour (e.g. a subject's
// accent in src/config/subjects.ts) becomes a flat tile background: we darken it just enough for white text.

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)) as [number, number, number];
}
const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** contrast ratio of white text on `hex` */
export const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/** `hex` darkened (towards black, same hue) until white text on it reaches `min` (default 4.6, a hair over AA 4.5). */
export function aaFill(hex: string, min = 4.6): string {
  let [r, g, b] = rgb(hex);
  let out = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  for (let i = 0; i < 40 && contrastWithWhite(out) < min; i++) {
    r *= 0.95;
    g *= 0.95;
    b *= 0.95;
    out = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return out;
}
