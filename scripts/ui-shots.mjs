// Screenshots of the design-system screens for REPORT.md (phone 375×812 + desktop 1440×900), no credits.
//   node scripts/ui-shots.mjs <tag> [baseUrl]   → docs/screenshots/ui-<tag>-<screen>-<view>.png
import { chromium } from "@playwright/test";
import fs from "node:fs";

const TAG = process.argv[2] ?? "after";
const BASE = process.argv[3] ?? "http://localhost:5199";
const OUT = "docs/screenshots";
fs.mkdirSync(OUT, { recursive: true });
const SCREENS = [
  ["splash", "/"],
  ["onboarding", "/onboarding"],
  ["progress", "/progress"],
  ["settings", "/settings"],
  ["tutors", "/tutors"],
];
const VIEWS = { phone: { width: 375, height: 812 }, desktop: { width: 1440, height: 900 } };

const browser = await chromium.launch();
for (const [view, viewport] of Object.entries(VIEWS)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, baseURL: BASE, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  const r = await page.request.post("/api/user", { data: { nickname: "Aziz", grade: 6, characterId: "blokbek" } });
  if (!r.ok()) throw new Error("user " + r.status());
  for (const [name, path] of SCREENS) {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/ui-${TAG}-${name}-${view}.png` });
    console.log("ok", name, view);
  }
  await ctx.close();
}
await browser.close();
