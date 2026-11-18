// Phone screenshots (375×812) of the English demo lesson on the real board + tutor, before it is wired
// into the app: /api/tutor (lesson mode) is stubbed with the course's demo lesson after the server's
// own auto-layout; TTS stubbed (0 credits). node scripts/english-shots.mjs [baseUrl]
import { chromium, devices } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const BASE = process.argv[2] ?? "http://localhost:5173";
const OUT = "docs/screenshots";
fs.mkdirSync(OUT, { recursive: true });
const tmp = path.join(os.tmpdir(), "to2-english-shots.mjs");
await build({
  stdin: { contents: `export { EN_TO_BE } from "@/config/courses/english/demoLesson"; export { layoutMainSegments } from "@/lib/board/layout";`, resolveDir: path.resolve("."), loader: "ts" },
  bundle: true, format: "esm", platform: "node", outfile: tmp, alias: { "@": path.resolve("src") }, logLevel: "silent",
});
const { EN_TO_BE, layoutMainSegments } = await import("file://" + tmp);
fs.rmSync(tmp, { force: true });
const title = { op: "write", id: "_title", x: 22, y: 10, size: "s", color: "ink", text: "Mavzu: To be: am / is / are" };
const segs = layoutMainSegments(EN_TO_BE.map((s, i) => (i === 0 ? { ...s, board: [title, ...s.board] } : s)));
const sse = [`event: meta\ndata: {"source":"demo"}\n\n`, ...segs.map((s) => `event: segment\ndata: ${JSON.stringify(s)}\n\n`), `event: done\ndata: {}\n\n`].join("");

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 375, height: 812 }, baseURL: BASE });
const page = await ctx.newPage();
await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
// pronunciation: pretend the Gemini key is set (enabled) and serve silence — 0 Gemini calls
await page.route("**/api/english/say**", (r) =>
  r.request().url().includes("check=1")
    ? r.fulfill({ status: 200, contentType: "application/json", body: '{"enabled":true}' })
    : r.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.from("UklGRiQAAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YQAAAAA=", "base64") }),
);
await page.route("**/api/tutor", (r) => {
  const req = JSON.parse(r.request().postData() ?? "{}");
  if (req.mode !== "lesson") return r.continue();
  return r.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse });
});
const u = await page.request.post("/api/user", { data: { nickname: "Shots", grade: 6, characterId: "blokbek" } });
if (!u.ok()) throw new Error("user " + u.status());
await page.goto("/lesson/en-to-be");
await page.getByRole("button", { name: "Darsni boshlash" }).click();
const pick = async (text) => {
  const r = page.getByRole("radio").filter({ has: page.getByText(text, { exact: true }) }).first();
  await r.waitFor({ timeout: 120_000 }).catch(async (e) => {
    await page.screenshot({ path: `${OUT}/english-debug.png` });
    console.log((await page.locator("body").innerText()).slice(0, 1500));
    throw e;
  });
  await page.waitForTimeout(600);
  return r;
};
// first question (She ___ a teacher.)
await page.getByText("Inglizcha talaffuz").waitFor({ timeout: 120_000 });
let r = await pick("is");
await page.screenshot({ path: `${OUT}/english-phone-1.png` });
await r.click();
await page.getByRole("button", { name: "Tekshir" }).click();
// second question (We ___ friends.)
r = await pick("are");
await page.screenshot({ path: `${OUT}/english-phone-2.png` });
await r.click();
await page.getByRole("button", { name: "Tekshir" }).click();
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/english-phone-3.png` });
// English practice (real /api/practice + /api/answer)
await page.goto("/practice/en-to-be");
await page.getByRole("radio").first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/english-practice.png` });
await browser.close();
console.log("ok");
