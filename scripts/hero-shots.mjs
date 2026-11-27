// TutorHero + lesson-start look check (REPORT.md "C4 TutorHero"). Dev server only (uses /dev/hero and the
// dev-only window.__tutor). 0 credits: the hero's "talk" is muted (caption-driven mouth), lesson TTS stubbed.
//   node scripts/hero-shots.mjs http://localhost:5199 docs/screenshots/tutor-hero
import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:5199";
const out = process.argv[3] ?? "docs/screenshots/tutor-hero";
fs.mkdirSync(out, { recursive: true });
const IDS = ["blokbek", "lola", "ziyo"];
const checks = [];
const browser = await chromium.launch({ headless: true });

const state = (page) =>
  page.evaluate(() => {
    const T = window.__tutor;
    const fs = T?.ch?.faceSwap;
    const mouth = fs ? (fs.rest.visible ? "rest" : String(fs.mouths.findIndex((m) => m.visible))) : "?";
    return { anim: T?.anim?.state, mouth, ready: document.querySelector('[data-testid="tutor-hero"]')?.getAttribute("data-ready") };
  });

for (const w of [360, 375]) {
  // ---- hero demo ----
  const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${base}/dev/hero`, { waitUntil: "networkidle" });
  for (const id of IDS) {
    await page.getByTestId(`pick-${id}`).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="tutor-hero"]')?.getAttribute("data-ready") === "1", null, { timeout: 60_000 });
    await page.waitForTimeout(2600); // the select-wave is over → idle
    const hero = page.getByTestId("tutor-hero");
    const idle = await state(page);
    await hero.screenshot({ path: `${out}/hero-${w}-${id}-idle.png` });
    await page.getByTestId("hero-wave").click();
    await page.waitForTimeout(700);
    const wave = await state(page);
    await hero.screenshot({ path: `${out}/hero-${w}-${id}-wave.png` });
    await page.waitForTimeout(1800);
    await page.getByTestId("hero-talk").click();
    // catch an open mouth frame (the caption envelope opens and closes)
    let talk = await state(page);
    for (let i = 0; i < 30 && (talk.mouth === "rest" || talk.mouth === "0"); i++) {
      await page.waitForTimeout(60);
      talk = await state(page);
    }
    await hero.screenshot({ path: `${out}/hero-${w}-${id}-talk.png` });
    checks.push({ w, id, ready: idle.ready, idle: idle.anim, wave: wave.anim, talkState: talk.anim, talkMouth: talk.mouth });
    await page.waitForTimeout(3500); // greeting over
  }
  // calm mode: a wave request must not wave
  await page.getByTestId("hero-calm").click();
  await page.getByTestId("hero-wave").click();
  await page.waitForTimeout(700);
  checks.push({ w, calm: "on", afterWave: (await state(page)).anim });
  await page.getByTestId("hero-calm").click();
  await ctx.close();

  // ---- lesson start (the back button must not sit on the tutor's head) ----
  for (const id of IDS) {
    const c2 = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p2 = await c2.newPage();
    await p2.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
    await p2.request.post(`${base}/api/user`, { data: { nickname: "Shots", grade: 6, characterId: id } });
    await p2.goto(`${base}/lesson/frac-add-unlike`, { waitUntil: "networkidle" });
    await p2.waitForFunction(() => !!window.__tutor?.ch?.faceSwap, null, { timeout: 60_000 });
    await p2.waitForTimeout(3500);
    await p2.screenshot({ path: `${out}/lesson-start-${w}-${id}.png`, clip: { x: 0, y: 0, width: w, height: Math.round((w * 830) / 1320) } });
    await c2.close();
  }
}
await browser.close();
for (const c of checks) console.log(JSON.stringify(c));
