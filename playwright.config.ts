// E2E tests for the lesson ↔ quiz flow on a phone viewport (REPORT.md "Lesson ↔ quiz flow").
//   pnpm e2e                → against the local dev server (started if not running)
//   E2E_BASE=https://… pnpm e2e  → against a deployed site
// TTS is stubbed in the tests (captions-only lessons): no VoiceLab credits are spent.
import { defineConfig, devices } from "@playwright/test";

const base = process.env.E2E_BASE ?? "http://localhost:5173";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "e2e/results.json" }]],
  use: {
    baseURL: base,
    ...devices["Pixel 7"],
    viewport: { width: 375, height: 812 },
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE
    ? undefined
    : { command: "pnpm dev --port 5173 --strictPort", url: base, reuseExistingServer: true, timeout: 120_000 },
});
