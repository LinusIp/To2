// Accessibility check (axe-core, WCAG 2.1 A/AA rules) on the 5 main screens, phone viewport, with
// the inclusive mode OFF and ON. Gate: 0 serious / critical violations. TTS is stubbed (0 credits).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const SKILL = "frac-add-unlike";

async function guest(page: Page) {
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  const r = await page.request.post("/api/user", { data: { nickname: "A11y", grade: 6, characterId: "blokbek" } });
  expect(r.ok()).toBeTruthy();
}

async function check(page: Page, name: string) {
  // the 3D canvas / handwriting are decorative and labelled as a whole; skip nothing else
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(name, JSON.stringify(bad.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(" ")) })), null, 1));
  const minor = res.violations.filter((v) => !bad.includes(v)).map((v) => `${v.id}(${v.impact})`);
  if (minor.length) console.log(name, "minor:", minor.join(", "));
  expect(bad, `${name}: serious/critical axe violations`).toEqual([]);
}

const SCREENS: { name: string; go: (p: Page) => Promise<void> }[] = [
  { name: "splash", go: async (p) => void (await p.goto("/")) },
  { name: "qulaylik", go: async (p) => void (await p.goto("/qulaylik?next=/home")) },
  { name: "home", go: async (p) => void (await p.goto("/home")) },
  { name: "settings", go: async (p) => void (await p.goto("/settings")) },
  {
    name: "lesson",
    go: async (p) => {
      await p.goto(`/lesson/${SKILL}`);
      await p.getByRole("button", { name: /Darsni boshlash|Davom|Qayta/ }).first().click();
      await p.waitForTimeout(2500);
    },
  },
  {
    name: "quiz",
    go: async (p) => {
      await p.goto(`/practice/${SKILL}`);
      await expect(p.getByTestId("quiz-question")).not.toHaveText(/Yuklanmoqda|…$/);
    },
  },
];

for (const mode of ["off", "on"] as const) {
  test.describe(`axe — inclusive mode ${mode}`, () => {
    for (const s of SCREENS) {
      test(s.name, async ({ page }) => {
        await guest(page);
        if (mode === "on") {
          await page.addInitScript(() =>
            localStorage.setItem(
              "to2-a11y",
              JSON.stringify({ voiceFirst: true, highContrast: true, textScale: 1.5, bigCaptions: true, vibrate: true, handsFree: true, bigTargets: true, calm: true, dyslexiaFont: true, speechRate: 1, presets: ["vision", "hearing", "motor", "focus"], asked: true }),
            ),
          );
        }
        await s.go(page);
        await page.waitForLoadState("networkidle").catch(() => {});
        await check(page, `${s.name}/${mode}`);
      });
    }
  });
}

test("presets switch the app modes on (<html data-*>)", async ({ page }) => {
  await guest(page);
  await page.goto("/qulaylik?next=/home");
  await page.getByTestId("preset-vision").click();
  await page.getByTestId("preset-focus").click();
  const d = await page.evaluate(() => ({ ...document.documentElement.dataset }));
  expect(d).toMatchObject({ contrast: "1", text: "150", big: "1", calm: "1", dyslexia: "1" });
  await page.getByTestId("a11y-continue").click();
  await expect(page).toHaveURL(/\/home/);
});

test("hearing mode: live captions + indicator in the lesson", async ({ page }) => {
  await guest(page);
  await page.addInitScript(() => localStorage.setItem("to2-a11y", JSON.stringify({ bigCaptions: true, vibrate: true, presets: ["hearing"], asked: true })));
  await page.goto(`/lesson/${SKILL}`);
  await page.getByRole("button", { name: /Darsni boshlash/ }).click();
  await expect(page.getByTestId("a11y-indicator")).toBeVisible();
  await expect(page.getByTestId("a11y-caption")).not.toBeEmpty();
});
