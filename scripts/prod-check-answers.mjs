// Production check of live answers, per tutor, phone viewport, REAL voice (spends VoiceLab credits):
// EKUK lesson → "Boshidan doskani o'chirib tushuntirib ber" (restart, with voice) → "Nega 12?" (spoken answer).
//   node scripts/prod-check-answers.mjs [baseUrl] [tutors=blokbek,lola,ziyo]
// Logs the answer source, whether each answer line got its voice (and when), where it was written, and
// saves screenshots to docs/screenshots/answers-<tutor>-<n>.png.
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";

const BASE = process.argv[2] ?? "https://to2.locallabs-io.workers.dev";
const TUTORS = (process.argv[3] ?? "blokbek,lola,ziyo").split(",");
const OUT = "docs/screenshots";
fs.mkdirSync(OUT, { recursive: true });

async function run(tutor) {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 375, height: 812 }, baseURL: BASE });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => m.text().includes("[To2] answer") && logs.push(m.text()));
  const tts = []; // [ms since question, status, text]
  let t0 = Date.now();
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("/api/tts")) tts.push({ at: Date.now() - t0, status: r.status(), text: decodeURIComponent(new URL(u).searchParams.get("text") ?? "").slice(0, 40), long: u.includes("wait=long") });
  });
  const r = await page.request.post("/api/user", { data: { nickname: "Check", grade: 6, characterId: tutor } });
  if (!r.ok()) throw new Error("user " + r.status());
  const stage = page.locator('[role="img"][aria-label^="Sinfxona"]').first();
  const shot = (n) => stage.screenshot({ path: `${OUT}/answers-${tutor}-${n}.png` });
  const ask = async (q) => {
    await page.getByRole("button", { name: "Klaviatura" }).click();
    await page.getByLabel(/Savolingni yoz/).fill(q);
    t0 = Date.now();
    tts.length = 0;
    await page.getByRole("button", { name: "Yuborish" }).click();
  };

  await page.goto("/lesson/lcm");
  await page.getByRole("button", { name: /Darsni boshlash|Davom etish/ }).first().click();
  await page.getByRole("img", { name: /Qadam [2-9]\// }).waitFor({ timeout: 120_000 });
  await page.waitForTimeout(3000);
  await shot(1);

  // 1) restart request
  await ask("Boshidan doskani o'chirib tushuntirib ber");
  await page.getByRole("img", { name: /Qadam 1\// }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(4000);
  const restartVoice = tts.filter((x) => x.status === 200).length;
  await shot(2);
  console.log(`${tutor} restart: step 1 ✓, voice clips 200 in 4 s: ${restartVoice}, logs: ${logs.at(-1) ?? "-"}`);

  // 2) a real question
  await page.getByRole("img", { name: /Qadam [2-9]\// }).waitFor({ timeout: 120_000 });
  await ask("Nega 12?");
  await page.getByRole("button", { name: "Davom et" }).waitFor({ timeout: 120_000 });
  const answerLines = tts.filter((x) => x.long && !/^(Hmm…|Qani, o'ylab|Bir daqiqa|Ovozim)/.test(x.text));
  const fillers = tts.filter((x) => /^(Hmm…|Qani, o'ylab ko'raylik…|Bir daqiqa…)$/.test(x.text)).length;
  const meta = logs.at(-1) ?? "-";
  await shot(3);
  const answers = await (await page.request.get("/dev/answers")).json();
  console.log(`${tutor} "Nega 12?": ${meta}`);
  console.log(`   answer lines with voice: ${answerLines.filter((x) => x.status === 200).length}/${answerLines.length} at ${answerLines.map((x) => x.at + "ms").join(", ")}; fillers: ${fillers}`);
  console.log(`   /dev/answers[0]: ${JSON.stringify(answers.answers?.[0])}`);
  await page.getByRole("button", { name: "Davom et" }).click();
  await page.waitForTimeout(2500);
  await shot(4);
  await browser.close();
}

for (const t of TUTORS) await run(t).catch((e) => console.log(t, "FAILED", e.message));
