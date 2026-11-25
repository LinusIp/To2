// feat/inclusive-2 (docs/INCLUSIVE.md): real text scaling with no horizontal overflow at 360/375 px,
// voice answers in the games through "to2:voice", motor profile → untimed Tezkor hisob, profile cards.
// Screenshots → test-results/inclusive-2/ (SHOTS=1 → docs/screenshots/inclusive-2/, committed). TTS is stubbed: 0 VoiceLab credits.
import { expect, test, type Page } from "@playwright/test";

const SKILL = "frac-add-unlike";
// committed screenshots are refreshed only on request (SHOTS=1 pnpm e2e …); normal runs write to test-results/
const SHOTS = process.env.SHOTS === "1" ? "docs/screenshots/inclusive-2" : "test-results/inclusive-2";

async function guest(page: Page, a11y: Record<string, unknown>) {
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  const r = await page.request.post("/api/user", { data: { nickname: "A11y", grade: 6, characterId: "blokbek" } });
  expect(r.ok()).toBeTruthy();
  await page.addInitScript((s) => localStorage.setItem("to2-a11y", JSON.stringify({ asked: true, presets: [], ...s })), a11y);
}

/** widest thing on the page must fit the viewport (fixed overlays excluded) */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [...document.querySelectorAll("body *")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.width === 0 || getComputedStyle(e).position === "fixed") return false;
        // inside a horizontal scroller (carousels) is fine
        for (let p = e.parentElement; p; p = p.parentElement) if (["auto", "scroll"].includes(getComputedStyle(p).overflowX) || getComputedStyle(p).overflow === "hidden") return false;
        return r.right > vw + 1;
      })
      .slice(0, 5)
      .map((e) => `${e.tagName}.${String(e.className).slice(0, 50)}`);
    return { doc: document.documentElement.scrollWidth - vw, out };
  });
}

const PAGES: { name: string; go: (p: Page) => Promise<void> }[] = [
  { name: "home", go: async (p) => void (await p.goto("/home")) },
  { name: "qulaylik", go: async (p) => void (await p.goto("/qulaylik?next=/home")) },
  {
    name: "lesson",
    go: async (p) => {
      await p.goto(`/lesson/${SKILL}`);
      await p.getByRole("button", { name: /Darsni boshlash/ }).first().click();
      await p.waitForTimeout(3500);
    },
  },
  {
    name: "game",
    go: async (p) => {
      await p.goto(`/games/tower?skill=${SKILL}`);
      await expect(p.getByTestId("game-question")).not.toHaveText(/Yuklanmoqda|yuklan/i, { timeout: 20_000 });
    },
  },
];

for (const width of [360, 375]) {
  for (const ts of [1, 1.25, 1.5]) {
    test(`text ${ts * 100}% at ${width}px: bigger text, no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await guest(page, { textScale: ts });
      for (const pg of PAGES) {
        await pg.go(page);
        await page.waitForLoadState("networkidle").catch(() => {});
        const v = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ts").trim());
        expect(v, pg.name).toBe(String(ts));
        const o = await overflow(page);
        await page.screenshot({ path: `${SHOTS}/${pg.name}-${width}-${ts * 100}.png` });
        expect(o.out, `${pg.name} @${width}px ${ts * 100}%`).toEqual([]);
        expect(o.doc, `${pg.name} document width @${width}px ${ts * 100}%`).toBeLessThanOrEqual(1);
      }
    });
  }
}

test("text 150 %: the board writing is also shown large as typed text", async ({ page }) => {
  await guest(page, { textScale: 1.5 });
  await page.goto(`/lesson/${SKILL}`);
  await page.getByRole("button", { name: /Darsni boshlash/ }).first().click();
  const tb = page.getByTestId("typed-board");
  await expect(tb).toBeVisible({ timeout: 30_000 });
  const size = await tb.locator(".typed-board").evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(size).toBeGreaterThanOrEqual(33); // 22 px × 1.5
});

test("games: a spoken answer (to2:voice) picks the choice once; voice hint shown", async ({ page }) => {
  await guest(page, { voiceFirst: true });
  await page.goto(`/games/tower?skill=${SKILL}`);
  await expect(page.getByTestId("game-choice").first()).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByTestId("game-voice-hint")).toBeVisible();
  const reqs: string[] = [];
  page.on("request", (r) => r.url().includes("/api/games/answer") && reqs.push(r.url()));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("to2:voice", { detail: { command: "answer", n: 2 }, cancelable: true })));
  await expect(page.locator('[data-testid="game-choice"][data-state]').first()).toBeVisible();
  // the same command again while the answer is shown is ignored (no double submit)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("to2:voice", { detail: { command: "answer", n: 3 }, cancelable: true })));
  await page.waitForTimeout(500);
  expect(reqs.length).toBeLessThanOrEqual(1);
});

test("motor profile: Tezkor hisob plays untimed", async ({ page }) => {
  await guest(page, { handsFree: true, bigTargets: true, untimed: true, presets: ["motor"] });
  await page.goto(`/games/speed?skill=${SKILL}`);
  const box = page.getByTestId("speed-untimed");
  await expect(box).toBeChecked();
  await expect(box).toBeDisabled();
});

test("profile cards: switches, what was switched on, sample, device-only note", async ({ page }) => {
  await guest(page, {});
  await page.goto("/qulaylik?next=/home");
  const motor = page.getByTestId("preset-motor");
  await expect(motor).toHaveAttribute("role", "switch");
  await expect(motor).toHaveAttribute("aria-checked", "false");
  await motor.click();
  await expect(motor).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("preset-motor-enabled")).toContainText("ovozli buyruqlar");
  await expect(page.getByTestId("preset-motor-enabled")).toContainText("vaqt cheklovi yo'q");
  await expect(page.getByTestId("a11y-sample")).toBeVisible();
  await expect(page.getByTestId("a11y-device-only")).toContainText("faqat shu qurilmada");
  expect(await page.evaluate(() => document.documentElement.dataset.untimed)).toBe("1");
});
