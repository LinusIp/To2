import tailwindcss from "@tailwindcss/postcss";
import textScale from "./scripts/postcss/text-scale.mjs";

const config = {
  // text-scale runs after Tailwind: every generated font size becomes calc(size * var(--ts)) (inclusive mode)
  plugins: [tailwindcss(), textScale()],
};

export default config;
