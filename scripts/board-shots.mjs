// Screenshots of the lesson board for REPORT.md (phone 375×812 + desktop 1280×800), no credits:
// TTS is stubbed (captions-only), the lesson is the demo fractions lesson.
//   node scripts/board-shots.mjs [baseUrl]   (default: local dev server http://localhost:5173)
// Writes docs/screenshots/board-<view>-<n>.png:
//   1 = main board mid-lesson (title line, grid, chalk, a highlight)
//   2 = pinned answer on the "Savolingiz" side board
//   3 = a live answer with 3 notes (one long → wraps to 2 rows; the board is full → wiped, top row)
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:5173";
const OUT = "docs/screenshots";
fs.mkdirSync(OUT, { recursive: true });

const sse = (segs) =>
  [`event: meta\ndata: {"source":"llm"}\n\n`, ...segs.map((s) => `event: segment\ndata: ${JSON.stringify(s)}\n\n`), `event: done\ndata: {}\n\n`].join("");
const LIVE = [
  {
    id: "n1", type: "explain", layer: "note", emotion: "thinking", say: "Hmm… yaxshi savol!",
    board: [{ op: "write", id: "a1", x: 0, y: 0, text: "EKUK (2; 3) = 6", size: "s" }, { op: "highlight", target: "lcm" }],
  },
  {
    id: "n2", type: "explain", layer: "note", emotion: "neutral", say: "Olti ikkiga ham, uchga ham bo'linadi.",
    board: [{ op: "write", id: "a2", x: 0, y: 0, text: "6 ikkiga ham, uchga ham bo'linadi va u eng kichigi", size: "s" }],
  },
  { id: "n3", type: "explain", layer: "note", emotion: "happy", say: "Shuning uchun olti!", board: [{ op: "write", id: "a3", x: 0, y: 0, text: "6 : 2 = 3    6 : 3 = 2", size: "s" }] },
  { id: "chk", type: "check", layer: "note", emotion: "encouraging", say: "Tushunarli bo'ldimi? Davom etamizmi?", board: [] },
];

async function shoot(view, ctxOpts) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...ctxOpts, baseURL: BASE });
  const page = await ctx.newPage();
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  const r = await page.request.post("/api/user", { data: { nickname: "Shots", grade: 6, characterId: "blokbek" } });
  if (!r.ok()) throw new Error("user " + r.status());
  await page.goto("/lesson/frac-add-unlike");
  await page.getByRole("button", { name: "Darsni boshlash" }).click();
  const stage = page.locator('[role="img"][aria-label^="Sinfxona"]').first();
  // wait for a few steps (the 3rd segment highlights the two fraction bars)
  await page.getByRole("img", { name: /Qadam [3-9]\// }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(2500);
  await stage.screenshot({ path: `${OUT}/board-${view}-1.png` });
  // the demo question → pinned answer on the side board
  await page.getByRole("button", { name: "Klaviatura" }).click();
  await page.getByLabel(/Savolingni yoz/).fill("Nega maxrajlarni ko'paytirdik?");
  await page.getByRole("button", { name: "Yuborish" }).click();
  await page.getByRole("button", { name: "Yana tushuntir" }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
  await stage.screenshot({ path: `${OUT}/board-${view}-2.png` });
  // "Yana tushuntir" with a crafted 3-note live answer (one long note)
  await page.route("**/api/tutor", (route) => {
    const req = JSON.parse(route.request().postData() ?? "{}");
    if (req.mode !== "interrupt") return route.continue();
    return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse(LIVE) });
  });
  await page.getByRole("button", { name: "Yana tushuntir" }).click();
  await page.getByRole("button", { name: "Yana tushuntir" }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
  await stage.screenshot({ path: `${OUT}/board-${view}-3.png` });
  await browser.close();
  console.log(view, "ok");
}

await shoot("phone", { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } });
await shoot("desktop", { viewport: { width: 1280, height: 800 } });
