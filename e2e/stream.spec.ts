// "Tutors stop answering mid-way" (REPORT.md): every cause has a test here, on a phone viewport.
// 1. the lesson stream closes without `done`  → "Ustoz gapini tugatmadi. Davom etamizmi?" + retry that
//    resumes from the last segment (the server gets `resume.prior` and sends only the rest)
// 2. a TTS request hangs AFTER an earlier clip played → the line goes captions-only, the lesson goes on
// 3. a live answer's stream is cut → the same prompt on the note track → retry completes the answer
// TTS is stubbed (no VoiceLab credits). Uses the demo fractions lesson (deterministic content).
import { expect, test, type Page, type Route } from "@playwright/test";
import { DEMO_LESSONS } from "../src/lib/ai/mock/lessons";

const SKILL = "frac-add-unlike";
const LESSON = DEMO_LESSONS[SKILL].segments;

/** 0.3 s of silence as a WAV: a real clip, so the shared <audio> element ends at currentTime 0.3 */
function silentWav(ms = 300) {
  const sr = 8000;
  const n = Math.round((sr * ms) / 1000);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  return b;
}

/** keep only the meta + the first `keep` segments of a real SSE body, and drop `done` */
function cut(body: string, keep: number) {
  const out: string[] = [];
  let segs = 0;
  for (const block of body.split("\n\n")) {
    if (!block.trim()) continue;
    if (block.startsWith("event: done")) continue;
    if (block.startsWith("event: segment")) {
      if (segs >= keep) continue;
      segs++;
    }
    out.push(block + "\n\n");
  }
  return out.join("");
}

async function guest(page: Page) {
  const r = await page.request.post("/api/user", { data: { nickname: "E2E", grade: 6, characterId: "blokbek" } });
  expect(r.ok()).toBeTruthy();
}

async function startLesson(page: Page) {
  await page.goto(`/lesson/${SKILL}`);
  await page.getByRole("button", { name: "Darsni boshlash" }).click();
}

const bubble = (page: Page) => page.locator('[aria-live="polite"]').first();

test("1. lesson stream closes without done → 'Davom etamizmi?' → retry resumes from the last segment", async ({ page }) => {
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  await guest(page);
  const bodies: unknown[] = [];
  let calls = 0;
  await page.route("**/api/tutor", async (route: Route) => {
    const req = JSON.parse(route.request().postData() ?? "{}");
    if (req.mode !== "lesson") return route.continue();
    bodies.push(req);
    calls++;
    const res = await route.fetch();
    const text = await res.text();
    // first call: the Worker "dies" after 3 segments (no done); the retry goes through untouched
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: calls === 1 ? cut(text, 3) : text });
  });
  await startLesson(page);
  // the 3 segments play (captions pace), then the prompt instead of a silent "lesson finished"
  await expect(page.getByTestId("stream-retry")).toBeVisible({ timeout: 60_000 });
  await expect(bubble(page)).toContainText("Davom etamizmi?");
  await expect(page.getByText("Dars tugadi")).toHaveCount(0);
  await page.getByTestId("stream-retry").click();
  // the retry sends what we already have and the lesson continues at segment 4
  await expect.poll(() => calls).toBe(2);
  const retry = bodies[1] as { resume?: { source: string; prior: { id: string }[] } };
  expect(retry.resume?.source).toBe("demo");
  expect(retry.resume?.prior.map((s) => s.id)).toEqual(LESSON.slice(0, 3).map((s) => s.id));
  await expect(bubble(page)).toContainText(LESSON[3].say.slice(0, 20), { timeout: 30_000 });
  await expect(page.getByTestId("stream-retry")).toHaveCount(0);
});

test("2. a TTS request that hangs after an earlier clip played → captions-only, the lesson moves on", async ({ page }) => {
  await guest(page);
  let tts = 0;
  await page.route("**/api/tts**", async (r) => {
    if (r.request().url().includes("wait=long")) return r.fulfill({ status: 204 }); // prefetches
    tts++;
    if (tts === 1) return r.fulfill({ status: 200, headers: { "content-type": "audio/wav" }, body: silentWav() });
    if (tts === 2) return; // never answered: a hung request on a bad mobile network
    return r.fulfill({ status: 204 });
  });
  await startLesson(page);
  await expect(bubble(page)).toContainText(LESSON[1].say.slice(0, 20), { timeout: 30_000 });
  // before the fix the tutor stayed on segment 2 forever; now ≤ 13 s + its caption time
  await expect(bubble(page)).toContainText(LESSON[2].say.slice(0, 20), { timeout: 40_000 });
});

test("3. a live answer cut mid-way → 'Davom etamizmi?' on the answer → retry completes it", async ({ page }) => {
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  await guest(page);
  let calls = 0;
  const bodies: { resume?: { source: string; prior: unknown[] } }[] = [];
  await page.route("**/api/tutor", async (route: Route) => {
    const req = JSON.parse(route.request().postData() ?? "{}");
    if (req.mode !== "interrupt") return route.continue();
    calls++;
    bodies.push(req);
    const res = await route.fetch();
    const text = await res.text();
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: calls === 1 ? cut(text, 1) : text });
  });
  await startLesson(page);
  await expect(bubble(page)).toContainText(LESSON[1].say.slice(0, 20), { timeout: 30_000 });
  await page.getByRole("button", { name: /Klaviatura|Yozib so'rash|keyboard/i }).first().click();
  await page.getByLabel(/Savolingizni yozing|savol/i).first().fill("Nega maxrajlarni ko'paytirdik?");
  await page.getByRole("button", { name: "Yuborish" }).click();
  await expect(page.getByTestId("stream-retry")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("stream-retry").click();
  await expect.poll(() => calls).toBe(2);
  expect(bodies[1].resume?.source).toBe("pinned");
  expect(bodies[1].resume?.prior).toHaveLength(1);
  // the answer completes and ends with the usual check: [Davom et] / [Yana tushuntir]
  await expect(page.getByRole("button", { name: "Yana tushuntir" })).toBeVisible({ timeout: 60_000 });
});
