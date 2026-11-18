// Phone test on 71da820 (EKUK lesson, Ziyo) → bugs 1, 2 and 4, each covered here on a 375×812 viewport.
// TTS is stubbed (no VoiceLab credits). Uses the demo fractions lesson (deterministic content).
import { expect, test, type Page, type Route } from "@playwright/test";
import { DEMO_LESSONS } from "../src/lib/ai/mock/lessons";

const SKILL = "frac-add-unlike";
const LESSON = DEMO_LESSONS[SKILL].segments;

function silentWav(ms: number) {
  const sr = 8000;
  const n = Math.round((sr * ms) / 1000);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return b;
}
const sse = (meta: object, segs: object[]) => [`event: meta\ndata: ${JSON.stringify(meta)}\n\n`, ...segs.map((s) => `event: segment\ndata: ${JSON.stringify(s)}\n\n`), "event: done\ndata: {}\n\n"].join("");

async function guest(page: Page) {
  const r = await page.request.post("/api/user", { data: { nickname: "E2E", grade: 6, characterId: "ziyo" } });
  expect(r.ok()).toBeTruthy();
}
async function startLesson(page: Page) {
  await page.goto(`/lesson/${SKILL}`);
  await page.getByRole("button", { name: "Darsni boshlash" }).click();
}
async function typeQuestion(page: Page, q: string) {
  await page.getByRole("button", { name: "Klaviatura" }).click();
  await page.getByLabel(/Savolingni yoz/).fill(q);
  await page.getByRole("button", { name: "Yuborish" }).click();
}
const bubble = (page: Page) => page.locator('[aria-live="polite"]').first();
const mainIds = (page: Page) => page.locator('g[data-layer="main"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));

test("bug 1: a line waits for its voice (fillers meanwhile) and the board writes only when the voice starts", async ({ page }) => {
  await guest(page);
  const line = encodeURIComponent(LESSON[1].say).slice(0, 30);
  const fillers: number[] = [];
  let audioAt = 0;
  await page.route("**/api/tts**", async (r) => {
    const u = r.request().url();
    if (/Hmm|Qani|Bir%20daqiqa/.test(u)) fillers.push(Date.now());
    if (u.includes(line)) {
      await new Promise((res) => setTimeout(res, 6000)); // a fresh line takes a while to generate
      audioAt = Date.now();
      return r.fulfill({ status: 200, headers: { "content-type": "audio/wav" }, body: silentWav(2500) });
    }
    return r.fulfill({ status: 204 });
  });
  await startLesson(page);
  await expect(bubble(page)).toContainText(LESSON[1].say.slice(0, 20), { timeout: 30_000 }); // caption shows at once
  const before = (await mainIds(page)).length;
  await expect.poll(() => audioAt, { timeout: 20_000 }).toBeGreaterThan(0);
  expect(fillers.length).toBeGreaterThan(0); // the tutor kept talking ("Hmm…") while waiting
  // nothing of segment 2 was written before its voice arrived…
  expect(Math.min(...fillers)).toBeLessThan(audioAt);
  // …and it is written once the voice plays
  await expect.poll(async () => (await mainIds(page)).length, { timeout: 15_000 }).toBeGreaterThan(before);
});

test("bug 2: 'Boshidan doskani o'chirib tushuntirib ber' restarts the lesson at step 1 — no LLM answer", async ({ page }) => {
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  await guest(page);
  const interrupts: string[] = [];
  await page.route("**/api/tutor", (route: Route) => {
    const req = JSON.parse(route.request().postData() ?? "{}");
    if (req.mode === "interrupt") interrupts.push(req.question);
    return route.continue();
  });
  await startLesson(page);
  await expect(page.getByRole("img", { name: /Qadam [3-9]\// })).toBeVisible({ timeout: 60_000 });
  await typeQuestion(page, "Boshidan doskani o'chirib tushuntirib ber");
  await expect(page.getByRole("img", { name: /Qadam 1\// })).toBeVisible({ timeout: 10_000 });
  await expect(bubble(page)).toContainText(LESSON[0].say.slice(0, 20), { timeout: 15_000 });
  expect(interrupts).toEqual([]); // never went to the answer (LLM) path
});

test("bug 2: a formula answer is written on the wiped main board; 'Davom et' brings the lesson back", async ({ page }) => {
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  await guest(page);
  await page.route("**/api/tutor", (route: Route) => {
    const req = JSON.parse(route.request().postData() ?? "{}");
    if (req.mode !== "interrupt") return route.continue();
    return route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: sse({ source: "llm", display: "main" }, [
        { id: "a1", type: "explain", layer: "main", emotion: "thinking", say: "Uchning karralilari.", board: [{ op: "write", id: "ans1", x: 40, y: 60, text: "3: 3, 6, 9, 12", size: "m" }] },
        { id: "a2", type: "explain", layer: "main", emotion: "happy", say: "To'rtning karralilari.", board: [{ op: "write", id: "ans2", x: 40, y: 140, text: "4: 4, 8, 12", size: "m" }] },
        { id: "chk", type: "check", layer: "note", emotion: "encouraging", say: "Tushunarli bo'ldimi? Davom etamizmi?", board: [] },
      ]),
    });
  });
  await startLesson(page);
  await expect(page.getByRole("img", { name: /Qadam [3-9]\// })).toBeVisible({ timeout: 60_000 });
  const lesson = await mainIds(page);
  expect(lesson.length).toBeGreaterThan(0);
  await typeQuestion(page, "Nega 12?");
  await expect(page.getByRole("button", { name: "Davom et" })).toBeVisible({ timeout: 60_000 });
  const during = await mainIds(page);
  expect(during).toEqual(expect.arrayContaining(["ans1", "ans2"]));
  for (const id of lesson) expect(during).not.toContain(id); // the lesson was wiped for the answer
  await page.getByRole("button", { name: "Davom et" }).click();
  await expect.poll(async () => (await mainIds(page)).filter((id) => lesson.includes(id ?? "")).length, { timeout: 10_000 }).toBe(lesson.length);
  // the answer wipes out (a 450 ms animation), then it's gone
  await expect.poll(async () => (await mainIds(page)).includes("ans1"), { timeout: 3000 }).toBe(false);
});

test("bug 4: every answer reports its source (browser console + /dev/answers)", async ({ page }) => {
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  await guest(page);
  const logs: string[] = [];
  page.on("console", (m) => {
    if (m.text().includes("[To2] answer")) logs.push(m.text());
  });
  await startLesson(page);
  await expect(page.getByRole("img", { name: /Qadam [2-9]\// })).toBeVisible({ timeout: 60_000 });
  await typeQuestion(page, "Nega maxrajlarni ko'paytirdik?");
  await expect(page.getByRole("button", { name: "Davom et" })).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => logs.join(" "), { timeout: 5000 }).toContain("pinned");
  const r = await page.request.get("/dev/answers");
  const j = (await r.json()) as { answers: { source: string; question: string; cache_key: string }[] };
  expect(j.answers[0]).toMatchObject({ source: "pinned", question: "nega maxrajlarni ko'paytirdik" });
  expect(j.answers[0].cache_key).toMatch(/^int:v4:matematika:frac-add-unlike:ziyo:0:\d+:[0-9a-f]{24}$/);
});
