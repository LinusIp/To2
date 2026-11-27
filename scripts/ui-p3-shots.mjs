// P3 screenshots (25 Nov report: picker, gradients, nickname, settings, decimal comma), mock mode, 0 credits.
//   node scripts/ui-p3-shots.mjs <tag> [baseUrl]  → docs/screenshots/ui-p3/<tag>-<page>-<w>.png (full page)
import { chromium } from "@playwright/test";
import fs from "node:fs";

const TAG = process.argv[2] ?? "after";
const BASE = process.argv[3] ?? "http://localhost:5211";
const OUT = "docs/screenshots/ui-p3";
fs.mkdirSync(OUT, { recursive: true });
const PAGES = ["/home", "/tutors", "/onboarding", "/settings", "/progress"];

const browser = await chromium.launch();
for (const vp of [{ width: 375, height: 812 }, { width: 360, height: 740 }]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, baseURL: BASE, reducedMotion: "reduce", isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  const r = await page.request.post("/api/user", { data: { nickname: "Aziz", grade: 6, characterId: "blokbek" } });
  if (!r.ok()) throw new Error("user " + r.status());
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${TAG}-${path.slice(1)}-${vp.width}.png`, fullPage: true });
    console.log("ok", path, vp.width);
  }
  await ctx.close();
}
await browser.close();
