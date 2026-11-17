// Writes www/config.js from ../production.json (the one place the production URL lives),
// so the offline page's "Qayta urinish" knows where to go. Run before `cap sync`.
import { readFileSync, writeFileSync } from "node:fs";
const { url } = JSON.parse(readFileSync(new URL("../../production.json", import.meta.url), "utf8"));
writeFileSync(new URL("../www/config.js", import.meta.url), `window.TO2_URL = ${JSON.stringify(url)};\n`);
console.log("www/config.js →", url);
