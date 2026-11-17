// Icon + splash sources for @capacitor/assets, from the To2 wordmark + Blokbek's face render
// (public/characters/blokbek_idle_face.png). Output: mobile/assets/{icon-only,icon-foreground,icon-background,splash,splash-dark}.png
import sharp from "sharp";
import { fileURLToPath } from "node:url";
const BLUE = "#2563eb";
const face = fileURLToPath(new URL("../../public/characters/blokbek_idle_face.png", import.meta.url));
const out = (f) => fileURLToPath(new URL(`../assets/${f}`, import.meta.url));
const word = (size, color = "#fff") =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size * 3}" height="${size * 1.3}"><text x="50%" y="78%" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${size}" fill="${color}">To<tspan fill="#fbbf24">2</tspan></text></svg>`);

async function faceAt(px) {
  return sharp(face).resize(px, px, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}
// icon-only: full square icon (legacy launchers)
const f1 = await faceAt(700);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BLUE } })
  .composite([{ input: f1, top: 90, left: 162 }, { input: await sharp(word(210)).png().toBuffer(), top: 760, left: 512 - 315 }])
  .png().toFile(out("icon-only.png"));
// adaptive icon: foreground inside the 66 % safe zone, plain blue background
const f2 = await faceAt(560);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: f2, top: 190, left: 232 }, { input: await sharp(word(150)).png().toBuffer(), top: 690, left: 512 - 225 }])
  .png().toFile(out("icon-foreground.png"));
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BLUE } }).png().toFile(out("icon-background.png"));
// splash: logo + face on blue
const f3 = await faceAt(1000);
for (const name of ["splash.png", "splash-dark.png"])
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BLUE } })
    .composite([{ input: await sharp(word(380)).png().toBuffer(), top: 700, left: 1366 - 570 }, { input: f3, top: 1250, left: 866 }])
    .png().toFile(out(name));
console.log("assets written");
