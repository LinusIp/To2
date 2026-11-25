// Tab bar + bottom padding + tutor greeting screenshots (25 Nov P1), phone 375×812 and 360×740, mock mode, 0 credits.
//   node scripts/ui-p1-shots.mjs <tag> [baseUrl]  → docs/screenshots/ui-p1/<tag>-<page>-<w>[-end].png
// Also prints, per page, whether the last content sits under the tab bar (overlap px) and whether
// any tab label wraps or the active pill is clipped.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const TAG = process.argv[2] ?? "after";
const BASE = process.argv[3] ?? "http://localhost:5211";
const OUT = "docs/screenshots/ui-p1";
fs.mkdirSync(OUT, { recursive: true });
const PAGES = ["/home", "/towns", "/games", "/progress", "/settings", "/tutors", "/onboarding", "/qulaylik"];
const VIEWS = [
  { width: 375, height: 812 },
  { width: 360, height: 740 },
];

const browser = await chromium.launch();
for (const vp of VIEWS) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, baseURL: BASE, reducedMotion: "reduce", hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  const r = await page.request.post("/api/user", { data: { nickname: "Aziz", grade: 6, characterId: "blokbek" } });
  if (!r.ok()) throw new Error("user " + r.status());
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const name = `${OUT}/${TAG}-${path.slice(1)}-${vp.width}`;
    await page.screenshot({ path: `${name}.png` });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${name}-end.png` });
    const m = await page.evaluate(() => {
      const nav = [...document.querySelectorAll("nav")].find((n) => getComputedStyle(n).position === "fixed");
      const navTop = nav ? nav.getBoundingClientRect().top : innerHeight;
      // last visible, non-fixed content box
      let bottom = 0;
      for (const el of document.querySelectorAll("main *")) {
        const r = el.getBoundingClientRect();
        if (!r.height || getComputedStyle(el).position === "fixed" || el.closest("nav")) continue;
        bottom = Math.max(bottom, r.bottom);
      }
      const tabs = nav ? [...nav.querySelectorAll("a")] : [];
      const wraps = tabs.filter((a) => {
        const label = [...a.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        if (!label) return false;
        const range = document.createRange();
        range.selectNodeContents(label);
        return range.getClientRects().length > 1;
      }).map((a) => a.textContent.trim());
      const clipped = tabs.filter((a) => {
        const pill = a.querySelector("span");
        if (!pill) return false;
        const p = pill.getBoundingClientRect();
        return p.left < 0 || p.right > innerWidth || p.left < a.getBoundingClientRect().left - 0.5 || p.right > a.getBoundingClientRect().right + 0.5;
      }).map((a) => a.textContent.trim());
      return { tabs: tabs.length, overlap: Math.max(0, Math.round(bottom - navTop)), wraps, clipped };
    });
    console.log(vp.width, path, JSON.stringify(m));
    if (path === "/tutors" || path === "/onboarding") {
      // the greeting bubble (static greeting file or captions-only): tap "Ovozini eshit"
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole("button", { name: /Ovozini eshit/ }).click();
      await page.getByTestId("greeting-bubble").waitFor({ timeout: 5000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${name}-bubble.png` });
    }
  }
  await ctx.close();
}
await browser.close();
