// Lesson tutor look check (REPORT.md "M6 tutor lighting"): the 3 playable tutors in the lesson stage at
// 375×812, same pose (animation clock frozen after the model settles), optionally with a dev light preset.
//   node scripts/tutor-shots.mjs http://localhost:5199 <outDir> [preset]
// Dev server only (the preset switch and window.__tutor exist only outside production). 0 credits: TTS stubbed.
import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:5199";
const out = process.argv[3] ?? "shots";
const preset = process.argv[4] ?? "";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
for (const id of ["blokbek", "lola", "ziyo"]) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  const r = await page.request.post(`${base}/api/user`, { data: { nickname: "Shots", grade: 6, characterId: id } });
  if (!r.ok()) throw new Error(`/api/user ${r.status()}`);
  await page.goto(`${base}/lesson/frac-add-unlike${preset ? `?light=${preset}` : ""}`, { waitUntil: "networkidle" });
  // the real 3D model is in (faceSwap = a GLB rig, not the box fallback), then let the greeting settle
  await page.waitForFunction(() => !!window.__tutor?.ch?.faceSwap, null, { timeout: 60_000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => (window.__tutor.anim.speed = 0)); // same pose for every preset
  await page.waitForTimeout(400);
  const stage = page.locator("svg[role=img]").first().locator("xpath=..");
  const file = `${out}/${preset || "current"}-${id}.png`;
  await stage.screenshot({ path: file });
  console.log("saved", file);
  await ctx.close();
}
await browser.close();
