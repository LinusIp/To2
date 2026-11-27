// Lesson ↔ quiz flow on a phone (375×812): the learner can never get stuck.
// TTS is stubbed (204 = captions only), so lessons run at caption pace and cost no credits;
// quiz answers are read from the intercepted /api/practice responses.
import { expect, test, type Page } from "@playwright/test";

const SKILL = "frac-add-unlike";
type Ans = { kind: string; answer: string; choices?: string[]; q: string; key: string };

/** a fresh guest (grade 6, Blokbek) with captions-only audio; returns the queue of quiz answers */
async function setup(page: Page) {
  await page.route("**/api/tts**", (r) => r.fulfill({ status: 204 }));
  const answers: Ans[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("/api/practice") && res.ok()) {
      const j = (await res.json()) as { problem: { q: string; key: string; expect: { kind: string; answer: string; choices?: string[] } } };
      answers.push({ ...j.problem.expect, q: j.problem.q, key: j.problem.key });
    }
  });
  const r = await page.request.post("/api/user", { data: { nickname: "E2E", grade: 6, characterId: "blokbek" } });
  expect(r.ok()).toBeTruthy();
  return answers;
}

/** answer the current quiz question right (true) or wrong (false) */
async function answer(page: Page, answers: Ans[], right: boolean) {
  await expect.poll(() => answers.length).toBeGreaterThan(0);
  // wait until the question on screen is the one we have the answer for (by its unique key: the
  // generator can repeat the same text twice in a row)
  const e = answers[answers.length - 1];
  if (process.env.E2E_DEBUG) console.log("answer", right, e.key, e.q, "→", e.answer, "| queue", answers.length);
  await expect(page.getByTestId("quiz-question")).toHaveAttribute("data-key", e.key);
  if (e.kind === "choice" && e.choices?.length) {
    const pick = right ? e.answer : (e.choices.find((c) => c !== e.answer) ?? "0");
    // options are radios named "A 6", "B 7"…: pick the one whose text is exactly the answer
    // decimals are shown with the Uzbek comma ("0,5"); the API answer keeps the dot
    const shown = pick.replace(/(\d)\.(?=\d)/g, "$1,");
    await page.getByRole("radio").filter({ has: page.getByText(shown, { exact: true }) }).first().click();
    await page.getByRole("button", { name: "Tekshir" }).click();
  } else {
    await page.getByLabel("Javobing").fill(right ? e.answer : "99999");
    await page.getByLabel("Javobing").press("Enter");
  }
}

async function passQuiz(page: Page, answers: Ans[]) {
  for (let i = 0; i < 5; i++) {
    // count only once this question has loaded (on a fresh page the first one may still be on its way)
    await expect.poll(() => answers.length).toBeGreaterThan(0);
    const n = answers.length;
    await answer(page, answers, true);
    if (i < 4) await expect.poll(() => answers.length).toBeGreaterThan(n);
  }
}

test("pass path: quiz → success → 'Keyingi dars' opens the next lesson (or the roadmap)", async ({ page }) => {
  const answers = await setup(page);
  await page.goto(`/practice/${SKILL}`);
  await passQuiz(page, answers);
  await expect(page.getByText("A'lo!")).toBeVisible();
  const next = page.getByRole("button", { name: /Keyingi dars|Xaritaga qaytish/ }).first();
  await next.click();
  await expect(page).toHaveURL(/\/(lesson\/(?!frac-add-unlike)[\w-]+|roadmap)/);
  await expect(page.locator("body")).not.toBeEmpty();
});

test("fail path: 2 misses → 'Darsni qayta ko'rish' → lesson explanation → back to the quiz → pass", async ({ page }) => {
  const answers = await setup(page);
  // came from the lesson: lesson page first, then the quiz (history: lesson → quiz)
  await page.goto(`/lesson/${SKILL}`);
  await expect(page.getByRole("button", { name: /Darsni boshlash|Davom etish/ }).first()).toBeVisible();
  await page.goto(`/practice/${SKILL}?from=lesson`);
  await answer(page, answers, false);
  await answer(page, answers, false);
  await expect(page.getByRole("button", { name: "Darsni qayta ko'rish" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yana urinish" })).toBeVisible();
  await page.getByRole("button", { name: "Darsni qayta ko'rish" }).click();
  // back on the lesson, offered at the explanation step
  await expect(page).toHaveURL(new RegExp(`/lesson/${SKILL}`));
  await expect(page.getByRole("button", { name: "Tushuntirishni qayta ko'rish" })).toBeVisible();
  // retry the quiz and pass
  answers.length = 0;
  await page.goto(`/practice/${SKILL}?from=lesson`);
  await passQuiz(page, answers);
  await expect(page.getByText("A'lo!")).toBeVisible();
});

test("fail by score (< 60 %): the tutor encourages, offers the lesson or a quick review", async ({ page }) => {
  const answers = await setup(page);
  await page.goto(`/practice/${SKILL}`);
  for (let i = 0; i < 5; i++) {
    await expect.poll(() => answers.length).toBeGreaterThan(0);
    const n = answers.length;
    await answer(page, answers, false);
    await answer(page, answers, false);
    await page.getByRole("button", { name: "Keyingi savol" }).click();
    if (i < 4) await expect.poll(() => answers.length).toBeGreaterThan(n);
  }
  await expect(page.getByTestId("quiz-fail")).toBeVisible();
  await expect(page.getByText("Keling, yana bir marta ko'rib chiqamiz")).toBeVisible();
  await page.getByRole("button", { name: "Tezkor takrorlash" }).click();
  await expect(page).toHaveURL(/mode=review/);
  await expect(page.getByTestId("quiz-progress")).toHaveText("1/3-savol");
});

test("quit mid-quiz: × asks first, then goes to the roadmap; browser back works", async ({ page }) => {
  const answers = await setup(page);
  await page.goto("/roadmap");
  await page.goto(`/practice/${SKILL}`);
  await answer(page, answers, true);
  await page.getByRole("button", { name: "Yopish" }).click();
  await expect(page.getByRole("dialog", { name: "Testdan chiqasanmi?" })).toBeVisible();
  await page.getByRole("button", { name: "Testni davom ettirish" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Yopish" }).click();
  await page.getByRole("button", { name: "Xaritaga qaytish" }).click();
  await expect(page).toHaveURL(/\/roadmap/);
  // browser back from the roadmap: no loop back into a dead quiz, no blank page
  await page.goBack();
  await expect(page.locator("main")).toBeVisible();
});

test("refresh mid-lesson resumes at the same step", async ({ page }) => {
  await setup(page);
  await page.goto(`/lesson/${SKILL}`);
  await page.getByRole("button", { name: "Darsni boshlash" }).click();
  // captions-only: each step takes a few seconds; wait until step 3
  await expect(page.getByRole("img", { name: /Qadam [3-9]\// })).toBeVisible({ timeout: 60_000 });
  const label = await page.getByRole("img", { name: /Qadam \d+\// }).getAttribute("aria-label");
  const step = Number(label!.match(/Qadam (\d+)/)![1]);
  await page.reload();
  const resume = page.getByRole("button", { name: /Davom etish · \d+-qadam/ });
  await expect(resume).toBeVisible();
  const offered = Number((await resume.textContent())!.match(/(\d+)-qadam/)![1]);
  expect(Math.abs(offered - step)).toBeLessThanOrEqual(1);
  await resume.click();
  await expect(page.getByRole("img", { name: new RegExp(`Qadam ${offered}/`) })).toBeVisible();
});
