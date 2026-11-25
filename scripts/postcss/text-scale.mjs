// PostCSS: real text scaling for the inclusive mode ("Yozuv o'lchami" 100 / 125 / 150 %).
// The UI uses fixed sizes (Tailwind `text-[16px]`, `--text-sm: .875rem`), so instead of zooming the
// whole page (which shrinks a 390 px phone to 260 px of layout), every font size is multiplied by
// `--ts` (1 / 1.25 / 1.5, set on <html data-text> in globals.css). Layout sizes are NOT scaled.
// Pure: tested in src/lib/a11y/textScale.test.ts.
const SIZE = /^\s*(-?\d*\.?\d+)(px|rem|em)\s*$/;

/** "16px" → "calc(16px * var(--ts, 1))"; anything else (inherit, %, var(), calc…) is left alone */
export function scaleFontSize(value) {
  const m = SIZE.exec(value);
  if (!m || m[2] === "em") return value; // em is relative to the (already scaled) parent
  return `calc(${m[1]}${m[2]} * var(--ts, 1))`;
}

/** font-size declarations, and Tailwind's --text-* size tokens (not their --line-height/--letter-spacing parts) */
export const isFontSizeProp = (prop) => prop === "font-size" || (/^--text-[\w-]+$/.test(prop) && !/--(line-height|letter-spacing|font-weight)$/.test(prop));

const plugin = () => ({
  postcssPlugin: "to2-text-scale",
  Declaration(decl) {
    if (decl.value.includes("--ts")) return;
    // px line heights grow with the text, or scaled lines would overlap (unitless ones scale by themselves)
    if (decl.prop === "line-height" && /^\s*\d*\.?\d+px\s*$/.test(decl.value)) {
      decl.value = `calc(${decl.value.trim()} * var(--ts, 1))`;
      return;
    }
    if (!isFontSizeProp(decl.prop)) return;
    const v = scaleFontSize(decl.value);
    if (v !== decl.value) decl.value = v;
  },
});
plugin.postcss = true;
export default plugin;
