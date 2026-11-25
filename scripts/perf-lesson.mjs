// Lesson smoothness benchmark (REPORT.md "Lesson smoothness"): the same lesson, the same phone view,
// the same CPU throttle, with and without the 3D tutor. Spends 0 VoiceLab credits (TTS stubbed, and the
// server should run in mock mode: a dev server with no .dev.vars).
//
//   node scripts/perf-lesson.mjs http://localhost:5199 [runs=3] [seconds=12]
//
// Headless Chromium uses software GL (SwiftShader), like the 25 Nov report. "No tutor" deletes WebGL
// before the page loads, so TutorCanvas takes its no-WebGL path (board + captions only).
// fps = requestAnimationFrame callbacks per second over a fixed window right after "Darsni boshlash"
// (the window covers the tutor talking, turning and writing the first lines).
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:5199";
const runs = Number(process.argv[3] === "shot" ? 0 : (process.argv[3] ?? 3));
const seconds = Number(process.argv[4] ?? 12);
const SKILL = "frac-add-unlike";

async function once(tutor) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  if (!tutor)
    await page.addInitScript(() => {
      // no WebGL → TutorCanvas renders nothing (its documented fallback)
      delete window.WebGLRenderingContext;
      delete window.WebGL2RenderingContext;
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...a) {
        return /webgl/i.test(String(type)) ? null : orig.call(this, type, ...a);
      };
    });
  await page.addInitScript(() => {
    window.__frames = [];
    window.__rec = false;
    const loop = (t) => {
      if (window.__rec) window.__frames.push(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const r = await page.request.post(`${base}/api/user`, { data: { nickname: "Perf", grade: 6, characterId: "blokbek" } });
  if (!r.ok()) throw new Error(`/api/user ${r.status()}`);
  await page.goto(`${base}/lesson/${SKILL}`, { waitUntil: "networkidle" });
  const start = page.getByRole("button", { name: "Darsni boshlash" });
  await start.waitFor({ timeout: 60_000 });
  // let the tutor model load and settle before throttling
  await page.waitForTimeout(3000);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await start.click();
  await page.evaluate(() => (window.__rec = true));
  await page.waitForTimeout(seconds * 1000);
  const frames = await page.evaluate(() => {
    window.__rec = false;
    return window.__frames;
  });
  const glOk = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
  await browser.close();
  const dts = frames.slice(1).map((t, i) => t - frames[i]);
  const s = [...dts].sort((a, b) => a - b);
  const q = (p) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN);
  const span = frames.length > 1 ? (frames[frames.length - 1] - frames[0]) / 1000 : seconds;
  return {
    fps: +(dts.length / span).toFixed(1),
    p50: +q(0.5).toFixed(1),
    p95: +q(0.95).toFixed(1),
    long: dts.filter((d) => d > 50).length,
    gl: glOk,
  };
}

/**
 * Look check: `node scripts/perf-lesson.mjs <base> shot <out.png>` — a seeded Math.random (so the
 * handwriting jitter is the same every run), no tutor (deterministic pixels), no throttle; waits until
 * the lesson's first question is on screen (all its writing done) and screenshots the stage.
 */
async function shot(out) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  await page.addInitScript(() => {
    let s = 12345;
    Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    delete window.WebGLRenderingContext;
    delete window.WebGL2RenderingContext;
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...a) {
      return /webgl/i.test(String(type)) ? null : orig.call(this, type, ...a);
    };
  });
  await page.request.post(`${base}/api/user`, { data: { nickname: "Perf", grade: 6, characterId: "blokbek" } });
  await page.goto(`${base}/lesson/${SKILL}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Darsni boshlash" }).click();
  // the first question: an answer field or choice buttons
  await page.locator('[aria-label="Javobing"], [role="radio"]').first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500); // highlight / fade transitions settle
  const stage = page.locator("svg[role=img]").first().locator("xpath=..");
  await stage.screenshot({ path: out, animations: "disabled" });
  await browser.close();
  console.log("saved", out);
}

if (process.argv[3] === "shot") {
  await shot(process.argv[4] ?? "board.png");
  process.exit(0);
}

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const tutor of [true, false]) {
  const rs = [];
  for (let i = 0; i < runs; i++) rs.push(await once(tutor));
  console.log(
    JSON.stringify({
      scenario: tutor ? "with tutor" : "no tutor",
      fps: med(rs.map((r) => r.fps)),
      frameMs_p50: med(rs.map((r) => r.p50)),
      frameMs_p95: med(rs.map((r) => r.p95)),
      longFrames: med(rs.map((r) => r.long)),
      runs: rs.map((r) => r.fps),
      webgl: rs[0].gl,
    }),
  );
}
